import { Inject, Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '../common/either';
import {
  AddItemToOrderInputDto,
  CancelOrderInputDto,
  ConfirmOrderInputDto,
  CreateOrderInputDto,
  OrderItemOutputDto,
  OrderOutputDto,
} from '../dtos/order.dto';
import {
  ApplicationError,
  ConversationNotFoundError,
  DrinkNotFoundError,
  InvalidOrderStateError,
  OrderNotFoundError,
  UnexpectedError,
  ValidationError,
} from '@application/errors';
import { Conversation, Order } from '@domain/entities';
import { ConversationId, DrinkSize, OrderId, OrderItem } from '@domain/value-objects';
import { IConversationRepositoryPort, IDrinkRepositoryPort, IOrderRepositoryPort } from '../ports';
import { ICreateOrderPort } from '@application/ports/inbound/create-order.port';

/**
 * CreateOrderUseCase handles all order-related operations.
 *
 * This use case provides a programmatic way to manage orders,
 * separate from the conversational flow. It's useful for:
 * - Direct API calls to create/modify orders
 * - Testing order functionality
 * - Administrative operations
 *
 * The use case ensures all business rules are followed:
 * - Orders can only be modified while in 'pending' status
 * - Orders must have at least one item to be confirmed
 * - Cancelled orders cannot be modified
 */
@Injectable()
export class CreateOrderUseCase implements ICreateOrderPort {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepositoryPort,
    @Inject('IOrderRepository')
    private readonly orderRepository: IOrderRepositoryPort,
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
  ) {}

  /**
   * Create a new order or add to an existing active order.
   *
   * If the conversation already has an active order (pending status),
   * the item will be added to that order. Otherwise, a new order is created.
   */
  async execute(input: CreateOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>> {
    this.logger.debug(`Creating order for conversation: ${input.conversationId}`);

    try {
      // Validate input
      const validationResult = this.validateCreateInput(input);
      if (validationResult.isLeft()) {
        this.logger.warn(`Validation failed: ${validationResult.value.message}`);
        return validationResult;
      }

      // Verify conversation exists
      const conversation = await this.findConversation(input.conversationId);
      if (!conversation) {
        this.logger.warn(`Conversation not found: ${input.conversationId}`);
        return left(new ConversationNotFoundError(input.conversationId));
      }

      // Find the drink
      const drink = await this.drinkRepository.findByName(input.drinkName);
      if (!drink) {
        this.logger.warn(`Drink not found: ${input.drinkName}`);
        return left(new DrinkNotFoundError(input.drinkName));
      }

      // Parse size if provided
      const size = this.parseSize(input.size);

      // Create the order item
      const orderItem = OrderItem.create({
        drinkId: drink.id,
        drinkName: drink.name,
        quantity: input.quantity ?? 1,
        unitPrice: drink.basePrice,
        size: size ?? undefined,
        customizations: input.customizations ?? {},
      });

      // Get or create order
      let order = await this.orderRepository.findActiveByConversationId(input.conversationId);
      const isNewOrder = !order || !order.status.canBeModified();

      if (order && order.status.canBeModified()) {
        // Add to existing order
        order.addItem(orderItem);
        this.logger.debug(`Added item to existing order: ${order.id.toString()}`);
      } else {
        // Create new order
        order = Order.create();
        order.addItem(orderItem);

        // Link order to conversation
        conversation.setCurrentOrder(order.id);
        await this.conversationRepository.save(conversation);
        this.logger.log(`Created new order: ${order.id.toString()}`);
      }

      // Save the order
      await this.orderRepository.saveWithConversation(order, input.conversationId);

      this.logger.log(
        `Order ${isNewOrder ? 'created' : 'updated'}: ${order.id.toString()}, ` +
          `items: ${order.totalQuantity}, total: ${order.totalPrice.format()}`,
      );

      return right(this.mapToOutput(order, input.conversationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to create order: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Add an item to an existing order.
   */
  async addItem(input: AddItemToOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>> {
    this.logger.debug(`Adding item to order: ${input.orderId}`);

    try {
      // Find the order
      const order = await this.findOrder(input.orderId);
      if (!order) {
        this.logger.warn(`Order not found: ${input.orderId}`);
        return left(new OrderNotFoundError(input.orderId));
      }

      // Verify order can be modified
      if (!order.status.canBeModified()) {
        this.logger.warn(
          `Order ${input.orderId} cannot be modified (status: ${order.status.toString()})`,
        );
        return left(
          new InvalidOrderStateError(input.orderId, order.status.toString(), 'add items'),
        );
      }

      // Find the drink
      const drink = await this.drinkRepository.findByName(input.drinkName);
      if (!drink) {
        this.logger.warn(`Drink not found: ${input.drinkName}`);
        return left(new DrinkNotFoundError(input.drinkName));
      }

      // Parse size
      const size = this.parseSize(input.size);

      // Create and add the item
      const orderItem = OrderItem.create({
        drinkId: drink.id,
        drinkName: drink.name,
        quantity: input.quantity ?? 1,
        unitPrice: drink.basePrice,
        size: size ?? undefined,
        customizations: input.customizations ?? {},
      });

      order.addItem(orderItem);
      await this.orderRepository.save(order);

      this.logger.log(
        `Item added to order ${input.orderId}: ${input.drinkName} x${input.quantity ?? 1}`,
      );

      // Get conversation ID for output
      const conversationId = await this.findConversationIdForOrder(order.id);

      return right(this.mapToOutput(order, conversationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to add item to order: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Confirm an order, moving it from pending to confirmed status.
   */
  async confirmOrder(
    input: ConfirmOrderInputDto,
  ): Promise<Either<ApplicationError, OrderOutputDto>> {
    this.logger.debug(`Confirming order: ${input.orderId}`);

    try {
      const order = await this.findOrder(input.orderId);
      if (!order) {
        this.logger.warn(`Order not found: ${input.orderId}`);
        return left(new OrderNotFoundError(input.orderId));
      }

      if (!order.canBeConfirmed()) {
        this.logger.warn(
          `Order ${input.orderId} cannot be confirmed (status: ${order.status.toString()})`,
        );
        return left(new InvalidOrderStateError(input.orderId, order.status.toString(), 'confirm'));
      }

      order.confirm();
      await this.orderRepository.save(order);

      this.logger.log(`Order confirmed: ${input.orderId}, total: ${order.totalPrice.format()}`);

      const conversationId = await this.findConversationIdForOrder(order.id);

      return right(this.mapToOutput(order, conversationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to confirm order: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(input: CancelOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>> {
    this.logger.debug(`Cancelling order: ${input.orderId}`);

    try {
      const order = await this.findOrder(input.orderId);
      if (!order) {
        this.logger.warn(`Order not found: ${input.orderId}`);
        return left(new OrderNotFoundError(input.orderId));
      }

      if (order.status.isCompleted()) {
        this.logger.warn(`Order ${input.orderId} cannot be cancelled (status: completed)`);
        return left(new InvalidOrderStateError(input.orderId, order.status.toString(), 'cancel'));
      }

      if (order.status.isCancelled()) {
        this.logger.warn(`Order ${input.orderId} is already cancelled`);
        return left(
          new InvalidOrderStateError(input.orderId, 'cancelled', 'cancel (already cancelled)'),
        );
      }

      order.cancel();
      await this.orderRepository.save(order);

      // Clear from conversation
      const conversationId = await this.findConversationIdForOrder(order.id);
      if (conversationId) {
        const conversation = await this.findConversation(conversationId);
        if (conversation) {
          conversation.clearCurrentOrder();
          await this.conversationRepository.save(conversation);
        }
      }

      this.logger.log(`Order cancelled: ${input.orderId}`);

      return right(this.mapToOutput(order, conversationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to cancel order: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Get an order by ID.
   */
  async getOrder(orderId: string): Promise<Either<ApplicationError, OrderOutputDto>> {
    this.logger.debug(`Getting order: ${orderId}`);

    try {
      const order = await this.findOrder(orderId);
      if (!order) {
        this.logger.debug(`Order not found: ${orderId}`);
        return left(new OrderNotFoundError(orderId));
      }

      const conversationId = await this.findConversationIdForOrder(order.id);

      return right(this.mapToOutput(order, conversationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get order: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return left(new UnexpectedError(message));
    }
  }

  // ============ Private Helper Methods ============

  private validateCreateInput(input: CreateOrderInputDto): Either<ApplicationError, void> {
    if (!input.conversationId || input.conversationId.trim().length === 0) {
      return left(new ValidationError('Conversation ID is required', 'conversationId'));
    }

    if (!input.drinkName || input.drinkName.trim().length === 0) {
      return left(new ValidationError('Drink name is required', 'drinkName'));
    }

    if (input.quantity !== undefined) {
      if (input.quantity < 1 || input.quantity > 10) {
        return left(new ValidationError('Quantity must be between 1 and 10', 'quantity'));
      }
    }

    if (input.size !== undefined) {
      const validSizes = ['tall', 'grande', 'venti'];
      if (!validSizes.includes(input.size.toLowerCase())) {
        return left(
          new ValidationError(`Invalid size. Must be one of: ${validSizes.join(', ')}`, 'size'),
        );
      }
    }

    return right(undefined);
  }

  private async findConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const id = ConversationId.fromString(conversationId);
      return await this.conversationRepository.findById(id);
    } catch {
      return null;
    }
  }

  private async findOrder(orderId: string): Promise<Order | null> {
    try {
      const id = OrderId.fromString(orderId);
      return await this.orderRepository.findById(id);
    } catch {
      return null;
    }
  }

  private findConversationIdForOrder(_orderId: OrderId): Promise<string | null> {
    // In a future improvement, we could store conversationId on the Order document
    // For now, we return null and handle it in the output
    return Promise.resolve(null);
  }

  private parseSize(size?: string): DrinkSize | null {
    if (!size) {
      return null;
    }

    try {
      return DrinkSize.fromString(size);
    } catch {
      return null;
    }
  }

  private mapToOutput(order: Order, conversationId: string | null): OrderOutputDto {
    const items: OrderItemOutputDto[] = order.items.map((item) => ({
      drinkName: item.drinkName,
      size: item.size?.toString() ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.format(),
      totalPrice: item.totalPrice.format(),
      customizations: {
        milk: item.customizations.milk,
        syrup: item.customizations.syrup,
        sweetener: item.customizations.sweetener,
        topping: item.customizations.topping,
      },
    }));

    return {
      orderId: order.id.toString(),
      conversationId: conversationId ?? 'unknown',
      status: order.status.toString(),
      items,
      totalPrice: order.totalPrice.format(),
      totalQuantity: order.totalQuantity,
      canBeModified: order.status.canBeModified(),
      canBeConfirmed: order.canBeConfirmed(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '../common/either';
import {
  ApplicationError,
  ConversationNotFoundError,
  EmptyMessageError,
  UnexpectedError,
} from '@application/errors';
import { Conversation, Drink, Order } from '@domain/entities';
import { ConversationId, OrderItem } from '@domain/value-objects';
import {
  // Outbound ports
  IConversationAIPort,
  IConversationRepositoryPort,
  IDrinkRepositoryPort,
  IDrinkSearcherPort,
  IOrderRepositoryPort,
  // Inbound port types
  IProcessMessagePort,
} from '../ports';
import {
  OrderItemSummaryDto,
  OrderSummaryDto,
  ProcessMessageInputDto,
  ProcessMessageOutputDto,
} from '@application/dtos';
import {
  ConversationIntentType,
  ExtractedModificationDto,
  ExtractedOrderInfoDto,
  ExtractedOrderItemDto,
  ExtractedOrdersDto,
} from '@application/dtos/conversation-ai.dto';

/**
 * ProcessMessageUseCase is the main orchestrator for handling user messages.
 *
 * It coordinates between multiple services to:
 * 1. Manage conversation state
 * 2. Search for relevant drinks using RAG (Retrieval Augmented Generation)
 * 3. Generate AI responses with proper context
 * 4. Handle order-related intents
 *
 * This use case follows the hexagonal architecture pattern, depending only
 * on port interfaces, not concrete implementations.
 */
@Injectable()
export class ProcessMessageUseCase implements IProcessMessagePort {
  private readonly logger = new Logger(ProcessMessageUseCase.name);

  constructor(
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepositoryPort,
    @Inject('IOrderRepository')
    private readonly orderRepository: IOrderRepositoryPort,
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
    @Inject('IConversationAI')
    private readonly conversationAI: IConversationAIPort,
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
  ) {}

  /**
   * Process a user message and generate an appropriate response.
   *
   * @param input - The user's message and optional conversation ID
   * @returns Either an error or the processed response with context
   */
  async execute(
    input: ProcessMessageInputDto,
  ): Promise<Either<ApplicationError, ProcessMessageOutputDto>> {
    try {
      // Step 1: Validate input
      const validationResult = this.validateInput(input);
      if (validationResult.isLeft()) {
        return validationResult;
      }

      // Step 2: Get or create conversation
      const conversationResult = await this.getOrCreateConversation(input.conversationId);
      if (conversationResult.isLeft()) {
        return conversationResult;
      }
      const conversation = conversationResult.value;

      // Step 3: Search for relevant drinks (RAG)
      const relevantDrinks = await this.searchRelevantDrinks(input.message);

      // Step 4: Get active order if exists
      const activeOrder = await this.getActiveOrder(conversation.id.toString());
      const orderSummaryForAI = activeOrder ? activeOrder.toSummary() : null;

      // Step 5: Generate AI response
      const aiResponse = await this.conversationAI.generateResponse({
        userMessage: input.message,
        conversationHistory: conversation.getMessagesForContext(10),
        relevantDrinks,
        currentOrderSummary: orderSummaryForAI,
      });

      // Step 6: Process intent and handle order operations
      const orderAfterIntent = await this.processIntent(
        aiResponse.intent,
        aiResponse.extractedOrder,
        aiResponse.extractedOrders,
        aiResponse.extractedModifications,
        conversation,
        activeOrder,
        relevantDrinks,
      );

      // Step 7: Update conversation with new messages
      conversation.addUserMessage(input.message);
      conversation.addAssistantMessage(aiResponse.message);

      // Update current order reference if changed
      if (orderAfterIntent && !conversation.currentOrderId) {
        conversation.setCurrentOrder(orderAfterIntent.id);
      } else if (!orderAfterIntent && conversation.currentOrderId) {
        conversation.clearCurrentOrder();
      }

      // Save conversation
      await this.conversationRepository.save(conversation);

      // Step 8: Build and return output
      const output = this.buildOutput(
        aiResponse.message,
        conversation,
        aiResponse.intent,
        orderAfterIntent,
      );

      return right(output);
    } catch (error) {
      // Catch any unexpected errors and wrap them
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Validate the input message.
   */
  private validateInput(input: ProcessMessageInputDto): Either<ApplicationError, void> {
    if (!input.message || input.message.trim().length === 0) {
      return left(new EmptyMessageError());
    }
    return right(undefined);
  }

  /**
   * Get an existing conversation or create a new one.
   * New conversations are saved immediately to ensure persistence.
   */
  private async getOrCreateConversation(
    conversationId?: string,
  ): Promise<Either<ApplicationError, Conversation>> {
    this.logger.debug(`getOrCreateConversation called with ID: ${conversationId ?? 'new'}`);

    // If no ID provided, create and save new conversation
    if (!conversationId) {
      const newConversation = Conversation.create();
      this.logger.debug(`Creating new conversation: ${newConversation.id.toString()}`);
      // Save immediately to ensure it exists for subsequent messages
      await this.conversationRepository.save(newConversation);
      this.logger.debug(`Saved new conversation: ${newConversation.id.toString()}`);
      return right(newConversation);
    }

    // Try to find existing conversation
    try {
      const id = ConversationId.fromString(conversationId);
      this.logger.debug(`Looking for existing conversation: ${id.toString()}`);
      const existingConversation = await this.conversationRepository.findById(id);

      if (!existingConversation) {
        this.logger.warn(`Conversation not found: ${conversationId}`);
        return left(new ConversationNotFoundError(conversationId));
      }

      this.logger.debug(`Found conversation: ${existingConversation.id.toString()}`);
      return right(existingConversation);
    } catch (error: unknown) {
      // Invalid ID format - treat as not found
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error finding conversation: ${message}`);
      return left(new ConversationNotFoundError(conversationId));
    }
  }

  /**
   * Search for drinks relevant to the user's message using semantic search.
   * This is the "Retrieval" part of RAG.
   */
  private async searchRelevantDrinks(message: string): Promise<Drink[]> {
    try {
      const results = await this.drinkSearcher.findSimilar(message, 5);
      return results.map((r) => r.drink);
    } catch {
      // If search fails, return empty array - we can still respond without context
      return [];
    }
  }

  /**
   * Get the active order for a conversation, if one exists.
   */
  private async getActiveOrder(conversationId: string): Promise<Order | null> {
    try {
      return await this.orderRepository.findActiveByConversationId(conversationId);
    } catch {
      return null;
    }
  }

  /**
   * Process the detected intent and perform order operations if needed.
   */
  private async processIntent(
    intent: ConversationIntentType,
    extractedOrder: ExtractedOrderInfoDto | null,
    extractedOrders: ExtractedOrdersDto | null,
    extractedModifications: ExtractedModificationDto[],
    conversation: Conversation,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    switch (intent) {
      case 'order_drink':
        return this.handleOrderIntent(
          extractedOrder,
          extractedOrders,
          conversation,
          currentOrder,
          relevantDrinks,
        );

      case 'modify_order':
        return this.handleModifyIntent(extractedModifications, currentOrder, conversation);

      case 'confirm_order':
        return this.handleConfirmIntent(currentOrder, conversation);

      case 'process_payment':
        return this.handlePaymentIntent(currentOrder, conversation);

      case 'cancel_order':
        return this.handleCancelIntent(currentOrder, conversation);

      default:
        // For other intents (greeting, ask_question, unknown), return current order unchanged
        return currentOrder;
    }
  }

  /**
   * Handle order_drink intent - create or add to order.
   * Supports multiple items in a single message.
   */
  private async handleOrderIntent(
    extractedOrder: ExtractedOrderInfoDto | null,
    extractedOrders: ExtractedOrdersDto | null,
    conversation: Conversation,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    // Use extractedOrders if available (supports multiple items), else fall back to single extractedOrder
    const itemsToProcess: ExtractedOrderItemDto[] = extractedOrders?.items ?? [];

    // Add single extractedOrder if no extractedOrders but extractedOrder exists
    if (itemsToProcess.length === 0 && extractedOrder && extractedOrder.drinkName) {
      itemsToProcess.push({
        drinkName: extractedOrder.drinkName,
        size: extractedOrder.size,
        quantity: extractedOrder.quantity,
        customizations: extractedOrder.customizations,
        confidence: extractedOrder.confidence,
      });
    }

    // Filter out low-confidence extractions
    const validItems = itemsToProcess.filter((item) => item.confidence >= 0.5);

    if (validItems.length === 0) {
      return currentOrder;
    }

    // Use existing order or create new one
    let order: Order;
    if (currentOrder && currentOrder.status.canBeModified()) {
      order = currentOrder;
    } else {
      order = Order.create();
    }

    // Add all valid items to the order
    this.logger.debug(`Processing ${validItems.length} valid items to add`);
    let itemsAdded = 0;
    for (const extractedItem of validItems) {
      this.logger.debug(`Looking for drink: ${extractedItem.drinkName}`);
      const drink = await this.findDrink(extractedItem.drinkName, relevantDrinks);
      if (!drink) {
        this.logger.warn(`Drink not found: ${extractedItem.drinkName}`);
        continue;
      }

      this.logger.debug(`Found drink: ${drink.name}, adding to order`);
      const orderItem = OrderItem.create({
        drinkId: drink.id,
        drinkName: drink.name,
        quantity: extractedItem.quantity || 1,
        unitPrice: drink.basePrice,
        size: extractedItem.size ?? undefined,
        customizations: extractedItem.customizations,
      });

      order.addItem(orderItem);
      itemsAdded++;
      this.logger.debug(`Added item, order now has ${order.items.length} items`);
    }

    if (itemsAdded === 0) {
      return currentOrder;
    }

    // Save the order with conversation reference
    await this.orderRepository.saveWithConversation(order, conversation.id.toString());

    return order;
  }

  /**
   * Handle modify_order intent - supports modify and remove operations.
   */
  private async handleModifyIntent(
    modifications: ExtractedModificationDto[],
    currentOrder: Order | null,
    conversation: Conversation,
  ): Promise<Order | null> {
    if (!currentOrder || modifications.length === 0) {
      return currentOrder;
    }

    if (!currentOrder.status.canBeModified()) {
      this.logger.warn('Cannot modify order - order is not in a modifiable state');
      return currentOrder;
    }

    // Process each modification
    for (const mod of modifications) {
      if (mod.confidence < 0.5) {
        this.logger.debug(`Skipping modification with low confidence: ${mod.confidence}`);
        continue;
      }

      const targetIndex = this.resolveItemIndex(mod, currentOrder);
      if (targetIndex === -1) {
        const drinkName = mod.drinkName ?? 'none';
        const itemIndex = mod.itemIndex ?? 'none';
        this.logger.warn(
          `Could not resolve item for modification: drinkName=${drinkName}, itemIndex=${itemIndex}`,
        );
        continue;
      }

      try {
        if (mod.action === 'remove') {
          currentOrder.removeItemByIndex(targetIndex);
          this.logger.debug(`Removed item at index ${targetIndex}`);
        } else if (mod.action === 'modify') {
          currentOrder.updateItemByIndex(targetIndex, (item) => {
            let updatedItem = item;

            // Apply quantity change
            if (mod.changes?.newQuantity !== undefined) {
              if (mod.changes.newQuantity === 0) {
                // Quantity 0 means remove - handle this case
                currentOrder.removeItemByIndex(targetIndex);
                return item; // Return original, but it will be removed
              }
              updatedItem = updatedItem.withQuantity(mod.changes.newQuantity);
            }

            // Apply size change
            if (mod.changes?.newSize) {
              updatedItem = updatedItem.withSize(mod.changes.newSize);
            }

            // Apply customization additions
            if (mod.changes?.addCustomizations) {
              updatedItem = updatedItem.withCustomizations(mod.changes.addCustomizations);
            }

            // Apply customization removals
            if (mod.changes?.removeCustomizations && mod.changes.removeCustomizations.length > 0) {
              const clearedCustomizations: Record<string, undefined> = {};
              for (const key of mod.changes.removeCustomizations) {
                clearedCustomizations[key] = undefined;
              }
              updatedItem = updatedItem.withCustomizations(
                clearedCustomizations as Partial<typeof updatedItem.customizations>,
              );
            }

            return updatedItem;
          });
          this.logger.debug(`Modified item at index ${targetIndex}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error applying modification: ${message}`);
      }
    }

    // Save the modified order
    await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());

    // If order is now empty after removals, return null
    if (currentOrder.isEmpty()) {
      conversation.clearCurrentOrder();
      return null;
    }

    return currentOrder;
  }

  /**
   * Resolve the target item index from a modification request.
   * Uses itemIndex if provided (1-based), otherwise searches by drinkName.
   * Returns 0-based index or -1 if not found.
   */
  private resolveItemIndex(mod: ExtractedModificationDto, order: Order): number {
    // If itemIndex is provided, use it (convert from 1-based to 0-based)
    if (mod.itemIndex !== undefined && mod.itemIndex > 0) {
      const zeroBasedIndex = mod.itemIndex - 1;
      if (zeroBasedIndex >= 0 && zeroBasedIndex < order.items.length) {
        return zeroBasedIndex;
      }
      this.logger.warn(
        `Invalid itemIndex: ${mod.itemIndex}, order has ${order.items.length} items`,
      );
      return -1;
    }

    // Otherwise, search by drink name
    if (mod.drinkName) {
      return order.findItemIndexByName(mod.drinkName);
    }

    return -1;
  }

  /**
   * Handle confirm_order intent.
   * The order stays visible in the conversation after confirmation
   * so the user can reference it for payment or see a summary.
   */
  private async handleConfirmIntent(
    currentOrder: Order | null,
    conversation: Conversation,
  ): Promise<Order | null> {
    if (!currentOrder) {
      return null;
    }

    try {
      if (currentOrder.canBeConfirmed()) {
        currentOrder.confirm();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        // Note: We don't clear the order from conversation so user can still see it
        // and reference it for payment. A new order will replace it when created.
      }
      return currentOrder;
    } catch {
      // Order might not be in a state that can be confirmed
      return currentOrder;
    }
  }

  /**
   * Handle process_payment intent.
   * Completes the order (simulating payment) and clears it from conversation.
   */
  private async handlePaymentIntent(
    currentOrder: Order | null,
    conversation: Conversation,
  ): Promise<Order | null> {
    if (!currentOrder) {
      return null;
    }

    try {
      // If order is confirmed, complete it
      if (currentOrder.status.isConfirmed()) {
        currentOrder.complete();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        conversation.clearCurrentOrder();
        return null; // Order is completed, clear from active conversation
      }
      // If order is pending, confirm and complete it
      if (currentOrder.status.isPending() && currentOrder.canBeConfirmed()) {
        currentOrder.confirm();
        currentOrder.complete();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        conversation.clearCurrentOrder();
        return null;
      }
      return currentOrder;
    } catch {
      return currentOrder;
    }
  }

  /**
   * Handle cancel_order intent.
   */
  private async handleCancelIntent(
    currentOrder: Order | null,
    conversation: Conversation,
  ): Promise<Order | null> {
    if (!currentOrder) {
      return null;
    }

    try {
      currentOrder.cancel();
      await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
      conversation.clearCurrentOrder();
      return null; // Order is cancelled, return null
    } catch {
      return currentOrder;
    }
  }

  /**
   * Find a drink by name, first checking relevant drinks then the repository.
   */
  private async findDrink(drinkName: string, relevantDrinks: Drink[]): Promise<Drink | null> {
    // First check in relevant drinks (faster, already loaded)
    const fromRelevant = relevantDrinks.find(
      (d) => d.name.toLowerCase() === drinkName.toLowerCase(),
    );
    if (fromRelevant) {
      return fromRelevant;
    }

    // Fall back to repository search
    return this.drinkRepository.findByName(drinkName);
  }

  /**
   * Build the final output DTO.
   */
  private buildOutput(
    response: string,
    conversation: Conversation,
    intent: ConversationIntentType,
    order: Order | null,
  ): ProcessMessageOutputDto {
    const orderSummary = order ? this.buildOrderSummary(order) : null;
    const suggestedReplies = this.getSuggestedActions(order);

    return {
      response,
      conversationId: conversation.id.toString(),
      intent,
      currentOrder: orderSummary,
      suggestedReplies,
    };
  }

  /**
   * Build order summary for output.
   * Includes 1-based index for each item for user reference.
   */
  private buildOrderSummary(order: Order): OrderSummaryDto {
    const items: OrderItemSummaryDto[] = order.items.map((item, idx) => ({
      index: idx + 1, // 1-based index for user reference
      drinkName: item.drinkName,
      size: item.size?.toString() ?? null,
      quantity: item.quantity,
      customizations: {
        milk: item.customizations.milk,
        syrup: item.customizations.syrup,
        sweetener: item.customizations.sweetener,
        topping: item.customizations.topping,
      },
      price: item.totalPrice.format(),
    }));

    return {
      orderId: order.id.toString(),
      status: order.status.toString(),
      items,
      totalPrice: order.totalPrice.format(),
      itemCount: order.totalQuantity,
      canConfirm: order.canBeConfirmed(),
    };
  }

  /**
   * Get suggested actions based on current state.
   */
  private getSuggestedActions(order: Order | null): string[] {
    if (!order) {
      return ['Ver el menú', 'Preguntar por una bebida', 'Hacer un pedido'];
    }

    if (order.status.isPending()) {
      return ['Agregar otra bebida', 'Modificar mi orden', 'Confirmar mi orden', 'Cancelar orden'];
    }

    if (order.status.isConfirmed()) {
      return ['Proceder al pago', 'Iniciar nueva orden', 'Ver el menú'];
    }

    if (order.status.isCompleted()) {
      return ['Iniciar nueva orden', 'Ver el menú'];
    }

    return [];
  }
}

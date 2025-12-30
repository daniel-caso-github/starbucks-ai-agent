import { Inject, Injectable } from '@nestjs/common';
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
  ExtractedOrderInfoDto,
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
   */
  private async getOrCreateConversation(
    conversationId?: string,
  ): Promise<Either<ApplicationError, Conversation>> {
    // If no ID provided, create new conversation
    if (!conversationId) {
      const newConversation = Conversation.create();
      return right(newConversation);
    }

    // Try to find existing conversation
    try {
      const id = ConversationId.fromString(conversationId);
      const existingConversation = await this.conversationRepository.findById(id);

      if (!existingConversation) {
        return left(new ConversationNotFoundError(conversationId));
      }

      return right(existingConversation);
    } catch {
      // Invalid ID format - treat as not found
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
    conversation: Conversation,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    switch (intent) {
      case 'order_drink':
        return this.handleOrderIntent(extractedOrder, conversation, currentOrder, relevantDrinks);

      case 'modify_order':
        return this.handleModifyIntent(extractedOrder, currentOrder, relevantDrinks);

      case 'confirm_order':
        return this.handleConfirmIntent(currentOrder, conversation);

      case 'cancel_order':
        return this.handleCancelIntent(currentOrder, conversation);

      default:
        // For other intents (greeting, ask_question, unknown), return current order unchanged
        return currentOrder;
    }
  }

  /**
   * Handle order_drink intent - create or add to order.
   */
  private async handleOrderIntent(
    extractedOrder: ExtractedOrderInfoDto | null,
    conversation: Conversation,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    if (!extractedOrder || !extractedOrder.drinkName || extractedOrder.confidence < 0.5) {
      // Not confident enough to create order
      return currentOrder;
    }

    // Find the drink being ordered
    const drink = await this.findDrink(extractedOrder.drinkName, relevantDrinks);
    if (!drink) {
      return currentOrder;
    }

    // Create order item
    const orderItem = OrderItem.create({
      drinkId: drink.id,
      drinkName: drink.name,
      quantity: extractedOrder.quantity || 1,
      unitPrice: drink.basePrice,
      size: extractedOrder.size ?? undefined,
      customizations: extractedOrder.customizations,
    });

    // Add to existing order or create new one
    let order: Order;
    if (currentOrder && currentOrder.status.canBeModified()) {
      currentOrder.addItem(orderItem);
      order = currentOrder;
    } else {
      order = Order.create();
      order.addItem(orderItem);
    }

    // Save the order with conversation reference
    await this.orderRepository.saveWithConversation(order, conversation.id.toString());

    return order;
  }

  /**
   * Handle modify_order intent.
   */
  private async handleModifyIntent(
    extractedOrder: ExtractedOrderInfoDto | null,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    if (!currentOrder || !extractedOrder || !extractedOrder.drinkName) {
      return currentOrder;
    }

    // For now, modification adds a new item
    // In a more complete implementation, we would handle item updates and removals
    const drink = await this.findDrink(extractedOrder.drinkName, relevantDrinks);
    if (!drink) {
      return currentOrder;
    }

    const orderItem = OrderItem.create({
      drinkId: drink.id,
      drinkName: drink.name,
      quantity: extractedOrder.quantity || 1,
      unitPrice: drink.basePrice,
      size: extractedOrder.size ?? undefined,
      customizations: extractedOrder.customizations,
    });

    if (currentOrder.status.canBeModified()) {
      currentOrder.addItem(orderItem);
      await this.orderRepository.save(currentOrder);
    }

    return currentOrder;
  }

  /**
   * Handle confirm_order intent.
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
        // In a real system, we might also mark it as completed after confirmation
        currentOrder.complete();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        conversation.clearCurrentOrder();
      }
      return currentOrder;
    } catch {
      // Order might not be in a state that can be confirmed
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
   */
  private buildOrderSummary(order: Order): OrderSummaryDto {
    const items: OrderItemSummaryDto[] = order.items.map((item) => ({
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
      return ['Browse our menu', 'Ask about a specific drink', 'Start an order'];
    }

    if (order.status.isPending()) {
      return ['Add another drink', 'Modify your order', 'Confirm your order', 'Cancel your order'];
    }

    if (order.status.isConfirmed() || order.status.isCompleted()) {
      return ['Start a new order', 'Browse our menu'];
    }

    return [];
  }
}

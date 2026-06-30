import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IConversationAIPort,
  IConversationRepositoryPort,
  IDrinkRepositoryPort,
  IDrinkSearcherPort,
  IOrderRepositoryPort,
} from '@application/ports/outbound';
import { Conversation, Drink, Order } from '@domain/entities';
import { ConversationId, OrderItem } from '@domain/value-objects';
import { ProcessMessageOutputDto } from '@application/dtos';
import {
  ConversationIntentType,
  ExtractedModificationDto,
  ExtractedOrderInfoDto,
  ExtractedOrderItemDto,
  ExtractedOrdersDto,
} from '@application/dtos/conversation-ai.dto';
import { buildOrderSummary, getSuggestedActions } from './helpers/build-process-message-output';
import { handleSpecialActions } from './helpers/drink-action-helpers';

export interface StreamMessageInput {
  message: string;
  conversationId?: string;
}

export interface StreamChunk {
  type: 'text' | 'complete' | 'error';
  data: string | ProcessMessageOutputDto;
}

/**
 * Use case for processing chat messages with streaming responses.
 * Yields text chunks as they arrive from the AI.
 */
@Injectable()
export class ProcessMessageStreamUseCase {
  private readonly logger = new Logger(ProcessMessageStreamUseCase.name);

  constructor(
    @Inject('IConversationAI')
    private readonly conversationAI: IConversationAIPort,
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepositoryPort,
    @Inject('IOrderRepository')
    private readonly orderRepository: IOrderRepositoryPort,
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
  ) {}

  async *execute(input: StreamMessageInput): AsyncGenerator<StreamChunk> {
    try {
      // Get or create conversation
      let conversation: Conversation;
      let conversationId: ConversationId;

      if (input.conversationId) {
        conversationId = ConversationId.fromString(input.conversationId);
        const existing = await this.conversationRepository.findById(conversationId);
        if (existing) {
          conversation = existing;
        } else {
          this.logger.warn(
            `Conversation ${conversationId.toString()} not found in storage, recreating with same id`,
          );
          conversation = Conversation.create(conversationId);
        }
      } else {
        conversationId = ConversationId.generate();
        conversation = Conversation.create(conversationId);
      }

      // Add user message
      conversation.addUserMessage(input.message);

      // Get relevant drinks for context (enrich imageUrl from MongoDB if ChromaDB has stale data)
      const searchResults = await this.drinkSearcher.findSimilar(input.message, 5);
      const relevantDrinks = await Promise.all(
        searchResults.map(async (r) => {
          if (!r.drink.imageUrl) {
            return (await this.drinkRepository.findById(r.drink.id)) ?? r.drink;
          }
          return r.drink;
        }),
      );

      // Get current order if exists
      const activeOrder = await this.orderRepository.findActiveByConversationId(
        conversationId.toString(),
      );

      // Build conversation history
      const history = this.buildConversationHistory(conversation);

      // Build order summary
      const orderSummary = activeOrder ? this.buildOrderSummaryString(activeOrder) : null;

      // Check if AI supports streaming
      if (!this.conversationAI.generateResponseStream) {
        // Fallback to non-streaming
        const response = await this.conversationAI.generateResponse({
          userMessage: input.message,
          conversationHistory: history,
          relevantDrinks,
          currentOrderSummary: orderSummary,
        });

        yield { type: 'text', data: response.message };

        conversation.addAssistantMessage(response.message);
        await this.conversationRepository.save(conversation);

        const refreshedOrder = await this.orderRepository.findActiveByConversationId(
          conversationId.toString(),
        );

        const output: ProcessMessageOutputDto = {
          response: response.message,
          conversationId: conversationId.toString(),
          intent: response.intent,
          currentOrder: refreshedOrder ? buildOrderSummary(refreshedOrder) : null,
          suggestedReplies: getSuggestedActions(refreshedOrder),
        };

        yield { type: 'complete', data: output };
        return;
      }

      // Stream the response using manual .next() to capture the generator return value
      const stream = this.conversationAI.generateResponseStream({
        userMessage: input.message,
        conversationHistory: history,
        relevantDrinks,
        currentOrderSummary: orderSummary,
      });

      let fullText = '';

      while (true) {
        const result = await stream.next();
        if (result.done) {
          const finalResponse = result.value;

          let { intent, extractedOrder, extractedOrders } = finalResponse;
          const soundsLikeConfirmation = /\bagregu[eé]|\bañad[íi]|\bsum[eé]|\blo agregu[eé]/i.test(finalResponse.message ?? '');
          if (soundsLikeConfirmation && !extractedOrders?.items?.length && !extractedOrder) {
            this.logger.warn('Stream: confirmation detected without tool call - attempting direct drink match');
            const msgLower = input.message.toLowerCase();
            const matchedDrink = relevantDrinks.find((d) => msgLower.includes(d.name.toLowerCase()));
            if (matchedDrink) {
              extractedOrder = { drinkName: matchedDrink.name, size: null, quantity: 1, customizations: {}, confidence: 0.8 };
              intent = 'order_drink';
            }
          }

          const orderAfterIntent = await this.processIntent(
            intent,
            extractedOrder,
            extractedOrders,
            finalResponse.extractedModifications,
            conversation,
            activeOrder,
            relevantDrinks,
          );

          conversation.addAssistantMessage(finalResponse.message || fullText);

          if (orderAfterIntent && !conversation.currentOrderId) {
            conversation.setCurrentOrder(orderAfterIntent.id);
          } else if (!orderAfterIntent && conversation.currentOrderId) {
            conversation.clearCurrentOrder();
          }

          await this.conversationRepository.save(conversation);

          const effectiveActions =
            finalResponse.suggestedActions.length === 0 &&
            this.isMenuRequest(input.message)
              ? [{ type: 'get_full_menu' as const }]
              : finalResponse.suggestedActions;

          const cards = await handleSpecialActions(
            finalResponse.message || fullText,
            effectiveActions,
            this.drinkRepository,
            this.drinkSearcher,
            this.logger,
          );

          const hasMenuAction = effectiveActions.some((a) => a.type === 'get_full_menu');

          const messageToYield = finalResponse.message || fullText;
          if (fullText === '' && messageToYield) {
            fullText = messageToYield;
            yield { type: 'text', data: messageToYield };
          }

          const output: ProcessMessageOutputDto = {
            response: messageToYield,
            conversationId: conversationId.toString(),
            intent: finalResponse.intent,
            currentOrder: orderAfterIntent ? buildOrderSummary(orderAfterIntent) : null,
            suggestedReplies: getSuggestedActions(orderAfterIntent),
            ...(cards.length > 0 ? { cards } : {}),
            ...(hasMenuAction ? { openMenu: true } : {}),
          };

          yield { type: 'complete', data: output };
          break;
        }

        fullText += result.value;
        yield { type: 'text', data: result.value };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Stream error: ${message}`);
      yield { type: 'error', data: 'Error processing message' };
    }
  }

  private buildConversationHistory(conversation: Conversation): string {
    const recentMessages = conversation.messages.slice(-10);
    return recentMessages.map((m) => `[${m.role}]: ${m.content}`).join('\n');
  }

  private buildOrderSummaryString(order: {
    items: readonly { drinkName: string; quantity: number }[];
  }): string {
    const items = order.items.map((i) => `${i.quantity}x ${i.drinkName}`).join(', ');
    return `Current order: ${items}`;
  }

  private isMenuRequest(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('men') ||
      lower.includes('bebida') ||
      lower.includes('lista') ||
      lower.includes('opcion') ||
      lower.includes('opción') ||
      lower.includes('carta') ||
      lower.includes('todas') ||
      lower.includes('que tienen') ||
      lower.includes('qué tienen')
    );
  }

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
        return this.handleOrderIntent(extractedOrder, extractedOrders, conversation, currentOrder, relevantDrinks);
      case 'modify_order':
        return this.handleModifyIntent(extractedModifications, currentOrder, conversation);
      case 'confirm_order':
        return this.handleConfirmIntent(currentOrder, conversation);
      case 'process_payment':
        return this.handlePaymentIntent(currentOrder, conversation);
      case 'cancel_order':
        return this.handleCancelIntent(currentOrder, conversation);
      default:
        return currentOrder;
    }
  }

  private async handleOrderIntent(
    extractedOrder: ExtractedOrderInfoDto | null,
    extractedOrders: ExtractedOrdersDto | null,
    conversation: Conversation,
    currentOrder: Order | null,
    relevantDrinks: Drink[],
  ): Promise<Order | null> {
    const itemsToProcess: ExtractedOrderItemDto[] = extractedOrders?.items ?? [];
    if (itemsToProcess.length === 0 && extractedOrder?.drinkName) {
      itemsToProcess.push({
        drinkName: extractedOrder.drinkName,
        size: extractedOrder.size,
        quantity: extractedOrder.quantity,
        customizations: extractedOrder.customizations,
        confidence: extractedOrder.confidence,
      });
    }

    const validItems = itemsToProcess.filter((item) => item.confidence >= 0.5);
    if (validItems.length === 0) return currentOrder;

    let order: Order;
    if (currentOrder && currentOrder.status.canBeModified()) {
      order = currentOrder;
    } else {
      order = Order.create();
    }

    let itemsAdded = 0;
    for (const item of validItems) {
      const drink = await this.findDrink(item.drinkName, relevantDrinks);
      if (!drink) continue;
      const orderItem = OrderItem.create({
        drinkId: drink.id,
        drinkName: drink.name,
        quantity: item.quantity || 1,
        unitPrice: drink.basePrice,
        size: item.size ?? undefined,
        customizations: item.customizations,
        isHot: drink.isHot,
        imageUrl: drink.imageUrl,
      });
      order.addItem(orderItem);
      itemsAdded++;
    }

    if (itemsAdded === 0) return currentOrder;
    await this.orderRepository.saveWithConversation(order, conversation.id.toString());
    return order;
  }

  private async handleModifyIntent(
    modifications: ExtractedModificationDto[],
    currentOrder: Order | null,
    conversation: Conversation,
  ): Promise<Order | null> {
    if (!currentOrder || modifications.length === 0) return currentOrder;
    if (!currentOrder.status.canBeModified()) return currentOrder;

    for (const mod of modifications) {
      if (mod.confidence < 0.5) continue;

      const targetIndex = this.resolveItemIndex(mod, currentOrder);
      if (targetIndex === -1) continue;

      try {
        if (mod.action === 'remove') {
          currentOrder.removeItemByIndex(targetIndex);
        } else if (mod.action === 'modify') {
          if (mod.changes?.newQuantity === 0) {
            currentOrder.removeItemByIndex(targetIndex);
          } else {
            currentOrder.updateItemByIndex(targetIndex, (item) => {
              let updated = item;
              if (mod.changes?.newQuantity !== undefined) {
                updated = updated.withQuantity(mod.changes.newQuantity);
              }
              if (mod.changes?.newSize) {
                updated = updated.withSize(mod.changes.newSize);
              }
              if (mod.changes?.addCustomizations) {
                updated = updated.withCustomizations(mod.changes.addCustomizations);
              }
              return updated;
            });
          }
        }
      } catch (error) {
        this.logger.error(`Modify error: ${error instanceof Error ? error.message : error}`);
      }
    }

    await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
    if (currentOrder.isEmpty()) {
      conversation.clearCurrentOrder();
      return null;
    }
    return currentOrder;
  }

  private resolveItemIndex(mod: ExtractedModificationDto, order: Order): number {
    if (mod.itemIndex !== undefined && mod.itemIndex > 0) {
      const idx = mod.itemIndex - 1;
      return idx < order.items.length ? idx : -1;
    }
    if (mod.drinkName) return order.findItemIndexByName(mod.drinkName);
    return -1;
  }

  private async handleConfirmIntent(currentOrder: Order | null, conversation: Conversation): Promise<Order | null> {
    if (!currentOrder) return null;
    try {
      if (currentOrder.canBeConfirmed()) {
        currentOrder.confirm();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
      }
      return currentOrder;
    } catch {
      return currentOrder;
    }
  }

  private async handlePaymentIntent(currentOrder: Order | null, conversation: Conversation): Promise<Order | null> {
    if (!currentOrder) return null;
    try {
      if (currentOrder.status.isConfirmed()) {
        currentOrder.complete();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        return currentOrder;
      }
      if (currentOrder.status.isPending() && currentOrder.canBeConfirmed()) {
        currentOrder.confirm();
        currentOrder.complete();
        await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
        return currentOrder;
      }
      return currentOrder;
    } catch {
      return currentOrder;
    }
  }

  private async handleCancelIntent(currentOrder: Order | null, conversation: Conversation): Promise<Order | null> {
    if (!currentOrder) return null;
    try {
      currentOrder.cancel();
      await this.orderRepository.saveWithConversation(currentOrder, conversation.id.toString());
      conversation.clearCurrentOrder();
      return null;
    } catch {
      return currentOrder;
    }
  }

  private async findDrink(drinkName: string, relevantDrinks: Drink[]): Promise<Drink | null> {
    const name = drinkName.toLowerCase().trim();
    const exact = relevantDrinks.find((d) => d.name.toLowerCase() === name);
    if (exact) return exact;
    const partial = relevantDrinks.find(
      (d) => d.name.toLowerCase().includes(name) || name.includes(d.name.toLowerCase()),
    );
    if (partial) return partial;
    const fromRepo = await this.drinkRepository.findByName(drinkName);
    if (fromRepo) return fromRepo;
    try {
      const results = await this.drinkSearcher.findSimilar(drinkName, 1);
      if (results.length > 0 && results[0].score > 0.7) return results[0].drink;
    } catch { /* fallthrough */ }
    return null;
  }
}

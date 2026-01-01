import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IConversationAIPort,
  IConversationRepositoryPort,
  IDrinkSearcherPort,
  IOrderRepositoryPort,
} from '@application/ports/outbound';
import { Conversation } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';
import { GenerateResponseOutputDto } from '@application/dtos/conversation-ai.dto';

export interface StreamMessageInput {
  message: string;
  conversationId?: string;
}

export interface StreamChunk {
  type: 'text' | 'complete' | 'error';
  data: string;
  final?: GenerateResponseOutputDto;
  conversationId?: string;
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
  ) {}

  async *execute(input: StreamMessageInput): AsyncGenerator<StreamChunk> {
    try {
      // Get or create conversation
      let conversation: Conversation;
      let conversationId: ConversationId;

      if (input.conversationId) {
        conversationId = ConversationId.fromString(input.conversationId);
        const existing = await this.conversationRepository.findById(conversationId);
        if (!existing) {
          yield { type: 'error', data: 'Conversation not found' };
          return;
        }
        conversation = existing;
      } else {
        conversationId = ConversationId.generate();
        conversation = Conversation.create(conversationId);
      }

      // Add user message
      conversation.addUserMessage(input.message);

      // Get relevant drinks for context
      const searchResults = await this.drinkSearcher.findSimilar(input.message, 5);
      const relevantDrinks = searchResults.map((r) => r.drink);

      // Get current order if exists
      const activeOrder = await this.orderRepository.findActiveByConversationId(
        conversationId.toString(),
      );

      // Build conversation history
      const history = this.buildConversationHistory(conversation);

      // Build order summary
      const orderSummary = activeOrder ? this.buildOrderSummary(activeOrder) : null;

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
        yield {
          type: 'complete',
          data: response.message,
          final: response,
          conversationId: conversationId.toString(),
        };

        // Save conversation
        conversation.addAssistantMessage(response.message);
        await this.conversationRepository.save(conversation);
        return;
      }

      // Stream the response
      const stream = this.conversationAI.generateResponseStream({
        userMessage: input.message,
        conversationHistory: history,
        relevantDrinks,
        currentOrderSummary: orderSummary,
      });

      let fullText = '';
      let finalResponse: GenerateResponseOutputDto | undefined;

      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullText += chunk;
          yield { type: 'text', data: chunk };
        } else {
          // This is the final response
          finalResponse = chunk;
        }
      }

      // If we got a final response from the generator return value
      if (finalResponse) {
        yield {
          type: 'complete',
          data: finalResponse.message || fullText,
          final: finalResponse,
          conversationId: conversationId.toString(),
        };

        // Save conversation with assistant response
        conversation.addAssistantMessage(finalResponse.message || fullText);
        await this.conversationRepository.save(conversation);
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

  private buildOrderSummary(order: {
    items: readonly { drinkName: string; quantity: number }[];
  }): string {
    const items = order.items.map((i) => `${i.quantity}x ${i.drinkName}`).join(', ');
    return `Current order: ${items}`;
  }
}

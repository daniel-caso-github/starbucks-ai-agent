import { Inject, Injectable } from '@nestjs/common';
import { Either, left, right } from '../common/either';
import {
  ConversationHistoryOutputDto,
  GetConversationHistoryInputDto,
  MessageOutputDto,
  StartConversationInputDto,
  StartConversationOutputDto,
} from '@application/dtos';
import {
  ApplicationError,
  ConversationNotFoundError,
  UnexpectedError,
  ValidationError,
} from '@application/errors';
import { Conversation } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';
import { IConversationHistoryPort, IConversationRepositoryPort } from '../ports';

/**
 * GetConversationHistoryUseCase handles conversation retrieval and creation.
 *
 * This use case provides functionality to:
 * - Retrieve chat history for an existing conversation
 * - Start new conversations with optional initial messages
 * - Check if a conversation exists
 *
 * It's essential for:
 * - Loading previous chat when a user returns to continue a conversation
 * - Displaying conversation history in the UI
 * - Initializing new chat sessions
 * - Analytics and debugging purposes
 */
@Injectable()
export class GetConversationHistoryUseCase implements IConversationHistoryPort {
  constructor(
    @Inject('IConversationRepositoryPort')
    private readonly conversationRepository: IConversationRepositoryPort,
  ) {}

  /**
   * Retrieve the conversation history.
   *
   * @param input - Conversation ID and optional message limit
   * @returns Either an error or the conversation history with messages
   *
   * @example
   * ```typescript
   * const result = await getConversationHistoryUseCase.execute({
   *   conversationId: "conv_abc123",
   *   limit: 20
   * });
   *
   * if (result.isRight()) {
   *   console.log(`Found ${result.value.messageCount} messages`);
   *   result.value.messages.forEach(msg => {
   *     console.log(`[${msg.role}]: ${msg.content}`);
   *   });
   * }
   * ```
   */
  async execute(
    input: GetConversationHistoryInputDto,
  ): Promise<Either<ApplicationError, ConversationHistoryOutputDto>> {
    try {
      // Step 1: Validate input
      const validationResult = this.validateInput(input);
      if (validationResult.isLeft()) {
        return validationResult;
      }

      const messageLimit = input.limit ?? 50;

      // Step 2: Parse and validate conversation ID
      let conversationId: ConversationId;
      try {
        conversationId = ConversationId.fromString(input.conversationId);
      } catch {
        return left(new ConversationNotFoundError(input.conversationId));
      }

      // Step 3: Retrieve conversation with history
      const conversation = await this.conversationRepository.getRecentHistory(
        conversationId,
        messageLimit,
      );

      if (!conversation) {
        return left(new ConversationNotFoundError(input.conversationId));
      }

      // Step 4: Map to output DTO
      const output = this.mapToOutputDto(conversation);

      return right(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Start a new conversation.
   *
   * Creates a new conversation and optionally processes an initial message.
   * Returns a welcome message and suggested prompts to help the user get started.
   *
   * @param input - Optional initial message from the user
   * @returns Either an error or the new conversation details
   *
   * @example
   * ```typescript
   * const result = await getConversationHistoryUseCase.startConversation({
   *   initialMessage: "Hi, I'd like to order a coffee"
   * });
   *
   * if (result.isRight()) {
   *   console.log(`New conversation: ${result.value.conversationId}`);
   *   console.log(`Welcome: ${result.value.welcomeMessage}`);
   * }
   * ```
   */
  async startConversation(
    input: StartConversationInputDto,
  ): Promise<Either<ApplicationError, StartConversationOutputDto>> {
    try {
      // Create a new conversation
      const conversation = Conversation.create();

      // Add initial message if provided
      if (input.initialMessage && input.initialMessage.trim().length > 0) {
        conversation.addUserMessage(input.initialMessage.trim());
      }

      // Save the conversation
      await this.conversationRepository.save(conversation);

      // Build welcome response
      const output: StartConversationOutputDto = {
        conversationId: conversation.id.toString(),
        welcomeMessage: this.getWelcomeMessage(),
        suggestedPrompts: this.getSuggestedPrompts(),
      };

      return right(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Check if a conversation exists.
   *
   * @param conversationId - The conversation ID to check
   * @returns true if the conversation exists, false otherwise
   */
  async exists(conversationId: string): Promise<boolean> {
    try {
      const id = ConversationId.fromString(conversationId);
      return await this.conversationRepository.exists(id);
    } catch {
      return false;
    }
  }

  /**
   * Delete a conversation.
   *
   * @param conversationId - The conversation ID to delete
   * @returns Either an error or a success boolean
   */
  async deleteConversation(conversationId: string): Promise<Either<ApplicationError, boolean>> {
    try {
      let id: ConversationId;
      try {
        id = ConversationId.fromString(conversationId);
      } catch {
        return left(new ConversationNotFoundError(conversationId));
      }

      const deleted = await this.conversationRepository.delete(id);
      return right(deleted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  // ============ Private Helper Methods ============

  /**
   * Validate the get history input.
   */
  private validateInput(input: GetConversationHistoryInputDto): Either<ApplicationError, void> {
    if (!input.conversationId || input.conversationId.trim().length === 0) {
      return left(new ValidationError('Conversation ID is required', 'conversationId'));
    }

    if (input.limit !== undefined) {
      if (input.limit < 1 || input.limit > 100) {
        return left(new ValidationError('Limit must be between 1 and 100', 'limit'));
      }
    }

    return right(undefined);
  }

  /**
   * Map a Conversation entity to the output DTO.
   */
  private mapToOutputDto(conversation: Conversation): ConversationHistoryOutputDto {
    const messages: MessageOutputDto[] = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Get the timestamp of the last message, or use updatedAt if no messages
    const lastMessageAt =
      messages.length > 0 ? messages[messages.length - 1].timestamp : conversation.updatedAt;

    return {
      conversationId: conversation.id.toString(),
      messages,
      currentOrderId: conversation.currentOrderId?.toString() ?? null,
      messageCount: conversation.messageCount,
      createdAt: conversation.createdAt,
      lastMessageAt,
    };
  }

  /**
   * Get the welcome message for new conversations.
   */
  private getWelcomeMessage(): string {
    return (
      "Welcome to Starbucks! ☕ I'm your AI barista, here to help you find " +
      'the perfect drink. You can ask me about our menu, get recommendations, ' +
      'or place an order. What can I get started for you today?'
    );
  }

  /**
   * Get suggested prompts for new conversations.
   */
  private getSuggestedPrompts(): string[] {
    return [
      "What's your most popular drink?",
      "I'd like something sweet with caramel",
      'What iced drinks do you have?',
      'Can you recommend something with oat milk?',
      'I need something with lots of caffeine',
    ];
  }
}

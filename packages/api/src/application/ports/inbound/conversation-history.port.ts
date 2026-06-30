import {
  ConversationHistoryOutputDto,
  GetConversationHistoryInputDto,
  StartConversationInputDto,
  StartConversationOutputDto,
} from '@application/dtos';
import { Either } from '@application/common';
import { ApplicationError } from '@application/errors';

export interface IConversationHistoryPort {
  /**
   * Get the conversation history.
   *
   * @param input - Conversation ID and optional message limit
   * @returns Promise resolving to conversation history
   */
  execute(
    input: GetConversationHistoryInputDto,
  ): Promise<Either<ApplicationError, ConversationHistoryOutputDto>>;

  /**
   * Start a new conversation.
   *
   * @param input - Optional initial message
   * @returns Promise resolving to new conversation details
   */
  startConversation(
    input: StartConversationInputDto,
  ): Promise<Either<ApplicationError, StartConversationOutputDto>>;

  /**
   * Check if a conversation exists.
   *
   * @param conversationId - The conversation ID to check
   * @returns Promise resolving to true if exists
   */
  exists(conversationId: string): Promise<boolean>;

  /**
   * Delete a conversation.
   *
   * @param conversationId - The conversation ID to delete
   * @returns Promise resolving to true if deleted
   */
  deleteConversation(conversationId: string): Promise<Either<ApplicationError, boolean>>;
}

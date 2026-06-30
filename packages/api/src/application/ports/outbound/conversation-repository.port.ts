import { ConversationId } from '@domain/value-objects';
import { Conversation } from '@domain/entities';

export interface IConversationRepositoryPort {
  /**
   * Persists a conversation to storage.
   * If the conversation already exists, it will be updated with new messages.
   *
   * @param conversation - The conversation entity to save
   * @returns Promise that resolves when saved successfully
   */
  save(conversation: Conversation): Promise<void>;

  /**
   * Retrieves a conversation by its unique identifier.
   *
   * @param id - The conversation's unique identifier (thread_id)
   * @returns Promise resolving to the conversation if found, null otherwise
   */
  findById(id: ConversationId): Promise<Conversation | null>;

  /**
   * Retrieves the most recent messages from a conversation.
   * This is optimized for providing context to the AI without loading
   * the entire conversation history.
   *
   * @param id - The conversation's unique identifier
   * @param limit - Maximum number of messages to retrieve (default: 10)
   * @returns Promise resolving to the conversation with limited messages
   */
  getRecentHistory(id: ConversationId, limit?: number): Promise<Conversation | null>;

  /**
   * Deletes a conversation and all its messages.
   * Use with caution - this permanently removes the conversation history.
   *
   * @param id - The conversation's unique identifier
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(id: ConversationId): Promise<boolean>;

  /**
   * Checks if a conversation exists without loading its full content.
   * Useful for validation before operations.
   *
   * @param id - The conversation's unique identifier
   * @returns Promise resolving to true if exists, false otherwise
   */
  exists(id: ConversationId): Promise<boolean>;
}

import { Order } from '@domain/entities';
import { OrderId } from '@domain/value-objects';

export interface IOrderRepositoryPort {
  /**
   * Persists an order to the storage.
   * If the order already exists, it will be updated.
   *
   * @param order - The order entity to save
   * @returns Promise that resolves when the order is saved
   * @throws RepositoryException if the save operation fails
   */
  save(order: Order): Promise<void>;

  /**
   * Persists an order with an associated conversation ID.
   * This is the preferred method when creating new orders as it establishes
   * the relationship between the order and its conversation context.
   *
   * @param order - The order entity to save
   * @param conversationId - The conversation this order belongs to
   * @returns Promise that resolves when the order is saved
   * @throws RepositoryException if the save operation fails
   */
  saveWithConversation(order: Order, conversationId: string): Promise<void>;

  /**
   * Retrieves an order by its unique identifier.
   *
   * @param id - The order's unique identifier
   * @returns Promise resolving to the order if found, null otherwise
   */
  findById(id: OrderId): Promise<Order | null>;

  /**
   * Retrieves all orders for a specific user/conversation.
   * Orders are returned in descending order by creation date (newest first).
   *
   * @param conversationId - The conversation/user identifier
   * @returns Promise resolving to an array of orders (empty if none found)
   */
  findByConversationId(conversationId: string): Promise<Order[]>;

  /**
   * Retrieves orders that are currently active (pending or confirmed).
   * Useful for finding orders that can still be modified or completed.
   *
   * @param conversationId - The conversation/user identifier
   * @returns Promise resolving to the active order if found, null otherwise
   */
  findActiveByConversationId(conversationId: string): Promise<Order | null>;

  /**
   * Deletes an order from storage.
   * This is typically used for cancelled orders or cleanup operations.
   *
   * @param id - The order's unique identifier
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(id: OrderId): Promise<boolean>;
}

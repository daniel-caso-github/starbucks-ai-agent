import {
  AddItemInputDto,
  ManageOrderResultDto,
  OrderActionInputDto,
  RemoveItemInputDto,
  UpdateItemInputDto,
} from '@application/dtos/manage-order.dto';
import { OrderSummaryDto } from '@application/dtos';

export interface IManageOrderPort {
  /**
   * Adds an item to the current order.
   * If no order exists for the conversation, one will be created.
   *
   * @param input - The item details to add
   * @returns Promise resolving to the operation result
   *
   * @example
   * ```typescript
   * const result = await manageOrder.addItem({
   *   conversationId: 'conv_123',
   *   drinkId: 'drk_456',
   *   quantity: 2,
   *   size: 'grande',
   *   customizations: { milk: 'oat' },
   * });
   * ```
   */
  addItem(input: AddItemInputDto): Promise<ManageOrderResultDto>;

  /**
   * Updates an existing item in the order.
   * Only the provided fields will be updated.
   *
   * @param input - The update details
   * @returns Promise resolving to the operation result
   * @throws If the item doesn't exist in the order
   */
  updateItem(input: UpdateItemInputDto): Promise<ManageOrderResultDto>;

  /**
   * Removes an item from the order.
   *
   * @param input - The item to remove
   * @returns Promise resolving to the operation result
   * @throws If the item doesn't exist in the order
   */
  removeItem(input: RemoveItemInputDto): Promise<ManageOrderResultDto>;

  /**
   * Confirms the current order, transitioning it from 'pending' to 'confirmed'.
   * The order must have at least one item to be confirmed.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   * @throws If no pending order exists or order is empty
   */
  confirmOrder(input: OrderActionInputDto): Promise<ManageOrderResultDto>;

  /**
   * Cancels the current order.
   * Only pending or confirmed orders can be cancelled.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   * @throws If no order exists or order is already completed
   */
  cancelOrder(input: OrderActionInputDto): Promise<ManageOrderResultDto>;

  /**
   * Retrieves the current order for a conversation.
   * Returns null if no active order exists.
   *
   * @param conversationId - The conversation identifier
   * @returns Promise resolving to the order summary or null
   */
  getCurrentOrder(conversationId: string): Promise<OrderSummaryDto | null>;

  /**
   * Clears all items from the current order without cancelling it.
   * The order remains in 'pending' state but empty.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   */
  clearOrder(input: OrderActionInputDto): Promise<ManageOrderResultDto>;
}

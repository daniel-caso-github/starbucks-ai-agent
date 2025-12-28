import { OrderSummary } from './process-message.port';

/**
 * Input for adding an item to an order.
 */
export interface AddItemInput {
  /** Conversation/order context identifier */
  conversationId: string;

  /** The drink to add */
  drinkId: string;

  /** Quantity to add (default: 1) */
  quantity?: number;

  /** Selected size */
  size?: 'tall' | 'grande' | 'venti';

  /** Customizations to apply */
  customizations?: {
    milk?: string;
    syrup?: string;
    sweetener?: string;
    topping?: string;
  };
}

/**
 * Input for updating an item in the order.
 */
export interface UpdateItemInput {
  /** Conversation/order context identifier */
  conversationId: string;

  /** The drink item to update */
  drinkId: string;

  /** New quantity (if provided) */
  quantity?: number;

  /** New size (if provided) */
  size?: 'tall' | 'grande' | 'venti';

  /** Updated customizations (merged with existing) */
  customizations?: {
    milk?: string;
    syrup?: string;
    sweetener?: string;
    topping?: string;
  };
}

/**
 * Input for removing an item from the order.
 */
export interface RemoveItemInput {
  /** Conversation/order context identifier */
  conversationId: string;

  /** The drink item to remove */
  drinkId: string;
}

/**
 * Input for order lifecycle operations.
 */
export interface OrderActionInput {
  /** Conversation/order context identifier */
  conversationId: string;
}

/**
 * Result of an order management operation.
 */
export interface ManageOrderResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Human-readable message about the operation */
  message: string;

  /** Updated order summary after the operation */
  order: OrderSummary | null;
}

/**
 * Inbound port for direct order management operations.
 *
 * While IProcessMessage handles conversational ordering through AI,
 * this port provides direct programmatic control over orders.
 * It's useful for:
 * - UI buttons (Confirm, Cancel, Remove Item)
 * - API integrations
 * - Admin operations
 * - Testing
 *
 * All operations validate business rules through the domain layer,
 * so invalid operations (like confirming an empty order) will fail
 * with appropriate error messages.
 *
 * @example
 * ```typescript
 * // In a controller with "Confirm Order" button:
 * @Post('orders/:conversationId/confirm')
 * async confirmOrder(@Param('conversationId') conversationId: string) {
 *   const result = await this.manageOrder.confirmOrder({ conversationId });
 *
 *   if (!result.success) {
 *     throw new BadRequestException(result.message);
 *   }
 *
 *   return result.order;
 * }
 * ```
 */
export interface IManageOrder {
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
  addItem(input: AddItemInput): Promise<ManageOrderResult>;

  /**
   * Updates an existing item in the order.
   * Only the provided fields will be updated.
   *
   * @param input - The update details
   * @returns Promise resolving to the operation result
   * @throws If the item doesn't exist in the order
   */
  updateItem(input: UpdateItemInput): Promise<ManageOrderResult>;

  /**
   * Removes an item from the order.
   *
   * @param input - The item to remove
   * @returns Promise resolving to the operation result
   * @throws If the item doesn't exist in the order
   */
  removeItem(input: RemoveItemInput): Promise<ManageOrderResult>;

  /**
   * Confirms the current order, transitioning it from 'pending' to 'confirmed'.
   * The order must have at least one item to be confirmed.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   * @throws If no pending order exists or order is empty
   */
  confirmOrder(input: OrderActionInput): Promise<ManageOrderResult>;

  /**
   * Cancels the current order.
   * Only pending or confirmed orders can be cancelled.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   * @throws If no order exists or order is already completed
   */
  cancelOrder(input: OrderActionInput): Promise<ManageOrderResult>;

  /**
   * Retrieves the current order for a conversation.
   * Returns null if no active order exists.
   *
   * @param conversationId - The conversation identifier
   * @returns Promise resolving to the order summary or null
   */
  getCurrentOrder(conversationId: string): Promise<OrderSummary | null>;

  /**
   * Clears all items from the current order without cancelling it.
   * The order remains in 'pending' state but empty.
   *
   * @param input - The conversation identifier
   * @returns Promise resolving to the operation result
   */
  clearOrder(input: OrderActionInput): Promise<ManageOrderResult>;
}

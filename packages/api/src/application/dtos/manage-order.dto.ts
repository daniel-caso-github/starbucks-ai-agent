import { OrderSummaryDto } from '@application/dtos';

/**
 * Input for adding an item to an order.
 */
export interface AddItemInputDto {
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
export interface UpdateItemInputDto {
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
export interface RemoveItemInputDto {
  /** Conversation/order context identifier */
  conversationId: string;

  /** The drink item to remove */
  drinkId: string;
}

/**
 * Input for order lifecycle operations.
 */
export interface OrderActionInputDto {
  /** Conversation/order context identifier */
  conversationId: string;
}

/**
 * Result of an order management operation.
 */
export interface ManageOrderResultDto {
  /** Whether the operation was successful */
  success: boolean;

  /** Human-readable message about the operation */
  message: string;

  /** Updated order summary after the operation */
  order: OrderSummaryDto | null;
}

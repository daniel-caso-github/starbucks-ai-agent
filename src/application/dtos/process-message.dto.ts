import { ConversationIntentType } from '@application/dtos/conversation-ai.dto';

/**
 * Input data for processing a user message.
 */
export interface ProcessMessageInputDto {
  /** The user's message to process */
  message: string;

  /**
   * Optional conversation ID to continue an existing conversation.
   * If not provided, a new conversation will be created.
   */
  conversationId?: string;

  /** Optional user identifier for personalization */
  userId?: string;
}

/**
 * Output data from processing a user message.
 */
export interface ProcessMessageOutputDto {
  /** The AI barista's response message */
  response: string;

  /** The conversation ID (new or existing) */
  conversationId: string;

  /** The detected intent from the user's message */
  intent: ConversationIntentType;

  /** Current order summary, if an order is in progress */
  currentOrder: OrderSummaryDto | null;

  /** Suggested quick replies for the user */
  suggestedReplies: string[];
}

/**
 * Summary of the current order state.
 * This is a DTO, not a domain entity.
 */
export interface OrderSummaryDto {
  /** Order identifier */
  orderId: string;

  /** Current order status */
  status: string;

  /** List of items in the order */
  items: OrderItemSummaryDto[];

  /** Total price formatted as string (e.g., "$15.50") */
  totalPrice: string;

  /** Total number of items */
  itemCount: number;

  /** Whether the order can be confirmed */
  canConfirm: boolean;
}

/**
 * Summary of an item in the order.
 */
export interface OrderItemSummaryDto {
  /** 1-based index of the item in the order (for user reference) */
  index: number;

  /** Name of the drink */
  drinkName: string;

  /** Size, if applicable */
  size: string | null;

  /** Quantity ordered */
  quantity: number;

  /** Price for this line item */
  price: string;

  /** Applied customizations */
  customizations: {
    milk?: string;
    syrup?: string;
    sweetener?: string;
    topping?: string;
  };
}

import { DrinkCustomizations, DrinkSize } from '@domain/value-objects';
import { Drink } from '@domain/entities';

/**
 * Represents the AI's intent detection from a user message.
 * The AI analyzes what the user wants to do.
 */
export type ConversationIntentType =
  | 'order_drink' // User wants to order a drink
  | 'modify_order' // User wants to change their current order
  | 'cancel_order' // User wants to cancel the order
  | 'confirm_order' // User wants to confirm/complete the order
  | 'process_payment' // User wants to proceed to payment (order already confirmed)
  | 'ask_question' // User is asking about menu, prices, etc.
  | 'greeting' // User is greeting or starting conversation
  | 'unknown'; // Intent could not be determined

/**
 * Actions the application might take based on AI response.
 */
export interface SuggestedActionType {
  /** Type of action to take */
  type:
    | 'add_item'
    | 'remove_item'
    | 'update_item'
    | 'update_quantity'
    | 'confirm_order'
    | 'cancel_order'
    | 'search_drinks'
    | 'get_summary'
    | 'get_full_menu'
    | 'get_drink_details'
    | 'ask_clarification';

  /** Additional data for the action */
  payload?: Record<string, unknown>;
}

/**
 * Represents extracted order information from user message.
 * This is what the AI parsed from natural language.
 */
export interface ExtractedOrderInfoDto {
  /** The drink name mentioned by the user */
  drinkName: string | null;

  /** The size mentioned (e.g., "large" -> "venti") */
  size: DrinkSize | null;

  /** Quantity requested (default: 1) */
  quantity: number;

  /** Customizations mentioned */
  customizations: DrinkCustomizations;

  /** Confidence score 0-1 for this extraction */
  confidence: number;
}

/**
 * Represents a single extracted order item.
 * Used when extracting multiple items from a single message.
 */
export interface ExtractedOrderItemDto {
  /** The drink name mentioned by the user */
  drinkName: string;

  /** The size mentioned (e.g., "large" -> "venti") */
  size: DrinkSize | null;

  /** Quantity requested (default: 1) */
  quantity: number;

  /** Customizations mentioned */
  customizations: DrinkCustomizations;

  /** Confidence score 0-1 for this extraction */
  confidence: number;
}

/**
 * Container for multiple extracted order items.
 * Allows ordering multiple drinks in a single message.
 */
export interface ExtractedOrdersDto {
  /** Array of extracted order items */
  items: ExtractedOrderItemDto[];
}

/**
 * Represents an extracted modification request.
 * Used when the user wants to modify or remove an existing item.
 */
export interface ExtractedModificationDto {
  /** The type of modification */
  action: 'modify' | 'remove';

  /** The drink name to modify (optional if itemIndex is provided) */
  drinkName?: string;

  /** 1-based index of the item to modify (optional if drinkName is provided) */
  itemIndex?: number;

  /** Changes to apply (only for 'modify' action) */
  changes?: {
    newQuantity?: number;
    newSize?: DrinkSize;
    addCustomizations?: DrinkCustomizations;
    removeCustomizations?: (keyof DrinkCustomizations)[];
  };

  /** Confidence score 0-1 for this extraction */
  confidence: number;
}

/**
 * Input for generating an AI response.
 */
export interface GenerateResponseInputDto {
  /** The user's current message */
  userMessage: string;

  /** Recent conversation history for context */
  conversationHistory: string;

  /** Relevant drinks found by semantic search (for RAG) */
  relevantDrinks: Drink[];

  /** Current order summary, if any */
  currentOrderSummary: string | null;
}

/**
 * The AI's generated response with metadata.
 */
export interface GenerateResponseOutputDto {
  /** The text response to send to the user */
  message: string;

  /** Detected intent from the user's message */
  intent: ConversationIntentType;

  /** Extracted order information, if any (legacy single item) */
  extractedOrder: ExtractedOrderInfoDto | null;

  /** Extracted orders - supports multiple items in a single message */
  extractedOrders: ExtractedOrdersDto | null;

  /** Extracted modifications - supports modify/remove operations */
  extractedModifications: ExtractedModificationDto[];

  /** Suggested follow-up actions for the application */
  suggestedActions: SuggestedActionType[];
}

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
    | 'update_quantity'
    | 'confirm_order'
    | 'cancel_order'
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

  /** Extracted order information, if any */
  extractedOrder: ExtractedOrderInfoDto | null;

  /** Suggested follow-up actions for the application */
  suggestedActions: SuggestedActionType[];
}

import { Drink } from '@domain/entities';
import { DrinkCustomizations, DrinkSize } from '@domain/value-objects';

/**
 * Represents the AI's intent detection from a user message.
 * The AI analyzes what the user wants to do.
 */
export type ConversationIntent =
  | 'order_drink' // User wants to order a drink
  | 'modify_order' // User wants to change their current order
  | 'cancel_order' // User wants to cancel the order
  | 'confirm_order' // User wants to confirm/complete the order
  | 'ask_question' // User is asking about menu, prices, etc.
  | 'greeting' // User is greeting or starting conversation
  | 'unknown'; // Intent could not be determined

/**
 * Represents extracted order information from user message.
 * This is what the AI parsed from natural language.
 */
export interface ExtractedOrderInfo {
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
export interface GenerateResponseInput {
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
export interface GenerateResponseOutput {
  /** The text response to send to the user */
  message: string;

  /** Detected intent from the user's message */
  intent: ConversationIntent;

  /** Extracted order information, if any */
  extractedOrder: ExtractedOrderInfo | null;

  /** Suggested follow-up actions for the application */
  suggestedActions: SuggestedAction[];
}

/**
 * Actions the application might take based on AI response.
 */
export interface SuggestedAction {
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
 * Outbound port for AI conversation capabilities.
 *
 * This interface abstracts the interaction with the language model (Claude).
 * It handles both response generation and natural language understanding
 * tasks like intent detection and order extraction.
 *
 * The implementation will use Claude's API with carefully crafted prompts
 * to act as a Starbucks barista.
 *
 * @example
 * ```typescript
 * // In ProcessMessageUseCase:
 * const aiResponse = await this.conversationAI.generateResponse({
 *   userMessage: "I'd like a large caramel latte with oat milk",
 *   conversationHistory: conversation.getMessagesForContext(),
 *   relevantDrinks: searchResults.map(r => r.drink),
 *   currentOrderSummary: order?.toSummary() ?? null,
 * });
 *
 * if (aiResponse.intent === 'order_drink' && aiResponse.extractedOrder) {
 *   // Process the order...
 * }
 * ```
 */
export interface IConversationAI {
  /**
   * Generates a barista response to the user's message.
   * This is the main method that combines response generation
   * with intent detection and order extraction.
   *
   * The method uses RAG (Retrieval Augmented Generation) by
   * including relevant drinks in the context.
   *
   * @param input - The context needed to generate a response
   * @returns Promise resolving to the AI response with metadata
   */
  generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput>;

  /**
   * Extracts order information from a user message.
   * Use this when you need to re-parse a message or
   * validate extracted information.
   *
   * @param message - The user's message to parse
   * @param availableDrinks - Drinks to match against
   * @returns Promise resolving to extracted order info
   */
  extractOrderFromMessage(
    message: string,
    availableDrinks: Drink[],
  ): Promise<ExtractedOrderInfo | null>;

  /**
   * Detects the user's intent from their message.
   * Useful for routing logic before full response generation.
   *
   * @param message - The user's message
   * @param conversationHistory - Recent conversation for context
   * @returns Promise resolving to the detected intent
   */
  detectIntent(message: string, conversationHistory?: string): Promise<ConversationIntent>;

  /**
   * Validates if a message contains a valid drink order.
   * Quick check without full extraction.
   *
   * @param message - The user's message
   * @returns Promise resolving to true if message appears to contain an order
   */
  containsOrderIntent(message: string): Promise<boolean>;
}

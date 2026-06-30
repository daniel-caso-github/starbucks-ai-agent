import { Drink } from '@domain/entities';
import {
  ConversationIntentType,
  ExtractedOrderInfoDto,
  GenerateResponseInputDto,
  GenerateResponseOutputDto,
} from '@application/dtos/conversation-ai.dto';

export interface IConversationAIPort {
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
  generateResponse(input: GenerateResponseInputDto): Promise<GenerateResponseOutputDto>;

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
  ): Promise<ExtractedOrderInfoDto | null>;

  /**
   * Detects the user's intent from their message.
   * Useful for routing logic before full response generation.
   *
   * @param message - The user's message
   * @param conversationHistory - Recent conversation for context
   * @returns Promise resolving to the detected intent
   */
  detectIntent(message: string, conversationHistory?: string): Promise<ConversationIntentType>;

  /**
   * Validates if a message contains a valid drink order.
   * Quick check without full extraction.
   *
   * @param message - The user's message
   * @returns Promise resolving to true if message appears to contain an order
   */
  containsOrderIntent(message: string): Promise<boolean>;

  /**
   * Generates a streaming barista response.
   * Yields text chunks as they arrive from the AI, then returns
   * the final response with extracted actions.
   *
   * @param input - The context needed to generate a response
   * @yields Text chunks as they arrive
   * @returns Final response with extracted actions after streaming completes
   */
  generateResponseStream?(
    input: GenerateResponseInputDto,
  ): AsyncGenerator<string, GenerateResponseOutputDto, unknown>;
}

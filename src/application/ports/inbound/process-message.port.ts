import { ConversationIntent } from '@application/ports';

/**
 * Input data for processing a user message.
 */
export interface ProcessMessageInput {
  /** Unique identifier for the conversation thread */
  conversationId: string;

  /** The user's message to process */
  message: string;

  /** Optional user identifier for personalization */
  userId?: string;
}

/**
 * Output data from processing a user message.
 */
export interface ProcessMessageOutput {
  /** The AI barista's response message */
  response: string;

  /** The detected intent from the user's message */
  intent: ConversationIntent;

  /** Current order summary, if an order is in progress */
  currentOrder: OrderSummary | null;

  /** Suggested quick replies for the user */
  suggestedReplies: string[];
}

/**
 * Summary of the current order state.
 * This is a DTO, not a domain entity.
 */
export interface OrderSummary {
  /** Order identifier */
  orderId: string;

  /** List of items in the order */
  items: OrderItemSummary[];

  /** Total price formatted as string (e.g., "$15.50") */
  totalPrice: string;

  /** Current order status */
  status: string;

  /** Whether the order can be confirmed */
  canConfirm: boolean;
}

/**
 * Summary of an item in the order.
 */
export interface OrderItemSummary {
  /** Name of the drink */
  drinkName: string;

  /** Size, if applicable */
  size: string | null;

  /** Quantity ordered */
  quantity: number;

  /** Price for this line item */
  price: string;

  /** Applied customizations */
  customizations: string[];
}

/**
 * Inbound port for processing user messages.
 *
 * This is the main entry point for the AI barista conversation.
 * It orchestrates the entire flow of receiving a message,
 * understanding it, updating the order, and generating a response.
 *
 * The implementation (ProcessMessageUseCase) will:
 * 1. Load or create the conversation
 * 2. Search for relevant drinks (RAG)
 * 3. Generate AI response with intent detection
 * 4. Update order based on detected intent
 * 5. Save conversation and order state
 * 6. Return response to user
 *
 * @example
 * ```typescript
 * // In a controller:
 * @Post('message')
 * async handleMessage(@Body() body: MessageDto) {
 *   const result = await this.processMessage.execute({
 *     conversationId: body.threadId,
 *     message: body.text,
 *     userId: body.userId,
 *   });
 *
 *   return {
 *     reply: result.response,
 *     order: result.currentOrder,
 *   };
 * }
 * ```
 */
export interface IProcessMessage {
  /**
   * Processes a user message and generates an AI response.
   * This is the main method that orchestrates the entire conversation flow.
   *
   * @param input - The message input data
   * @returns Promise resolving to the processing result
   * @throws ApplicationException if processing fails
   */
  execute(input: ProcessMessageInput): Promise<ProcessMessageOutput>;
}

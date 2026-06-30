/**
 * DTOs for conversation-related use cases.
 */

/**
 * Input for getting conversation history.
 */
export interface GetConversationHistoryInputDto {
  readonly conversationId: string;
  readonly limit?: number;
}

/**
 * A single message in the conversation.
 */
export interface MessageOutputDto {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: Date;
}

/**
 * Output with conversation history.
 */
export interface ConversationHistoryOutputDto {
  readonly conversationId: string;
  readonly messages: MessageOutputDto[];
  readonly currentOrderId: string | null;
  readonly messageCount: number;
  readonly createdAt: Date;
  readonly lastMessageAt: Date;
}

/**
 * Input for starting a new conversation.
 */
export interface StartConversationInputDto {
  /** Optional greeting message from the user */
  readonly initialMessage?: string;
}

/**
 * Output when starting a new conversation.
 */
export interface StartConversationOutputDto {
  readonly conversationId: string;
  readonly welcomeMessage: string;
  readonly suggestedPrompts: string[];
}

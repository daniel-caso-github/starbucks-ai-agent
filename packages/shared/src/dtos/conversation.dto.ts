export interface MessageDto {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: Date;
}

export interface ConversationHistoryDto {
  readonly conversationId: string;
  readonly messages: MessageDto[];
  readonly currentOrderId: string | null;
  readonly messageCount: number;
  readonly createdAt: Date;
  readonly lastMessageAt: Date;
}

import { ConversationId, Message, OrderId } from '../value-objects';

/**
 * Entity representing a conversation between user and the barista AI.
 * Maintains chat history and tracks the current order being built.
 */
export class Conversation {
  private static readonly MAX_MESSAGES = 50;

  private constructor(
    public readonly id: ConversationId,
    private _messages: Message[],
    private _currentOrderId: OrderId | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(id?: ConversationId): Conversation {
    const now = new Date();
    return new Conversation(id ?? ConversationId.generate(), [], null, now, now);
  }

  static reconstitute(props: {
    id: ConversationId;
    messages: Message[];
    currentOrderId: OrderId | null;
    createdAt: Date;
    updatedAt: Date;
  }): Conversation {
    return new Conversation(
      props.id,
      props.messages,
      props.currentOrderId,
      props.createdAt,
      props.updatedAt,
    );
  }

  get messages(): readonly Message[] {
    return [...this._messages];
  }

  get currentOrderId(): OrderId | null {
    return this._currentOrderId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get messageCount(): number {
    return this._messages.length;
  }

  // Add a user message to the conversation
  addUserMessage(content: string): void {
    this.addMessage(Message.create('user', content));
  }

  // Add an assistant message to the conversation
  addAssistantMessage(content: string): void {
    this.addMessage(Message.create('assistant', content));
  }

  private addMessage(message: Message): void {
    // If we've reached the limit, remove oldest messages (keep recent context)
    if (this._messages.length >= Conversation.MAX_MESSAGES) {
      this._messages = this._messages.slice(-Conversation.MAX_MESSAGES + 1);
    }

    this._messages.push(message);
    this.touch();
  }

  // Associate an order with this conversation
  setCurrentOrder(orderId: OrderId): void {
    this._currentOrderId = orderId;
    this.touch();
  }

  // Clear the current order (after completion or cancellation)
  clearCurrentOrder(): void {
    this._currentOrderId = null;
    this.touch();
  }

  // Check if conversation has an active order
  hasActiveOrder(): boolean {
    return this._currentOrderId !== null;
  }

  // Get the last N messages (useful for AI context)
  getRecentMessages(count: number): readonly Message[] {
    const start = Math.max(0, this._messages.length - count);
    return this._messages.slice(start);
  }

  // Get messages formatted for AI context
  getMessagesForContext(maxMessages = 10): string {
    const recent = this.getRecentMessages(maxMessages);
    return recent.map((msg) => msg.toString()).join('\n');
  }

  // Get the last message from user
  getLastUserMessage(): Message | null {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].isFromUser()) {
        return this._messages[i];
      }
    }
    return null;
  }

  // Check if conversation is empty
  isEmpty(): boolean {
    return this._messages.length === 0;
  }

  // Entity equality
  equals(other: Conversation): boolean {
    return this.id.equals(other.id);
  }

  // Generate summary for debugging/logging
  toSummary(): string {
    const orderInfo = this._currentOrderId
      ? `Active order: ${this._currentOrderId.toString()}`
      : 'No active order';

    return `Conversation ${this.id.toString()} - ${this._messages.length} messages. ${orderInfo}`;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

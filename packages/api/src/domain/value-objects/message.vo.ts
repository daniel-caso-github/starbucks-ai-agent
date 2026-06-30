import { InvalidValueException } from '../exceptions';

/**
 * Represents who sent the message.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Value Object representing a single message in a conversation.
 * Immutable record of what was said and by whom.
 */
export class Message {
  private constructor(
    public readonly role: MessageRole,
    public readonly content: string,
    public readonly timestamp: Date,
  ) {
    this.validate();
  }

  static create(role: MessageRole, content: string): Message {
    return new Message(role, content, new Date());
  }

  static reconstitute(role: MessageRole, content: string, timestamp: Date): Message {
    return new Message(role, content, timestamp);
  }

  private validate(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new InvalidValueException('Message', 'content cannot be empty');
    }
    if (!['user', 'assistant'].includes(this.role)) {
      throw new InvalidValueException('Message', `invalid role: ${this.role}`);
    }
  }

  isFromUser(): boolean {
    return this.role === 'user';
  }

  isFromAssistant(): boolean {
    return this.role === 'assistant';
  }

  equals(other: Message): boolean {
    return (
      this.role === other.role &&
      this.content === other.content &&
      this.timestamp.getTime() === other.timestamp.getTime()
    );
  }

  toString(): string {
    return `[${this.role}]: ${this.content}`;
  }
}

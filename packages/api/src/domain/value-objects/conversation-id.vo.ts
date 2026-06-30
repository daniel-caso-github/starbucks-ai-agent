import { randomUUID } from 'crypto';
import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing a unique conversation identifier.
 * This is the "thread_id" that maintains conversation context.
 */
export class ConversationId {
  private constructor(public readonly value: string) {
    this.validate();
  }

  static fromString(id: string): ConversationId {
    return new ConversationId(id);
  }

  static generate(): ConversationId {
    const uuid = randomUUID();
    return new ConversationId(`conv_${uuid}`);
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidValueException('ConversationId', 'cannot be empty');
    }
  }

  equals(other: ConversationId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

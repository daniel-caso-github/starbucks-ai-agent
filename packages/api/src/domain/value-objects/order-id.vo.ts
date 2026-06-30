import { randomUUID } from 'crypto';
import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing a unique order identifier.
 * Immutable - once created, cannot be changed.
 */
export class OrderId {
  // Public constructor forces use of factory methods
  private constructor(public readonly value: string) {
    this.validate();
  }

  // Factory method: create from existing string (e.g., from database)
  static fromString(id: string): OrderId {
    return new OrderId(id);
  }

  // Factory method: generate new unique ID
  static generate(): OrderId {
    const uuid = randomUUID();
    return new OrderId(`ord_${uuid}`);
  }

  // Validation: ensure ID format is correct
  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidValueException('OrderId', 'cannot be empty');
    }
  }

  // Compare with another OrderId
  equals(other: OrderId): boolean {
    return this.value === other.value;
  }

  // Convert to string for persistence/display
  toString(): string {
    return this.value;
  }
}

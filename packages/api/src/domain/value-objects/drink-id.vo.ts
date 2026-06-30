import { randomUUID } from 'crypto';
import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing a unique drink identifier.
 */
export class DrinkId {
  private constructor(public readonly value: string) {
    this.validate();
  }

  static fromString(id: string): DrinkId {
    return new DrinkId(id);
  }

  static generate(): DrinkId {
    const uuid = randomUUID();
    return new DrinkId(`drk_${uuid}`);
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidValueException('DrinkId', 'cannot be empty');
    }
  }

  equals(other: DrinkId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

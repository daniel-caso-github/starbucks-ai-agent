import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing the status of an order.
 * Orders follow a specific lifecycle: pending → confirmed → completed (or cancelled)
 */
export class OrderStatus {
  private static readonly VALID_STATUSES = [
    'pending',
    'confirmed',
    'completed',
    'cancelled',
  ] as const;

  private constructor(public readonly value: string) {
    this.validate();
  }

  // Factory methods for each status
  static pending(): OrderStatus {
    return new OrderStatus('pending');
  }

  static confirmed(): OrderStatus {
    return new OrderStatus('confirmed');
  }

  static completed(): OrderStatus {
    return new OrderStatus('completed');
  }

  static cancelled(): OrderStatus {
    return new OrderStatus('cancelled');
  }

  static fromString(status: string): OrderStatus {
    const normalized = status.toLowerCase().trim();
    if (
      !OrderStatus.VALID_STATUSES.includes(
        normalized as (typeof OrderStatus.VALID_STATUSES)[number],
      )
    ) {
      throw new InvalidValueException(
        'OrderStatus',
        `"${status}" is not valid. Valid statuses: ${OrderStatus.VALID_STATUSES.join(', ')}`,
      );
    }
    return new OrderStatus(normalized);
  }

  private validate(): void {
    if (
      !OrderStatus.VALID_STATUSES.includes(
        this.value as (typeof OrderStatus.VALID_STATUSES)[number],
      )
    ) {
      throw new InvalidValueException('OrderStatus', `"${this.value}" is not a valid status`);
    }
  }

  // Status checks
  isPending(): boolean {
    return this.value === 'pending';
  }

  isConfirmed(): boolean {
    return this.value === 'confirmed';
  }

  isCompleted(): boolean {
    return this.value === 'completed';
  }

  isCancelled(): boolean {
    return this.value === 'cancelled';
  }

  // Business rule: can this order still be modified?
  canBeModified(): boolean {
    return this.value === 'pending';
  }

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

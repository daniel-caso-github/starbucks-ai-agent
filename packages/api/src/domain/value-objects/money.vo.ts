import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing monetary values.
 * Stores amounts in cents to avoid floating-point issues.
 * Immutable - all operations return new Money instances.
 */
export class Money {
  private constructor(public readonly cents: number, public readonly currency: string = 'USD') {
    this.validate();
  }

  static fromCents(cents: number, currency = 'USD'): Money {
    return new Money(Math.round(cents), currency);
  }

  static fromDollars(dollars: number, currency = 'USD'): Money {
    return new Money(Math.round(dollars * 100), currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  private validate(): void {
    if (this.cents < 0) {
      throw new InvalidValueException('Money', 'amount cannot be negative');
    }
    if (!this.currency || this.currency.trim().length !== 3) {
      throw new InvalidValueException('Money', 'currency must be a 3-letter code');
    }
  }

  // Computed property using getter syntax
  get dollars(): number {
    return this.cents / 100;
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    const result = this.cents - other.cents;
    if (result < 0) {
      throw new InvalidValueException('Money', 'result cannot be negative');
    }
    return new Money(result, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidValueException(
        'Money',
        `cannot operate on different currencies: ${this.currency} vs ${other.currency}`,
      );
    }
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.cents > other.cents;
  }

  format(): string {
    const symbol = this.currency === 'USD' ? '$' : this.currency;
    return `${symbol}${this.dollars.toFixed(2)}`;
  }

  toString(): string {
    return this.format();
  }
}

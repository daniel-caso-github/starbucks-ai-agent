import { InvalidValueException } from '../exceptions';
import { DrinkId } from './drink-id.vo';
import { DrinkSize } from './drink-size.vo';
import { Money } from './money.vo';

/**
 * Represents the customizations applied to a drink.
 */
export interface DrinkCustomizations {
  milk?: string; // e.g., "oat", "almond", "whole"
  syrup?: string; // e.g., "vanilla", "caramel"
  sweetener?: string; // e.g., "sugar", "stevia"
  topping?: string; // e.g., "whipped cream", "chocolate drizzle"
}

/**
 * Value Object representing an item in an order.
 * Immutable - changes create a new OrderItem.
 */
export class OrderItem {
  private constructor(
    public readonly drinkId: DrinkId,
    public readonly drinkName: string,
    public readonly size: DrinkSize | null,
    public readonly quantity: number,
    public readonly unitPrice: Money,
    public readonly customizations: DrinkCustomizations,
  ) {
    this.validate();
  }

  static create(props: {
    drinkId: DrinkId;
    drinkName: string;
    size?: DrinkSize | null;
    quantity?: number;
    unitPrice: Money;
    customizations?: DrinkCustomizations;
  }): OrderItem {
    return new OrderItem(
      props.drinkId,
      props.drinkName,
      props.size ?? null,
      props.quantity ?? 1,
      props.unitPrice,
      props.customizations ?? {},
    );
  }

  private validate(): void {
    if (!this.drinkName || this.drinkName.trim().length === 0) {
      throw new InvalidValueException('OrderItem', 'drink name cannot be empty');
    }
    if (this.quantity < 1 || this.quantity > 10) {
      throw new InvalidValueException('OrderItem', 'quantity must be between 1 and 10');
    }
    if (!Number.isInteger(this.quantity)) {
      throw new InvalidValueException('OrderItem', 'quantity must be a whole number');
    }
  }

  // Calculate total price for this item (unit price * quantity)
  get totalPrice(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  // Create a new OrderItem with different quantity
  withQuantity(quantity: number): OrderItem {
    return new OrderItem(
      this.drinkId,
      this.drinkName,
      this.size,
      quantity,
      this.unitPrice,
      this.customizations,
    );
  }

  // Create a new OrderItem with different size
  withSize(size: DrinkSize): OrderItem {
    return new OrderItem(
      this.drinkId,
      this.drinkName,
      size,
      this.quantity,
      this.unitPrice,
      this.customizations,
    );
  }

  // Create a new OrderItem with updated customizations
  withCustomizations(customizations: DrinkCustomizations): OrderItem {
    return new OrderItem(this.drinkId, this.drinkName, this.size, this.quantity, this.unitPrice, {
      ...this.customizations,
      ...customizations,
    });
  }

  // Check if this item has any customizations
  hasCustomizations(): boolean {
    return Object.values(this.customizations).some((value) => value !== undefined);
  }

  // Value Object equality
  equals(other: OrderItem): boolean {
    return (
      this.drinkId.equals(other.drinkId) &&
      this.quantity === other.quantity &&
      (this.size === null
        ? other.size === null
        : this.size.equals(other.size ?? DrinkSize.tall())) &&
      JSON.stringify(this.customizations) === JSON.stringify(other.customizations)
    );
  }

  // Generate summary for display or AI context
  toSummary(): string {
    const parts: string[] = [];

    parts.push(`${this.quantity}x ${this.drinkName}`);

    if (this.size) {
      parts.push(`(${this.size.toString()})`);
    }

    const customizationList: string[] = [];
    if (this.customizations.milk) customizationList.push(`${this.customizations.milk} milk`);
    if (this.customizations.syrup) customizationList.push(`${this.customizations.syrup} syrup`);
    if (this.customizations.sweetener) customizationList.push(this.customizations.sweetener);
    if (this.customizations.topping) customizationList.push(this.customizations.topping);

    if (customizationList.length > 0) {
      parts.push(`with ${customizationList.join(', ')}`);
    }

    parts.push(`- ${this.totalPrice.format()}`);

    return parts.join(' ');
  }
}

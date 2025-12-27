import { InvalidOrderException } from '../exceptions';
import { DrinkSize, Money, OrderId, OrderItem, OrderStatus } from '../value-objects';

/**
 * Entity representing a customer order.
 * Aggregate root - controls access to OrderItems.
 */
export class Order {
  private static readonly MAX_TOTAL_ITEMS = 20;

  private constructor(
    public readonly id: OrderId,
    private _status: OrderStatus,
    private _items: OrderItem[],
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  // Factory method: create new order
  static create(id?: OrderId): Order {
    const now = new Date();
    return new Order(id ?? OrderId.generate(), OrderStatus.pending(), [], now, now);
  }

  // Factory method: reconstitute from persistence
  static reconstitute(props: {
    id: OrderId;
    status: OrderStatus;
    items: OrderItem[];
    createdAt: Date;
    updatedAt: Date;
  }): Order {
    return new Order(props.id, props.status, props.items, props.createdAt, props.updatedAt);
  }

  // Getters for encapsulated properties
  get status(): OrderStatus {
    return this._status;
  }

  get items(): readonly OrderItem[] {
    return [...this._items];
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Calculated property: total price of all items
  get totalPrice(): Money {
    if (this._items.length === 0) {
      return Money.zero();
    }
    return this._items.reduce((total, item) => total.add(item.totalPrice), Money.zero());
  }

  // Calculated property: total quantity of items
  get totalQuantity(): number {
    return this._items.reduce((total, item) => total + item.quantity, 0);
  }

  // Business logic: add item to order
  addItem(item: OrderItem): void {
    this.ensureCanBeModified();
    this.ensureQuantityLimit(item.quantity);

    // Check if same drink already exists (merge quantities)
    const existingIndex = this._items.findIndex(
      (existing) =>
        existing.drinkId.equals(item.drinkId) && this.haveSameCustomizations(existing, item),
    );

    if (existingIndex >= 0) {
      const existing = this._items[existingIndex];
      this._items[existingIndex] = existing.withQuantity(existing.quantity + item.quantity);
    } else {
      this._items.push(item);
    }

    this.touch();
  }

  // Business logic: remove item from order
  removeItem(drinkId: string): void {
    this.ensureCanBeModified();

    const index = this._items.findIndex((item) => item.drinkId.toString() === drinkId);

    if (index === -1) {
      throw new InvalidOrderException(`Item with drink ID "${drinkId}" not found in order`);
    }

    this._items.splice(index, 1);
    this.touch();
  }

  // Business logic: update item quantity
  updateItemQuantity(drinkId: string, quantity: number): void {
    this.ensureCanBeModified();

    const index = this._items.findIndex((item) => item.drinkId.toString() === drinkId);

    if (index === -1) {
      throw new InvalidOrderException(`Item with drink ID "${drinkId}" not found in order`);
    }

    if (quantity <= 0) {
      this._items.splice(index, 1);
    } else {
      const newTotalQuantity = this.totalQuantity - this._items[index].quantity + quantity;
      if (newTotalQuantity > Order.MAX_TOTAL_ITEMS) {
        throw new InvalidOrderException(
          `Cannot update quantity. Maximum total items is ${Order.MAX_TOTAL_ITEMS}`,
        );
      }
      this._items[index] = this._items[index].withQuantity(quantity);
    }

    this.touch();
  }

  // Business logic: confirm the order
  confirm(): void {
    if (!this._status.isPending()) {
      throw new InvalidOrderException('Only pending orders can be confirmed');
    }
    if (this._items.length === 0) {
      throw new InvalidOrderException('Cannot confirm an empty order');
    }

    this._status = OrderStatus.confirmed();
    this.touch();
  }

  // Business logic: complete the order
  complete(): void {
    if (!this._status.isConfirmed()) {
      throw new InvalidOrderException('Only confirmed orders can be completed');
    }

    this._status = OrderStatus.completed();
    this.touch();
  }

  // Business logic: cancel the order
  cancel(): void {
    if (this._status.isCompleted()) {
      throw new InvalidOrderException('Cannot cancel a completed order');
    }
    if (this._status.isCancelled()) {
      throw new InvalidOrderException('Order is already cancelled');
    }

    this._status = OrderStatus.cancelled();
    this.touch();
  }

  // Check if order is empty
  isEmpty(): boolean {
    return this._items.length === 0;
  }

  // Check if order can be confirmed
  canBeConfirmed(): boolean {
    return this._status.isPending() && this._items.length > 0;
  }

  // Entity equality
  equals(other: Order): boolean {
    return this.id.equals(other.id);
  }

  // Generate summary for AI context
  toSummary(): string {
    if (this._items.length === 0) {
      return 'Empty order';
    }

    const itemsSummary = this._items.map((item) => item.toSummary()).join('\n');

    return `Order ${this.id.toString()}:\n${itemsSummary}\nTotal: ${this.totalPrice.format()}`;
  }

  // Private helpers
  private ensureCanBeModified(): void {
    if (!this._status.canBeModified()) {
      throw new InvalidOrderException(`Cannot modify order in "${this._status.toString()}" status`);
    }
  }

  private ensureQuantityLimit(additionalQuantity: number): void {
    const newTotal = this.totalQuantity + additionalQuantity;
    if (newTotal > Order.MAX_TOTAL_ITEMS) {
      throw new InvalidOrderException(
        `Cannot add items. Maximum total items is ${Order.MAX_TOTAL_ITEMS}`,
      );
    }
  }

  private haveSameCustomizations(a: OrderItem, b: OrderItem): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const sizeMatch = a.size?.equals(b.size ?? DrinkSize.tall()) ?? b.size === null;
    return sizeMatch && JSON.stringify(a.customizations) === JSON.stringify(b.customizations);
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

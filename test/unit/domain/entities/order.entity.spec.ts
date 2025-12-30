import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem, OrderStatus } from '@domain/value-objects';
import { InvalidOrderException } from '@domain/exceptions';

describe('Order', () => {
  // Helper function to create a valid OrderItem
  const createTestItem = (
    overrides?: Partial<{
      drinkId: DrinkId;
      drinkName: string;
      size: DrinkSize | null;
      quantity: number;
      unitPrice: Money;
    }>,
  ): OrderItem => {
    return OrderItem.create({
      drinkId: overrides?.drinkId ?? DrinkId.generate(),
      drinkName: overrides?.drinkName ?? 'Test Latte',
      size: overrides?.size ?? DrinkSize.grande(),
      quantity: overrides?.quantity ?? 1,
      unitPrice: overrides?.unitPrice ?? Money.fromDollars(5),
    });
  };

  describe('creation', () => {
    it('should create a new empty order with pending status', () => {
      const order = Order.create();

      expect(order.id).toBeDefined();
      expect(order.status.isPending()).toBe(true);
      expect(order.items).toHaveLength(0);
      expect(order.isEmpty()).toBe(true);
    });

    it('should create an order with a specific ID', () => {
      const id = OrderId.generate();
      const order = Order.create(id);

      expect(order.id.equals(id)).toBe(true);
    });

    it('should reconstitute an order from persistence', () => {
      const id = OrderId.generate();
      const item = createTestItem();
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');

      const order = Order.reconstitute({
        id,
        status: OrderStatus.confirmed(),
        items: [item],
        createdAt,
        updatedAt,
      });

      expect(order.id.equals(id)).toBe(true);
      expect(order.status.isConfirmed()).toBe(true);
      expect(order.items).toHaveLength(1);
      expect(order.createdAt).toEqual(createdAt);
    });
  });

  describe('adding items', () => {
    it('should add an item to the order', () => {
      const order = Order.create();
      const item = createTestItem();

      order.addItem(item);

      expect(order.items).toHaveLength(1);
      expect(order.isEmpty()).toBe(false);
    });

    it('should merge items with same drink and customizations', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, quantity: 2 });
      const item2 = createTestItem({ drinkId, quantity: 3 });

      order.addItem(item1);
      order.addItem(item2);

      expect(order.items).toHaveLength(1);
      expect(order.totalQuantity).toBe(5);
    });

    it('should not merge items with different drinks', () => {
      const order = Order.create();
      const item1 = createTestItem({ drinkName: 'Latte' });
      const item2 = createTestItem({ drinkName: 'Espresso' });

      order.addItem(item1);
      order.addItem(item2);

      expect(order.items).toHaveLength(2);
    });

    it('should throw error when adding to non-pending order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();

      expect(() => order.addItem(createTestItem())).toThrow(InvalidOrderException);
    });

    it('should throw error when exceeding max items limit', () => {
      const order = Order.create();

      // Add 2 different items with quantity 10 each (won't merge)
      order.addItem(createTestItem({ quantity: 10 }));
      order.addItem(createTestItem({ quantity: 10 }));

      // Total is now 20, adding 1 more should throw
      expect(() => order.addItem(createTestItem({ quantity: 1 }))).toThrow(InvalidOrderException);
    });
  });

  describe('removing items', () => {
    it('should remove an item from the order', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      const item = createTestItem({ drinkId });

      order.addItem(item);
      order.removeItem(drinkId.toString());

      expect(order.items).toHaveLength(0);
    });

    it('should throw error when removing non-existent item', () => {
      const order = Order.create();
      order.addItem(createTestItem());

      expect(() => order.removeItem('non-existent-id')).toThrow(InvalidOrderException);
    });

    it('should throw error when removing from non-pending order', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      order.addItem(createTestItem({ drinkId }));
      order.confirm();

      expect(() => order.removeItem(drinkId.toString())).toThrow(InvalidOrderException);
    });
  });

  describe('updating item quantity', () => {
    it('should update item quantity', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      order.addItem(createTestItem({ drinkId, quantity: 1 }));

      order.updateItemQuantity(drinkId.toString(), 5);

      expect(order.totalQuantity).toBe(5);
    });

    it('should remove item when quantity is set to zero', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      order.addItem(createTestItem({ drinkId }));

      order.updateItemQuantity(drinkId.toString(), 0);

      expect(order.items).toHaveLength(0);
    });

    it('should throw error when update would exceed max items', () => {
      const order = Order.create();
      const drinkId = DrinkId.generate();
      order.addItem(createTestItem({ drinkId, quantity: 1 }));

      expect(() => order.updateItemQuantity(drinkId.toString(), 21)).toThrow(InvalidOrderException);
    });
  });

  describe('order lifecycle', () => {
    it('should confirm a pending order with items', () => {
      const order = Order.create();
      order.addItem(createTestItem());

      order.confirm();

      expect(order.status.isConfirmed()).toBe(true);
    });

    it('should throw error when confirming empty order', () => {
      const order = Order.create();

      expect(() => order.confirm()).toThrow(InvalidOrderException);
    });

    it('should throw error when confirming non-pending order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();

      expect(() => order.confirm()).toThrow(InvalidOrderException);
    });

    it('should complete a confirmed order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();

      order.complete();

      expect(order.status.isCompleted()).toBe(true);
    });

    it('should throw error when completing non-confirmed order', () => {
      const order = Order.create();
      order.addItem(createTestItem());

      expect(() => order.complete()).toThrow(InvalidOrderException);
    });

    it('should cancel a pending order', () => {
      const order = Order.create();

      order.cancel();

      expect(order.status.isCancelled()).toBe(true);
    });

    it('should cancel a confirmed order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();

      order.cancel();

      expect(order.status.isCancelled()).toBe(true);
    });

    it('should throw error when cancelling completed order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();
      order.complete();

      expect(() => order.cancel()).toThrow(InvalidOrderException);
    });

    it('should throw error when cancelling already cancelled order', () => {
      const order = Order.create();
      order.cancel();

      expect(() => order.cancel()).toThrow(InvalidOrderException);
    });
  });

  describe('calculated properties', () => {
    it('should calculate total price correctly', () => {
      const order = Order.create();
      order.addItem(createTestItem({ quantity: 2, unitPrice: Money.fromDollars(5) }));
      order.addItem(createTestItem({ quantity: 1, unitPrice: Money.fromDollars(7) }));

      expect(order.totalPrice.dollars).toBe(17);
    });

    it('should return zero for empty order', () => {
      const order = Order.create();

      expect(order.totalPrice.dollars).toBe(0);
    });

    it('should calculate total quantity correctly', () => {
      const order = Order.create();
      order.addItem(createTestItem({ quantity: 2 }));
      order.addItem(createTestItem({ quantity: 3 }));

      expect(order.totalQuantity).toBe(5);
    });
  });

  describe('canBeConfirmed', () => {
    it('should return true for pending order with items', () => {
      const order = Order.create();
      order.addItem(createTestItem());

      expect(order.canBeConfirmed()).toBe(true);
    });

    it('should return false for empty pending order', () => {
      const order = Order.create();

      expect(order.canBeConfirmed()).toBe(false);
    });

    it('should return false for non-pending order', () => {
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();

      expect(order.canBeConfirmed()).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal when IDs match', () => {
      const id = OrderId.generate();
      const order1 = Order.create(id);
      const order2 = Order.create(id);

      expect(order1.equals(order2)).toBe(true);
    });

    it('should not be equal when IDs differ', () => {
      const order1 = Order.create();
      const order2 = Order.create();

      expect(order1.equals(order2)).toBe(false);
    });
  });
});

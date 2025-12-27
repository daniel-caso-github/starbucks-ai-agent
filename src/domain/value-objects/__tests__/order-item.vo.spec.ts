import { OrderItem } from '../order-item.vo';
import { DrinkId } from '../drink-id.vo';
import { DrinkSize } from '../drink-size.vo';
import { Money } from '../money.vo';
import { InvalidValueException } from '../../exceptions';

describe('OrderItem', () => {
  const createTestItem = (
    overrides?: Partial<{
      drinkId: DrinkId;
      drinkName: string;
      size: DrinkSize | null;
      quantity: number;
      unitPrice: Money;
      customizations: { milk?: string; syrup?: string; sweetener?: string; topping?: string };
    }>,
  ): OrderItem => {
    return OrderItem.create({
      drinkId: overrides?.drinkId ?? DrinkId.generate(),
      drinkName: overrides?.drinkName ?? 'Test Latte',
      size: overrides?.size ?? DrinkSize.grande(),
      quantity: overrides?.quantity ?? 1,
      unitPrice: overrides?.unitPrice ?? Money.fromDollars(5),
      customizations: overrides?.customizations,
    });
  };

  describe('creation', () => {
    it('should create an order item with all properties', () => {
      const drinkId = DrinkId.generate();
      const item = OrderItem.create({
        drinkId,
        drinkName: 'Caramel Latte',
        size: DrinkSize.grande(),
        quantity: 2,
        unitPrice: Money.fromDollars(5.5),
        customizations: { milk: 'oat', syrup: 'caramel' },
      });

      expect(item.drinkId.equals(drinkId)).toBe(true);
      expect(item.drinkName).toBe('Caramel Latte');
      expect(item.size?.value).toBe('grande');
      expect(item.quantity).toBe(2);
      expect(item.unitPrice.dollars).toBe(5.5);
      expect(item.customizations.milk).toBe('oat');
      expect(item.customizations.syrup).toBe('caramel');
    });

    it('should default quantity to 1', () => {
      const item = OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Espresso',
        unitPrice: Money.fromDollars(3),
      });

      expect(item.quantity).toBe(1);
    });

    it('should default size to null', () => {
      const item = OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Espresso',
        unitPrice: Money.fromDollars(3),
      });

      expect(item.size).toBeNull();
    });

    it('should default customizations to empty object', () => {
      const item = OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Espresso',
        unitPrice: Money.fromDollars(3),
      });

      expect(item.customizations).toEqual({});
    });

    it('should throw error for empty drink name', () => {
      expect(() =>
        OrderItem.create({
          drinkId: DrinkId.generate(),
          drinkName: '',
          unitPrice: Money.fromDollars(5),
        }),
      ).toThrow(InvalidValueException);
    });

    it('should throw error for quantity less than 1', () => {
      expect(() =>
        OrderItem.create({
          drinkId: DrinkId.generate(),
          drinkName: 'Latte',
          quantity: 0,
          unitPrice: Money.fromDollars(5),
        }),
      ).toThrow(InvalidValueException);
    });

    it('should throw error for quantity greater than 10', () => {
      expect(() =>
        OrderItem.create({
          drinkId: DrinkId.generate(),
          drinkName: 'Latte',
          quantity: 11,
          unitPrice: Money.fromDollars(5),
        }),
      ).toThrow(InvalidValueException);
    });

    it('should throw error for non-integer quantity', () => {
      expect(() =>
        OrderItem.create({
          drinkId: DrinkId.generate(),
          drinkName: 'Latte',
          quantity: 2.5,
          unitPrice: Money.fromDollars(5),
        }),
      ).toThrow(InvalidValueException);
    });
  });

  describe('totalPrice', () => {
    it('should calculate total price correctly', () => {
      const item = createTestItem({ quantity: 3, unitPrice: Money.fromDollars(5) });

      expect(item.totalPrice.dollars).toBe(15);
    });

    it('should return unit price when quantity is 1', () => {
      const item = createTestItem({ quantity: 1, unitPrice: Money.fromDollars(7.5) });

      expect(item.totalPrice.dollars).toBe(7.5);
    });
  });

  describe('withQuantity', () => {
    it('should create new item with updated quantity', () => {
      const original = createTestItem({ quantity: 1 });

      const updated = original.withQuantity(5);

      expect(updated.quantity).toBe(5);
      expect(original.quantity).toBe(1); // Original unchanged
    });

    it('should preserve other properties', () => {
      const original = createTestItem({
        drinkName: 'Latte',
        size: DrinkSize.venti(),
        customizations: { milk: 'oat' },
      });

      const updated = original.withQuantity(3);

      expect(updated.drinkName).toBe('Latte');
      expect(updated.size?.value).toBe('venti');
      expect(updated.customizations.milk).toBe('oat');
    });
  });

  describe('withSize', () => {
    it('should create new item with updated size', () => {
      const original = createTestItem({ size: DrinkSize.tall() });

      const updated = original.withSize(DrinkSize.venti());

      expect(updated.size?.value).toBe('venti');
      expect(original.size?.value).toBe('tall'); // Original unchanged
    });
  });

  describe('withCustomizations', () => {
    it('should create new item with updated customizations', () => {
      const original = createTestItem({ customizations: { milk: 'whole' } });

      const updated = original.withCustomizations({ syrup: 'vanilla' });

      expect(updated.customizations.milk).toBe('whole');
      expect(updated.customizations.syrup).toBe('vanilla');
    });

    it('should override existing customizations', () => {
      const original = createTestItem({ customizations: { milk: 'whole' } });

      const updated = original.withCustomizations({ milk: 'oat' });

      expect(updated.customizations.milk).toBe('oat');
    });
  });

  describe('hasCustomizations', () => {
    it('should return true when has customizations', () => {
      const item = createTestItem({ customizations: { milk: 'oat' } });

      expect(item.hasCustomizations()).toBe(true);
    });

    it('should return false when no customizations', () => {
      const item = createTestItem({ customizations: {} });

      expect(item.hasCustomizations()).toBe(false);
    });

    it('should return false for undefined customizations', () => {
      const item = createTestItem();

      expect(item.hasCustomizations()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal items', () => {
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, quantity: 2, size: DrinkSize.grande() });
      const item2 = createTestItem({ drinkId, quantity: 2, size: DrinkSize.grande() });

      expect(item1.equals(item2)).toBe(true);
    });

    it('should return false for different drink IDs', () => {
      const item1 = createTestItem();
      const item2 = createTestItem();

      expect(item1.equals(item2)).toBe(false);
    });

    it('should return false for different quantities', () => {
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, quantity: 1 });
      const item2 = createTestItem({ drinkId, quantity: 2 });

      expect(item1.equals(item2)).toBe(false);
    });

    it('should return false for different sizes', () => {
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, size: DrinkSize.tall() });
      const item2 = createTestItem({ drinkId, size: DrinkSize.venti() });

      expect(item1.equals(item2)).toBe(false);
    });

    it('should return false for different customizations', () => {
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, customizations: { milk: 'oat' } });
      const item2 = createTestItem({ drinkId, customizations: { milk: 'almond' } });

      expect(item1.equals(item2)).toBe(false);
    });

    it('should handle null sizes correctly', () => {
      const drinkId = DrinkId.generate();
      const item1 = createTestItem({ drinkId, size: null });
      const item2 = createTestItem({ drinkId, size: null });

      expect(item1.equals(item2)).toBe(true);
    });
  });

  describe('toSummary', () => {
    it('should generate summary with all details', () => {
      const item = createTestItem({
        drinkName: 'Caramel Latte',
        quantity: 2,
        size: DrinkSize.grande(),
        unitPrice: Money.fromDollars(5.5),
        customizations: { milk: 'oat', syrup: 'caramel' },
      });

      const summary = item.toSummary();

      expect(summary).toContain('2x Caramel Latte');
      expect(summary).toContain('grande');
      expect(summary).toContain('oat milk');
      expect(summary).toContain('caramel syrup');
      expect(summary).toContain('$11.00');
    });

    it('should generate summary without size', () => {
      const item = OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Espresso',
        unitPrice: Money.fromDollars(5),
        size: null,
      });

      const summary = item.toSummary();

      expect(summary).toContain('1x Espresso');
      expect(summary).not.toContain('('); // No parenthesis means no size
    });

    it('should generate summary without customizations', () => {
      const item = createTestItem({
        drinkName: 'Black Coffee',
        customizations: {},
      });

      const summary = item.toSummary();

      expect(summary).not.toContain('with');
    });

    it('should include sweetener in summary', () => {
      const item = createTestItem({
        customizations: { sweetener: 'stevia' },
      });

      const summary = item.toSummary();

      expect(summary).toContain('stevia');
    });

    it('should include topping in summary', () => {
      const item = createTestItem({
        customizations: { topping: 'whipped cream' },
      });

      const summary = item.toSummary();

      expect(summary).toContain('whipped cream');
    });
  });
});

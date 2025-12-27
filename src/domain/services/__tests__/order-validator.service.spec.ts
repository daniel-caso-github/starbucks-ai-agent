import { OrderValidatorService } from '@domain/services';
import { Drink } from '../../entities';
import { CustomizationOptions, DrinkSize, Money, OrderItem } from '../../value-objects';
import { InvalidOrderException } from '../../exceptions';

describe('OrderValidatorService', () => {
  let validator: OrderValidatorService;

  beforeEach(() => {
    validator = new OrderValidatorService();
  });

  // Helper to create a drink with specific customization options
  const createDrink = (options: {
    name?: string;
    milk?: boolean;
    syrup?: boolean;
    sweetener?: boolean;
    topping?: boolean;
    size?: boolean;
  }): Drink => {
    return Drink.create({
      name: options.name ?? 'Test Drink',
      description: 'Test description',
      basePrice: Money.fromDollars(5),
      customizationOptions: new CustomizationOptions(
        options.milk ?? false,
        options.syrup ?? false,
        options.sweetener ?? false,
        options.topping ?? false,
        options.size ?? false,
      ),
    });
  };

  // Helper to create an order item
  const createItem = (
    drink: Drink,
    options?: {
      size?: DrinkSize | null;
      milk?: string;
      syrup?: string;
      sweetener?: string;
      topping?: string;
    },
  ): OrderItem => {
    return OrderItem.create({
      drinkId: drink.id,
      drinkName: drink.name,
      size: options?.size ?? null,
      unitPrice: drink.basePrice,
      customizations: {
        milk: options?.milk,
        syrup: options?.syrup,
        sweetener: options?.sweetener,
        topping: options?.topping,
      },
    });
  };

  describe('validateItemCustomizations', () => {
    it('should pass when drink supports all requested customizations', () => {
      const drink = createDrink({ milk: true, syrup: true });
      const item = createItem(drink, { milk: 'oat', syrup: 'vanilla' });

      expect(() => validator.validateItemCustomizations(item, drink)).not.toThrow();
    });

    it('should throw when milk is requested but not supported', () => {
      const drink = createDrink({ milk: false });
      const item = createItem(drink, { milk: 'oat' });

      expect(() => validator.validateItemCustomizations(item, drink)).toThrow(
        InvalidOrderException,
      );
    });

    it('should throw when syrup is requested but not supported', () => {
      const drink = createDrink({ syrup: false });
      const item = createItem(drink, { syrup: 'vanilla' });

      expect(() => validator.validateItemCustomizations(item, drink)).toThrow(
        InvalidOrderException,
      );
    });

    it('should throw when sweetener is requested but not supported', () => {
      const drink = createDrink({ sweetener: false });
      const item = createItem(drink, { sweetener: 'sugar' });

      expect(() => validator.validateItemCustomizations(item, drink)).toThrow(
        InvalidOrderException,
      );
    });

    it('should throw when topping is requested but not supported', () => {
      const drink = createDrink({ topping: false });
      const item = createItem(drink, { topping: 'whipped cream' });

      expect(() => validator.validateItemCustomizations(item, drink)).toThrow(
        InvalidOrderException,
      );
    });

    it('should pass when no customizations are requested', () => {
      const drink = createDrink({});
      const item = createItem(drink);

      expect(() => validator.validateItemCustomizations(item, drink)).not.toThrow();
    });
  });

  describe('validateItemSize', () => {
    it('should pass when size is provided and drink supports sizes', () => {
      const drink = createDrink({ size: true });
      const item = createItem(drink, { size: DrinkSize.grande() });

      expect(() => validator.validateItemSize(item, drink)).not.toThrow();
    });

    it('should throw when size is provided but drink does not support sizes', () => {
      const drink = createDrink({ size: false });
      const item = createItem(drink, { size: DrinkSize.grande() });

      expect(() => validator.validateItemSize(item, drink)).toThrow(InvalidOrderException);
    });

    it('should throw when size is required but not provided', () => {
      const drink = createDrink({ size: true });
      const item = createItem(drink, { size: null });

      expect(() => validator.validateItemSize(item, drink)).toThrow(InvalidOrderException);
    });

    it('should pass when size is not provided and drink does not support sizes', () => {
      const drink = createDrink({ size: false });
      const item = createItem(drink, { size: null });

      expect(() => validator.validateItemSize(item, drink)).not.toThrow();
    });
  });

  describe('validateDrinkMatch', () => {
    it('should pass when drink IDs match', () => {
      const drink = createDrink({});
      const item = createItem(drink);

      expect(() => validator.validateDrinkMatch(item, drink)).not.toThrow();
    });

    it('should throw when drink IDs do not match', () => {
      const drink1 = createDrink({ name: 'Drink 1' });
      const drink2 = createDrink({ name: 'Drink 2' });
      const item = createItem(drink1);

      expect(() => validator.validateDrinkMatch(item, drink2)).toThrow(InvalidOrderException);
    });
  });

  describe('validateOrderItem', () => {
    it('should pass all validations for a valid item', () => {
      const drink = createDrink({ milk: true, size: true });
      const item = createItem(drink, { milk: 'almond', size: DrinkSize.venti() });

      expect(() => validator.validateOrderItem(item, drink)).not.toThrow();
    });

    it('should fail if any validation fails', () => {
      const drink = createDrink({ milk: false, size: true });
      const item = createItem(drink, { milk: 'oat', size: DrinkSize.grande() });

      expect(() => validator.validateOrderItem(item, drink)).toThrow(InvalidOrderException);
    });

    it('should validate a simple drink with no customizations', () => {
      const espresso = createDrink({ name: 'Espresso' });
      const item = createItem(espresso);

      expect(() => validator.validateOrderItem(item, espresso)).not.toThrow();
    });

    it('should validate a fully customized drink', () => {
      const latte = createDrink({
        name: 'Latte',
        milk: true,
        syrup: true,
        sweetener: true,
        topping: true,
        size: true,
      });
      const item = createItem(latte, {
        milk: 'oat',
        syrup: 'caramel',
        sweetener: 'stevia',
        topping: 'whipped cream',
        size: DrinkSize.grande(),
      });

      expect(() => validator.validateOrderItem(item, latte)).not.toThrow();
    });
  });
});

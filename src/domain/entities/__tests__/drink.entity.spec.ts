import { Drink } from '../drink.entity';
import { CustomizationOptions, DrinkId, Money } from '../../value-objects';

describe('Drink', () => {
  describe('creation', () => {
    it('should create a drink with all properties', () => {
      const drink = Drink.create({
        name: 'Caramel Latte',
        description: 'Espresso with steamed milk and caramel',
        basePrice: Money.fromDollars(5.5),
        customizationOptions: CustomizationOptions.all(),
      });

      expect(drink.id).toBeDefined();
      expect(drink.name).toBe('Caramel Latte');
      expect(drink.description).toBe('Espresso with steamed milk and caramel');
      expect(drink.basePrice.dollars).toBe(5.5);
    });

    it('should create a drink with generated ID', () => {
      const drink = Drink.create({
        name: 'Espresso',
        description: 'Strong coffee shot',
        basePrice: Money.fromDollars(3),
      });

      expect(drink.id.toString()).toContain('drk_');
    });

    it('should create a drink with specific ID', () => {
      const id = DrinkId.generate();
      const drink = Drink.create({
        id,
        name: 'Espresso',
        description: 'Strong coffee shot',
        basePrice: Money.fromDollars(3),
      });

      expect(drink.id.equals(id)).toBe(true);
    });

    it('should default to no customizations', () => {
      const drink = Drink.create({
        name: 'Espresso',
        description: 'Strong coffee shot',
        basePrice: Money.fromDollars(3),
      });

      expect(drink.supportsCustomization('milk')).toBe(false);
      expect(drink.supportsCustomization('syrup')).toBe(false);
      expect(drink.supportsCustomization('size')).toBe(false);
    });

    it('should throw error for empty name', () => {
      expect(() =>
        Drink.create({
          name: '',
          description: 'Test',
          basePrice: Money.fromDollars(3),
        }),
      ).toThrow();
    });

    it('should throw error for empty description', () => {
      expect(() =>
        Drink.create({
          name: 'Test',
          description: '',
          basePrice: Money.fromDollars(3),
        }),
      ).toThrow();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a drink from persistence', () => {
      const id = DrinkId.generate();
      const customizations = new CustomizationOptions(true, true, false, false, true);

      const drink = Drink.reconstitute({
        id,
        name: 'Latte',
        description: 'Coffee with milk',
        basePrice: Money.fromDollars(5),
        customizationOptions: customizations,
      });

      expect(drink.id.equals(id)).toBe(true);
      expect(drink.supportsCustomization('milk')).toBe(true);
      expect(drink.supportsCustomization('sweetener')).toBe(false);
    });
  });

  describe('customization support', () => {
    it('should correctly report supported customizations', () => {
      const drink = Drink.create({
        name: 'Latte',
        description: 'Coffee with milk',
        basePrice: Money.fromDollars(5),
        customizationOptions: new CustomizationOptions(true, true, true, false, true),
      });

      expect(drink.supportsCustomization('milk')).toBe(true);
      expect(drink.supportsCustomization('syrup')).toBe(true);
      expect(drink.supportsCustomization('sweetener')).toBe(true);
      expect(drink.supportsCustomization('topping')).toBe(false);
      expect(drink.supportsCustomization('size')).toBe(true);
    });

    it('should correctly report hasMultipleSizes', () => {
      const latteWithSizes = Drink.create({
        name: 'Latte',
        description: 'Coffee with milk',
        basePrice: Money.fromDollars(5),
        customizationOptions: new CustomizationOptions(true, false, false, false, true),
      });

      const espressoNoSizes = Drink.create({
        name: 'Espresso',
        description: 'Strong shot',
        basePrice: Money.fromDollars(3),
        customizationOptions: new CustomizationOptions(false, false, false, false, false),
      });

      expect(latteWithSizes.hasMultipleSizes()).toBe(true);
      expect(espressoNoSizes.hasMultipleSizes()).toBe(false);
    });
  });

  describe('toSummary', () => {
    it('should generate summary with customizations', () => {
      const drink = Drink.create({
        name: 'Latte',
        description: 'Espresso with steamed milk',
        basePrice: Money.fromDollars(5),
        customizationOptions: new CustomizationOptions(true, true, false, false, true),
      });

      const summary = drink.toSummary();

      expect(summary).toContain('Latte');
      expect(summary).toContain('Espresso with steamed milk');
      expect(summary).toContain('$5.00');
      expect(summary).toContain('milk options');
      expect(summary).toContain('syrup flavors');
      expect(summary).toContain('multiple sizes');
    });

    it('should generate summary without customizations', () => {
      const drink = Drink.create({
        name: 'Espresso',
        description: 'Strong shot',
        basePrice: Money.fromDollars(3),
        customizationOptions: CustomizationOptions.none(),
      });

      const summary = drink.toSummary();

      expect(summary).toContain('Espresso');
      expect(summary).toContain('No customizations available');
    });
  });

  describe('equality', () => {
    it('should be equal when IDs match', () => {
      const id = DrinkId.generate();
      const drink1 = Drink.create({
        id,
        name: 'Latte',
        description: 'Test',
        basePrice: Money.fromDollars(5),
      });
      const drink2 = Drink.create({
        id,
        name: 'Different Name',
        description: 'Different',
        basePrice: Money.fromDollars(10),
      });

      expect(drink1.equals(drink2)).toBe(true);
    });

    it('should not be equal when IDs differ', () => {
      const drink1 = Drink.create({
        name: 'Latte',
        description: 'Test',
        basePrice: Money.fromDollars(5),
      });
      const drink2 = Drink.create({
        name: 'Latte',
        description: 'Test',
        basePrice: Money.fromDollars(5),
      });

      expect(drink1.equals(drink2)).toBe(false);
    });
  });
});

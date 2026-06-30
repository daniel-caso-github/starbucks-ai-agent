import { DrinkMapper } from '@infrastructure/adapters/persistence/mongodb/mappers';
import {
  CustomizationOptionsDocument,
  DrinkDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

describe('DrinkMapper', () => {
  const createCustomizationOptionsDocument = (
    overrides: Partial<{
      milk: boolean;
      syrup: boolean;
      sweetener: boolean;
      topping: boolean;
      size: boolean;
    }> = {},
  ): CustomizationOptionsDocument => {
    const doc = new CustomizationOptionsDocument();
    doc.milk = overrides.milk ?? false;
    doc.syrup = overrides.syrup ?? false;
    doc.sweetener = overrides.sweetener ?? false;
    doc.topping = overrides.topping ?? false;
    doc.size = overrides.size ?? false;
    return doc;
  };

  const createDrinkDocument = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      basePriceCents: number;
      currency: string;
      customizationOptions: CustomizationOptionsDocument;
    }> = {},
  ): DrinkDocument => {
    const doc = new DrinkDocument();
    doc._id = overrides.id ?? 'drk_test-123';
    doc.name = overrides.name ?? 'Caramel Latte';
    doc.description = overrides.description ?? 'Espresso with caramel and milk';
    doc.basePriceCents = overrides.basePriceCents ?? 550;
    doc.currency = overrides.currency ?? 'USD';
    doc.customizationOptions =
      overrides.customizationOptions ?? createCustomizationOptionsDocument();
    return doc;
  };

  describe('toDomain', () => {
    it('should convert document to domain entity', () => {
      // Arrange
      const document = createDrinkDocument({
        id: 'drk_latte123',
        name: 'Vanilla Latte',
        description: 'Espresso with vanilla',
        basePriceCents: 495,
      });

      // Act
      const drink = DrinkMapper.toDomain(document);

      // Assert
      expect(drink).toBeInstanceOf(Drink);
      expect(drink.id.toString()).toBe('drk_latte123');
      expect(drink.name).toBe('Vanilla Latte');
      expect(drink.description).toBe('Espresso with vanilla');
      expect(drink.basePrice.cents).toBe(495);
    });

    it('should convert price with currency correctly', () => {
      // Arrange
      const document = createDrinkDocument({
        basePriceCents: 650,
        currency: 'EUR',
      });

      // Act
      const drink = DrinkMapper.toDomain(document);

      // Assert
      expect(drink.basePrice.cents).toBe(650);
      expect(drink.basePrice.currency).toBe('EUR');
    });

    it('should convert customization options correctly', () => {
      // Arrange
      const customizations = createCustomizationOptionsDocument({
        milk: true,
        syrup: true,
        sweetener: false,
        topping: true,
        size: true,
      });
      const document = createDrinkDocument({ customizationOptions: customizations });

      // Act
      const drink = DrinkMapper.toDomain(document);

      // Assert
      expect(drink.supportsCustomization('milk')).toBe(true);
      expect(drink.supportsCustomization('syrup')).toBe(true);
      expect(drink.supportsCustomization('sweetener')).toBe(false);
      expect(drink.supportsCustomization('topping')).toBe(true);
      expect(drink.supportsCustomization('size')).toBe(true);
    });

    it('should handle all false customizations', () => {
      // Arrange
      const customizations = createCustomizationOptionsDocument();
      const document = createDrinkDocument({ customizationOptions: customizations });

      // Act
      const drink = DrinkMapper.toDomain(document);

      // Assert
      expect(drink.supportsCustomization('milk')).toBe(false);
      expect(drink.supportsCustomization('syrup')).toBe(false);
      expect(drink.supportsCustomization('size')).toBe(false);
    });
  });

  describe('toDocument', () => {
    it('should convert domain entity to document', () => {
      // Arrange
      const drink = Drink.create({
        id: DrinkId.fromString('drk_espresso'),
        name: 'Espresso',
        description: 'Strong coffee shot',
        basePrice: Money.fromDollars(3),
      });

      // Act
      const document = DrinkMapper.toDocument(drink);

      // Assert
      expect(document).toBeInstanceOf(DrinkDocument);
      expect(document._id).toBe('drk_espresso');
      expect(document.name).toBe('Espresso');
      expect(document.description).toBe('Strong coffee shot');
      expect(document.basePriceCents).toBe(300);
      expect(document.currency).toBe('USD');
    });

    it('should convert customization options correctly', () => {
      // Arrange
      const drink = Drink.create({
        name: 'Latte',
        description: 'Coffee with milk',
        basePrice: Money.fromDollars(5),
        customizationOptions: new CustomizationOptions(true, true, false, false, true),
      });

      // Act
      const document = DrinkMapper.toDocument(drink);

      // Assert
      expect(document.customizationOptions.milk).toBe(true);
      expect(document.customizationOptions.syrup).toBe(true);
      expect(document.customizationOptions.sweetener).toBe(false);
      expect(document.customizationOptions.topping).toBe(false);
      expect(document.customizationOptions.size).toBe(true);
    });

    it('should handle no customizations', () => {
      // Arrange
      const drink = Drink.create({
        name: 'Water',
        description: 'Just water',
        basePrice: Money.fromDollars(1),
        customizationOptions: CustomizationOptions.none(),
      });

      // Act
      const document = DrinkMapper.toDocument(drink);

      // Assert
      expect(document.customizationOptions.milk).toBe(false);
      expect(document.customizationOptions.syrup).toBe(false);
      expect(document.customizationOptions.sweetener).toBe(false);
      expect(document.customizationOptions.topping).toBe(false);
      expect(document.customizationOptions.size).toBe(false);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through domain -> document -> domain conversion', () => {
      // Arrange
      const original = Drink.create({
        id: DrinkId.fromString('drk_roundtrip'),
        name: 'Caramel Macchiato',
        description: 'Espresso with vanilla and caramel',
        basePrice: Money.fromCents(595),
        customizationOptions: CustomizationOptions.all(),
      });

      // Act
      const document = DrinkMapper.toDocument(original);
      const restored = DrinkMapper.toDomain(document);

      // Assert
      expect(restored.id.toString()).toBe(original.id.toString());
      expect(restored.name).toBe(original.name);
      expect(restored.description).toBe(original.description);
      expect(restored.basePrice.cents).toBe(original.basePrice.cents);
      expect(restored.supportsCustomization('milk')).toBe(original.supportsCustomization('milk'));
      expect(restored.supportsCustomization('size')).toBe(original.supportsCustomization('size'));
    });
  });
});

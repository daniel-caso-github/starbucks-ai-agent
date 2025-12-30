import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';
import { CustomizationOptionsDocument, DrinkDocument } from '../schemas';

/**
 * Mapper for converting between Drink domain entity and MongoDB document.
 */
export class DrinkMapper {
  /**
   * Converts a MongoDB document to a domain Drink entity.
   */
  static toDomain(document: DrinkDocument): Drink {
    return Drink.reconstitute({
      id: DrinkId.fromString(document._id),
      name: document.name,
      description: document.description,
      basePrice: Money.fromCents(document.basePriceCents, document.currency),
      customizationOptions: this.customizationsToDomain(document.customizationOptions),
    });
  }

  /**
   * Converts a domain Drink entity to a MongoDB document.
   */
  static toDocument(drink: Drink): DrinkDocument {
    const document = new DrinkDocument();
    document._id = drink.id.toString();
    document.name = drink.name;
    document.description = drink.description;
    document.basePriceCents = drink.basePrice.cents;
    document.currency = drink.basePrice.currency;
    document.customizationOptions = this.customizationsToDocument(drink.customizationOptions);
    return document;
  }

  /**
   * Converts MongoDB customization options to domain CustomizationOptions.
   */
  private static customizationsToDomain(
    document: CustomizationOptionsDocument,
  ): CustomizationOptions {
    return new CustomizationOptions(
      document.milk ?? false,
      document.syrup ?? false,
      document.sweetener ?? false,
      document.topping ?? false,
      document.size ?? false,
    );
  }

  /**
   * Converts domain CustomizationOptions to MongoDB subdocument.
   */
  private static customizationsToDocument(
    options: CustomizationOptions,
  ): CustomizationOptionsDocument {
    const document = new CustomizationOptionsDocument();
    document.milk = options.milk;
    document.syrup = options.syrup;
    document.sweetener = options.sweetener;
    document.topping = options.topping;
    document.size = options.size;
    return document;
  }
}

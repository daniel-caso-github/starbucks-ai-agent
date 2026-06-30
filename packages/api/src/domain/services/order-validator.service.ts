import { Drink } from '../entities';
import { InvalidOrderException } from '../exceptions';
import { OrderItem } from '../value-objects';

/**
 * Domain Service for validating order items against drink specifications.
 * Contains validation logic that requires knowledge of both Order and Drink.
 */
export class OrderValidatorService {
  /**
   * Validates that an OrderItem's customizations are compatible with the Drink.
   * Throws InvalidOrderException if any customization is not supported.
   */
  validateItemCustomizations(item: OrderItem, drink: Drink): void {
    const { customizations } = item;

    if (customizations.milk && !drink.supportsCustomization('milk')) {
      throw new InvalidOrderException(`${drink.name} does not support milk customization`);
    }

    if (customizations.syrup && !drink.supportsCustomization('syrup')) {
      throw new InvalidOrderException(`${drink.name} does not support syrup customization`);
    }

    if (customizations.sweetener && !drink.supportsCustomization('sweetener')) {
      throw new InvalidOrderException(`${drink.name} does not support sweetener customization`);
    }

    if (customizations.topping && !drink.supportsCustomization('topping')) {
      throw new InvalidOrderException(`${drink.name} does not support topping customization`);
    }
  }

  /**
   * Validates that the size is appropriate for the drink.
   * Some drinks (like Espresso) don't come in multiple sizes.
   */
  validateItemSize(item: OrderItem, drink: Drink): void {
    if (item.size && !drink.supportsCustomization('size')) {
      throw new InvalidOrderException(`${drink.name} is not available in different sizes`);
    }

    if (!item.size && drink.supportsCustomization('size')) {
      throw new InvalidOrderException(`Please select a size for ${drink.name}`);
    }
  }

  /**
   * Validates that the drink ID in the item matches the provided drink.
   */
  validateDrinkMatch(item: OrderItem, drink: Drink): void {
    if (!item.drinkId.equals(drink.id)) {
      throw new InvalidOrderException(
        `Drink ID mismatch: item has ${item.drinkId.toString()}, but drink is ${drink.id.toString()}`,
      );
    }
  }

  /**
   * Performs all validations on an order item.
   * This is the main method to call when adding an item to an order.
   */
  validateOrderItem(item: OrderItem, drink: Drink): void {
    this.validateDrinkMatch(item, drink);
    this.validateItemSize(item, drink);
    this.validateItemCustomizations(item, drink);
  }
}

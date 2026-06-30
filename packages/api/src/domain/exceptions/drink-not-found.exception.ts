import { DomainException } from './domain.exception';

/**
 * Thrown when a requested drink does not exist in the menu.
 */
export class DrinkNotFoundException extends DomainException {
  constructor(drinkName: string) {
    super(`Drink "${drinkName}" not found in menu`, 'DRINK_NOT_FOUND');
  }
}

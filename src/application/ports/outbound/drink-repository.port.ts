import { Drink } from '@domain/entities';
import { DrinkId } from '@domain/value-objects';

/**
 * Outbound port for Drink persistence operations.
 *
 * This interface handles basic CRUD operations for drinks.
 * Note: For semantic search (finding drinks by description),
 * use IDrinkSearcher instead.
 *
 * @example
 * ```typescript
 * // Save a new drink to the menu
 * const drink = Drink.create({
 *   name: 'Caramel Latte',
 *   description: 'Espresso with steamed milk and caramel',
 *   basePrice: Money.fromDollars(5.50),
 * });
 * await this.drinkRepository.save(drink);
 * ```
 */
export interface IDrinkRepository {
  /**
   * Persists a drink to storage.
   * If the drink already exists, it will be updated.
   *
   * @param drink - The drink entity to save
   * @returns Promise that resolves when saved
   */
  save(drink: Drink): Promise<void>;

  /**
   * Saves multiple drinks in a single batch operation.
   * More efficient than calling save() multiple times.
   *
   * @param drinks - Array of drinks to save
   * @returns Promise that resolves when all drinks are saved
   */
  saveMany(drinks: Drink[]): Promise<void>;

  /**
   * Retrieves a drink by its unique identifier.
   *
   * @param id - The drink's unique identifier
   * @returns Promise resolving to the drink if found, null otherwise
   */
  findById(id: DrinkId): Promise<Drink | null>;

  /**
   * Finds a drink by its exact name (case-insensitive).
   *
   * @param name - The drink name to search for
   * @returns Promise resolving to the drink if found, null otherwise
   */
  findByName(name: string): Promise<Drink | null>;

  /**
   * Retrieves all drinks from storage.
   * Use sparingly on large datasets.
   *
   * @returns Promise resolving to array of all drinks
   */
  findAll(): Promise<Drink[]>;

  /**
   * Deletes a drink by its ID.
   *
   * @param id - The drink's unique identifier
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(id: DrinkId): Promise<boolean>;

  /**
   * Counts total number of drinks in storage.
   *
   * @returns Promise resolving to the count
   */
  count(): Promise<number>;
}

import { Drink } from '@domain/entities';
import { DrinkId } from '@domain/value-objects';
import { DrinkSearchFiltersDto, DrinkSearchResultDto } from '@application/dtos/drink-searcher.dto';

export interface IDrinkSearcherPort {
  /**
   * Performs semantic search to find drinks similar to the query.
   * Uses vector embeddings to find conceptually similar drinks,
   * not just keyword matches.
   *
   * @param query - Natural language description of desired drink
   * @param limit - Maximum number of results to return (default: 5)
   * @param filters - Optional filters to narrow results
   * @returns Promise resolving to array of drinks with relevance scores
   *
   * @example
   * ```typescript
   * // Find cold, sweet drinks
   * const results = await searcher.findSimilar("iced sweet coffee", 3);
   * // Returns: Caramel Frappuccino (0.92), Iced Vanilla Latte (0.87), ...
   * ```
   */
  findSimilar(
    query: string,
    limit?: number,
    filters?: DrinkSearchFiltersDto,
  ): Promise<DrinkSearchResultDto[]>;

  /**
   * Finds a drink by its exact name (case-insensitive).
   * Useful when the customer explicitly mentions a drink name.
   *
   * @param name - The exact drink name to search for
   * @returns Promise resolving to the drink if found, null otherwise
   *
   * @example
   * ```typescript
   * const drink = await searcher.findByName("Caramel Macchiato");
   * ```
   */
  findByName(name: string): Promise<Drink | null>;

  /**
   * Retrieves a drink by its unique identifier.
   *
   * @param id - The drink's unique identifier
   * @returns Promise resolving to the drink if found, null otherwise
   */
  findById(id: DrinkId): Promise<Drink | null>;

  /**
   * Retrieves all drinks in the menu.
   * Use sparingly - prefer findSimilar for large menus.
   *
   * @returns Promise resolving to array of all drinks
   */
  findAll(): Promise<Drink[]>;

  /**
   * Adds a new drink to the searchable index.
   * This will generate embeddings for the drink's description.
   *
   * @param drink - The drink to add to the index
   * @returns Promise that resolves when indexing is complete
   */
  index(drink: Drink): Promise<void>;

  /**
   * Adds multiple drinks to the searchable index in batch.
   * More efficient than calling index() multiple times.
   *
   * @param drinks - Array of drinks to index
   * @returns Promise that resolves when all drinks are indexed
   */
  indexBatch(drinks: Drink[]): Promise<void>;

  /**
   * Removes a drink from the searchable index.
   *
   * @param id - The drink's unique identifier
   * @returns Promise resolving to true if removed, false if not found
   */
  removeFromIndex(id: DrinkId): Promise<boolean>;
}

import { Drink } from '@domain/entities';
import { DrinkId, Money } from '@domain/value-objects';

/**
 * Represents a drink search result with relevance scoring.
 * The score indicates how well the drink matches the search query.
 */
export interface DrinkSearchResult {
  /** The matched drink entity */
  drink: Drink;

  /**
   * Relevance score between 0 and 1.
   * Higher scores indicate better matches.
   * - 1.0: Perfect match
   * - 0.7+: Strong match
   * - 0.5+: Moderate match
   * - <0.5: Weak match
   */
  score: number;
}

/**
 * Filter criteria for drink searches.
 * All fields are optional - only specified fields will be applied.
 */
export interface DrinkSearchFilters {
  /** Maximum price filter */
  maxPrice?: Money;

  /** Minimum price filter */
  minPrice?: Money;

  /** Only include drinks that support milk customization */
  supportsMilk?: boolean;

  /** Only include drinks that support size customization */
  supportsSize?: boolean;

  /** Only include drinks that support syrup customization */
  supportsSyrup?: boolean;
}

/**
 * Outbound port for searching drinks in the menu.
 *
 * This interface abstracts the drink search mechanism. The primary
 * implementation will use ChromaDB for semantic (vector) search,
 * enabling natural language queries like "something sweet and cold".
 *
 * The semantic search is a key component of the RAG (Retrieval Augmented
 * Generation) pattern used by the AI barista to find relevant drinks
 * based on customer requests.
 *
 * @example
 * ```typescript
 * // Customer says: "I want something with caramel, not too strong"
 * const results = await this.drinkSearcher.findSimilar(
 *   "caramel flavored mild coffee drink",
 *   5
 * );
 *
 * // Pass top results to AI for response generation
 * const topDrinks = results.map(r => r.drink);
 * ```
 */
export interface IDrinkSearcher {
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
    filters?: DrinkSearchFilters,
  ): Promise<DrinkSearchResult[]>;

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

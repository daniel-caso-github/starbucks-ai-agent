/**
 * DTOs for drink search use cases.
 */

/**
 * Input for searching drinks.
 */
export interface SearchDrinksInputDto {
  /** Natural language query (e.g., "something sweet with caramel") */
  readonly query: string;

  /** Maximum number of results to return (default: 5) */
  readonly limit?: number;
}

/**
 * A single drink in the search results.
 */
export interface DrinkResultDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly basePrice: string;
  readonly relevanceScore: number;
  readonly customizations: {
    readonly milk: boolean;
    readonly syrup: boolean;
    readonly sweetener: boolean;
    readonly topping: boolean;
    readonly size: boolean;
  };
}

/**
 * Output from drink search.
 */
export interface SearchDrinksOutputDto {
  readonly results: DrinkResultDto[];
  readonly query: string;
  readonly totalFound: number;
}

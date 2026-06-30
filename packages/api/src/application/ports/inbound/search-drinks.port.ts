import { DrinkResultDto, SearchDrinksInputDto, SearchDrinksOutputDto } from '@application/dtos';
import { Either } from '@application/common';
import { ApplicationError } from '@application/errors';
import { DrinkId } from '@domain/value-objects';

export interface ISearchDrinksPort {
  /**
   * Search for drinks matching the natural language query.
   *
   * @param input - Search query and optional limit
   * @returns Promise resolving to search results with relevance scores
   */
  execute(input: SearchDrinksInputDto): Promise<Either<ApplicationError, SearchDrinksOutputDto>>;

  /**
   * Get all drinks in the catalog.
   *
   * @returns Promise resolving to all drinks
   */
  getAllDrinks(): Promise<Either<ApplicationError, DrinkResultDto[]>>;

  /**
   * Get a single drink by ID.
   *
   * @param drinkId - The drink identifier
   * @returns Promise resolving to the drink or null if not found
   */
  getDrinkById(drinkId: DrinkId): Promise<Either<ApplicationError, DrinkResultDto | null>>;
}

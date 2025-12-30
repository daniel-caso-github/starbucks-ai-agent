import { Inject, Injectable } from '@nestjs/common';
import { Either, left, right } from '../common/either';
import { DrinkResultDto, SearchDrinksInputDto, SearchDrinksOutputDto } from '@application/dtos';
import { ApplicationError, UnexpectedError, ValidationError } from '@application/errors';
import { DrinkId } from '@domain/value-objects';
import { IDrinkRepositoryPort, IDrinkSearcherPort, ISearchDrinksPort } from '@application/ports';
import { DrinkSearchResultDto } from '@application/dtos/drink-searcher.dto';

/**
 * SearchDrinksUseCase handles semantic search for drinks.
 *
 * This use case leverages ChromaDB's vector search capabilities to find drinks
 * that semantically match the user's natural language query. Unlike traditional
 * keyword search, semantic search understands the meaning and context of queries.
 *
 * Use cases include:
 * - Finding drinks by description: "something refreshing for summer"
 * - Finding drinks by flavor profile: "sweet with caramel"
 * - Finding drinks by mood: "I need energy"
 * - Browsing the menu with natural language
 *
 * The search process:
 * 1. User query is converted to an embedding vector
 * 2. ChromaDB finds drinks with similar embedding vectors
 * 3. Results are ranked by relevance score (cosine similarity)
 * 4. Top N results are returned with drink details
 */
@Injectable()
export class SearchDrinksUseCase implements ISearchDrinksPort {
  constructor(
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
  ) {}

  /**
   * Search for drinks matching the natural language query.
   *
   * @param input - Search query and optional limit
   * @returns Either an error or the search results with relevance scores
   *
   * @example
   * ```typescript
   * const result = await searchDrinksUseCase.execute({
   *   query: "iced coffee with vanilla",
   *   limit: 5
   * });
   *
   * if (result.isRight()) {
   *   result.value.results.forEach(drink => {
   *     console.log(`${drink.name} - Score: ${drink.relevanceScore}`);
   *   });
   * }
   * ```
   */
  async execute(
    input: SearchDrinksInputDto,
  ): Promise<Either<ApplicationError, SearchDrinksOutputDto>> {
    try {
      // Step 1: Validate input
      const validationResult = this.validateInput(input);
      if (validationResult.isLeft()) {
        return validationResult;
      }

      const limit = input.limit ?? 5;

      // Step 2: Perform semantic search using ChromaDB
      const searchResults = await this.drinkSearcher.findSimilar(input.query.trim(), limit);

      // Step 3: Transform results to output DTOs
      const results = searchResults.map((result) => this.mapToResultDto(result));

      // Step 4: Return successful response
      return right({
        results,
        query: input.query,
        totalFound: results.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Get all drinks from the repository.
   *
   * This is useful for displaying the complete menu without search filtering.
   * All drinks are returned with a relevance score of 1.0.
   *
   * @returns Either an error or all drinks in the catalog
   */
  async getAllDrinks(): Promise<Either<ApplicationError, DrinkResultDto[]>> {
    try {
      const drinks = await this.drinkRepository.findAll();

      const results: DrinkResultDto[] = drinks.map((drink) => ({
        id: drink.id.toString(),
        name: drink.name,
        description: drink.description,
        basePrice: drink.basePrice.format(),
        relevanceScore: 1.0, // All drinks equally relevant when listing all
        customizations: {
          milk: drink.customizationOptions.milk,
          syrup: drink.customizationOptions.syrup,
          sweetener: drink.customizationOptions.sweetener,
          topping: drink.customizationOptions.topping,
          size: drink.customizationOptions.size,
        },
      }));

      return right(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  /**
   * Get a single drink by ID.
   *
   * @param drinkId - The unique identifier of the drink
   * @returns Either an error or the drink details
   */
  async getDrinkById(drinkId: DrinkId): Promise<Either<ApplicationError, DrinkResultDto | null>> {
    try {
      const drink = await this.drinkSearcher.findById(drinkId);

      if (!drink) {
        return right(null);
      }

      const result: DrinkResultDto = {
        id: drink.id.toString(),
        name: drink.name,
        description: drink.description,
        basePrice: drink.basePrice.format(),
        relevanceScore: 1.0,
        customizations: {
          milk: drink.customizationOptions.milk,
          syrup: drink.customizationOptions.syrup,
          sweetener: drink.customizationOptions.sweetener,
          topping: drink.customizationOptions.topping,
          size: drink.customizationOptions.size,
        },
      };

      return right(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return left(new UnexpectedError(message));
    }
  }

  // ============ Private Helper Methods ============

  /**
   * Validate the search input.
   */
  private validateInput(input: SearchDrinksInputDto): Either<ApplicationError, void> {
    if (!input.query || input.query.trim().length === 0) {
      return left(new ValidationError('Search query cannot be empty', 'query'));
    }

    if (input.query.trim().length < 2) {
      return left(new ValidationError('Search query must be at least 2 characters', 'query'));
    }

    if (input.limit !== undefined) {
      if (input.limit < 1 || input.limit > 20) {
        return left(new ValidationError('Limit must be between 1 and 20', 'limit'));
      }
    }

    return right(undefined);
  }

  /**
   * Map a search result to the output DTO format.
   */
  private mapToResultDto(result: DrinkSearchResultDto): DrinkResultDto {
    const drink = result.drink;

    return {
      id: drink.id.toString(),
      name: drink.name,
      description: drink.description,
      basePrice: drink.basePrice.format(),
      relevanceScore: result.score,
      customizations: {
        milk: drink.customizationOptions.milk,
        syrup: drink.customizationOptions.syrup,
        sweetener: drink.customizationOptions.sweetener,
        topping: drink.customizationOptions.topping,
        size: drink.customizationOptions.size,
      },
    };
  }
}

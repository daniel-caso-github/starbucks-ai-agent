import { Controller, Get, Query, Param, NotFoundException, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiNotFoundResponse } from '@nestjs/swagger';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports/outbound';
import { DrinkId } from '@domain/value-objects';
import { SearchDrinksRequestDto } from '../dtos/request';

/**
 * Controller for drink-related endpoints.
 *
 * Provides access to the drink menu including semantic search
 * powered by ChromaDB and OpenAI embeddings. The search can
 * understand natural language queries like "something cold
 * and chocolatey" and return relevant drinks.
 */
@ApiTags('Drinks')
@Controller('api/v1/drinks')
export class DrinksController {
  private readonly logger = new Logger(DrinksController.name);

  constructor(
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
  ) {}

  /**
   * Get all available drinks.
   *
   * Returns the complete menu with all drink details including
   * prices and available customization options.
   */
  @Get()
  @ApiOperation({
    summary: 'Get all drinks',
    description: 'Retrieve the complete drink menu with prices and customization options.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all available drinks',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 40 },
        drinks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'drink_abc123' },
              name: { type: 'string', example: 'Caffè Latte' },
              description: { type: 'string', example: 'Rich espresso with steamed milk' },
              basePrice: { type: 'string', example: '$4.75' },
              customizationOptions: {
                type: 'object',
                properties: {
                  milk: { type: 'boolean' },
                  syrup: { type: 'boolean' },
                  sweetener: { type: 'boolean' },
                  topping: { type: 'boolean' },
                  size: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getAllDrinks(): Promise<{
    total: number;
    drinks: Array<{
      id: string;
      name: string;
      description: string;
      basePrice: string;
      customizationOptions: {
        milk: boolean;
        syrup: boolean;
        sweetener: boolean;
        topping: boolean;
        size: boolean;
      };
    }>;
  }> {
    this.logger.debug('Getting all drinks');

    const drinks = await this.drinkRepository.findAll();

    this.logger.debug(`Retrieved ${drinks.length} drinks`);

    return {
      total: drinks.length,
      drinks: drinks.map((drink) => ({
        id: drink.id.toString(),
        name: drink.name,
        description: drink.description,
        basePrice: drink.basePrice.format(),
        customizationOptions: {
          milk: drink.customizationOptions.milk,
          syrup: drink.customizationOptions.syrup,
          sweetener: drink.customizationOptions.sweetener,
          topping: drink.customizationOptions.topping,
          size: drink.customizationOptions.size,
        },
      })),
    };
  }

  /**
   * Search drinks using semantic search.
   *
   * Uses AI-powered semantic search to find drinks matching
   * natural language descriptions. This is the same technology
   * used by the barista AI to understand customer requests.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search drinks semantically',
    description: `Search for drinks using natural language. 
    The search understands semantic meaning, so "something cold and chocolatey" 
    will find Mocha Frappuccino even if those exact words aren't in the description.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results with relevance scores',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', example: 'something cold and refreshing' },
        count: { type: 'number', example: 5 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              drink: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  basePrice: { type: 'string' },
                },
              },
              score: {
                type: 'number',
                description: 'Relevance score (0-1)',
                example: 0.87,
              },
            },
          },
        },
      },
    },
  })
  async searchDrinks(@Query() dto: SearchDrinksRequestDto): Promise<{
    query: string;
    count: number;
    results: Array<{
      drink: { id: string; name: string; description: string; basePrice: string };
      score: number;
    }>;
  }> {
    this.logger.debug(`Searching drinks: query="${dto.query}", limit=${dto.limit ?? 5}`);

    const results = await this.drinkSearcher.findSimilar(dto.query, dto.limit);

    this.logger.debug(`Search returned ${results.length} results for "${dto.query}"`);

    return {
      query: dto.query,
      count: results.length,
      results: results.map((result) => ({
        drink: {
          id: result.drink.id.toString(),
          name: result.drink.name,
          description: result.drink.description,
          basePrice: result.drink.basePrice.format(),
        },
        score: Math.round(result.score * 100) / 100, // Round to 2 decimals
      })),
    };
  }

  /**
   * Get a specific drink by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get drink by ID',
    description: 'Retrieve detailed information about a specific drink.',
  })
  @ApiParam({
    name: 'id',
    description: 'Drink ID',
    example: 'drink_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Drink found',
  })
  @ApiNotFoundResponse({ description: 'Drink not found' })
  async getDrinkById(@Param('id') id: string): Promise<{
    id: string;
    name: string;
    description: string;
    basePrice: string;
    customizationOptions: {
      milk: boolean;
      syrup: boolean;
      sweetener: boolean;
      topping: boolean;
      size: boolean;
    };
  }> {
    this.logger.debug(`Getting drink by ID: ${id}`);

    const drinkId = DrinkId.fromString(id);
    const drink = await this.drinkRepository.findById(drinkId);

    if (!drink) {
      this.logger.debug(`Drink not found: ${id}`);
      throw new NotFoundException(`Drink with ID '${id}' not found`);
    }

    return {
      id: drink.id.toString(),
      name: drink.name,
      description: drink.description,
      basePrice: drink.basePrice.format(),
      customizationOptions: {
        milk: drink.customizationOptions.milk,
        syrup: drink.customizationOptions.syrup,
        sweetener: drink.customizationOptions.sweetener,
        topping: drink.customizationOptions.topping,
        size: drink.customizationOptions.size,
      },
    };
  }
}

import { SearchDrinksUseCase } from '@application/use-cases';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports';
import { DrinkSearchResultDto } from '@application/dtos';
import { UnexpectedError, ValidationError } from '@application/errors';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

describe('SearchDrinksUseCase', () => {
  // Mocks for outbound ports
  let mockDrinkSearcher: jest.Mocked<IDrinkSearcherPort>;
  let mockDrinkRepository: jest.Mocked<IDrinkRepositoryPort>;
  let useCase: SearchDrinksUseCase;

  // Helper function to create test drinks
  const createTestDrink = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      price: number;
    }> = {},
  ): Drink => {
    return Drink.reconstitute({
      id: DrinkId.fromString(overrides.id ?? 'drink-123'),
      name: overrides.name ?? 'Caramel Latte',
      description: overrides.description ?? 'Espresso with caramel and steamed milk',
      basePrice: Money.fromCents(overrides.price ?? 450),
      customizationOptions: CustomizationOptions.all(),
    });
  };

  // Helper to create search result DTOs
  const createSearchResult = (drink: Drink, score: number): DrinkSearchResultDto => ({
    drink,
    score,
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockDrinkSearcher = {
      findSimilar: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      index: jest.fn(),
      indexBatch: jest.fn(),
      removeFromIndex: jest.fn(),
    };

    mockDrinkRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    // Create use case with mocked dependencies
    useCase = new SearchDrinksUseCase(mockDrinkSearcher, mockDrinkRepository);
  });

  describe('execute', () => {
    describe('successful searches', () => {
      it('should return search results when query is valid', async () => {
        // Arrange
        const testDrink = createTestDrink();
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.95)]);

        // Act
        const result = await useCase.execute({ query: 'caramel coffee' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.results).toHaveLength(1);
          expect(result.value.results[0].name).toBe('Caramel Latte');
          expect(result.value.results[0].relevanceScore).toBe(0.95);
          expect(result.value.query).toBe('caramel coffee');
          expect(result.value.totalFound).toBe(1);
        }
      });

      it('should return empty results when no drinks match', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);

        // Act
        const result = await useCase.execute({ query: 'nonexistent drink xyz' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.results).toHaveLength(0);
          expect(result.value.totalFound).toBe(0);
        }
      });

      it('should return multiple results sorted by relevance', async () => {
        // Arrange
        const drink1 = createTestDrink({ id: 'drink-1', name: 'Caramel Latte' });
        const drink2 = createTestDrink({ id: 'drink-2', name: 'Caramel Macchiato' });
        mockDrinkSearcher.findSimilar.mockResolvedValue([
          createSearchResult(drink1, 0.95),
          createSearchResult(drink2, 0.85),
        ]);

        // Act
        const result = await useCase.execute({ query: 'caramel' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.results).toHaveLength(2);
          expect(result.value.results[0].relevanceScore).toBe(0.95);
          expect(result.value.results[1].relevanceScore).toBe(0.85);
        }
      });

      it('should trim whitespace from query', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);

        // Act
        await useCase.execute({ query: '  caramel latte  ' });

        // Assert
        expect(mockDrinkSearcher.findSimilar).toHaveBeenCalledWith('caramel latte', 5);
      });

      it('should map drink customization options correctly', async () => {
        // Arrange
        const testDrink = createTestDrink();
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.9)]);

        // Act
        const result = await useCase.execute({ query: 'latte' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          const drinkResult = result.value.results[0];
          expect(drinkResult.customizations.milk).toBe(true);
          expect(drinkResult.customizations.syrup).toBe(true);
          expect(drinkResult.customizations.size).toBe(true);
        }
      });
    });

    describe('limit handling', () => {
      it('should use default limit of 5 when not specified', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);

        // Act
        await useCase.execute({ query: 'coffee' });

        // Assert
        expect(mockDrinkSearcher.findSimilar).toHaveBeenCalledWith('coffee', 5);
      });

      it('should use custom limit when specified', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);

        // Act
        await useCase.execute({ query: 'coffee', limit: 10 });

        // Assert
        expect(mockDrinkSearcher.findSimilar).toHaveBeenCalledWith('coffee', 10);
      });
    });

    describe('validation errors', () => {
      it('should return validation error when query is empty', async () => {
        // Act
        const result = await useCase.execute({ query: '' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('empty');
        }
      });

      it('should return validation error when query is only whitespace', async () => {
        // Act
        const result = await useCase.execute({ query: '   ' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
        }
      });

      it('should return validation error when query is too short', async () => {
        // Act
        const result = await useCase.execute({ query: 'a' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('2 characters');
        }
      });

      it('should return validation error when limit is less than 1', async () => {
        // Act
        const result = await useCase.execute({ query: 'coffee', limit: 0 });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('between 1 and 20');
        }
      });

      it('should return validation error when limit exceeds 20', async () => {
        // Act
        const result = await useCase.execute({ query: 'coffee', limit: 25 });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
        }
      });
    });

    describe('error handling', () => {
      it('should return UnexpectedError when searcher throws', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockRejectedValue(new Error('Database connection failed'));

        // Act
        const result = await useCase.execute({ query: 'coffee' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(UnexpectedError);
          expect(result.value.message).toContain('Database connection failed');
        }
      });
    });
  });

  describe('getAllDrinks', () => {
    it('should return all drinks from repository', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ id: 'drink-1', name: 'Latte' }),
        createTestDrink({ id: 'drink-2', name: 'Cappuccino' }),
      ];
      mockDrinkRepository.findAll.mockResolvedValue(drinks);

      // Act
      const result = await useCase.getAllDrinks();

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].name).toBe('Latte');
        expect(result.value[1].name).toBe('Cappuccino');
      }
    });

    it('should set relevance score to 1.0 for all drinks', async () => {
      // Arrange
      mockDrinkRepository.findAll.mockResolvedValue([createTestDrink()]);

      // Act
      const result = await useCase.getAllDrinks();

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value[0].relevanceScore).toBe(1.0);
      }
    });

    it('should return empty array when no drinks exist', async () => {
      // Arrange
      mockDrinkRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await useCase.getAllDrinks();

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should return UnexpectedError when repository throws', async () => {
      // Arrange
      mockDrinkRepository.findAll.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await useCase.getAllDrinks();

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(UnexpectedError);
      }
    });
  });

  describe('getDrinkById', () => {
    it('should return drink when found', async () => {
      // Arrange
      const testDrink = createTestDrink({ id: 'drink-123', name: 'Mocha' });
      const drinkId = DrinkId.fromString('drink-123');
      mockDrinkSearcher.findById.mockResolvedValue(testDrink);

      // Act
      const result = await useCase.getDrinkById(drinkId);

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.name).toBe('Mocha');
      }
    });

    it('should return null when drink not found', async () => {
      // Arrange
      const drinkId = DrinkId.fromString('nonexistent');
      mockDrinkSearcher.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.getDrinkById(drinkId);

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).toBeNull();
      }
    });

    it('should return UnexpectedError when searcher throws', async () => {
      // Arrange
      const drinkId = DrinkId.fromString('drink-123');
      mockDrinkSearcher.findById.mockRejectedValue(new Error('Search service unavailable'));

      // Act
      const result = await useCase.getDrinkById(drinkId);

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(UnexpectedError);
      }
    });
  });
});

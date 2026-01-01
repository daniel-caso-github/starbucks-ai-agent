import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DrinksController } from '@infrastructure/http/controllers/drinks.controller';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports/outbound';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

describe('DrinksController', () => {
  let controller: DrinksController;
  let mockDrinkRepository: jest.Mocked<IDrinkRepositoryPort>;
  let mockDrinkSearcher: jest.Mocked<IDrinkSearcherPort>;

  const createTestDrink = (overrides: { id?: string; name?: string } = {}): Drink => {
    return Drink.reconstitute({
      id: DrinkId.fromString(overrides.id ?? 'drk_test'),
      name: overrides.name ?? 'Test Latte',
      description: 'A delicious test latte',
      basePrice: Money.fromDollars(5),
      customizationOptions: CustomizationOptions.all(),
    });
  };

  beforeEach(async () => {
    mockDrinkRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<IDrinkRepositoryPort>;

    mockDrinkSearcher = {
      findSimilar: jest.fn(),
      findByName: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      index: jest.fn(),
      indexBatch: jest.fn(),
      removeFromIndex: jest.fn(),
    } as unknown as jest.Mocked<IDrinkSearcherPort>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrinksController],
      providers: [
        {
          provide: 'IDrinkRepository',
          useValue: mockDrinkRepository,
        },
        {
          provide: 'IDrinkSearcher',
          useValue: mockDrinkSearcher,
        },
      ],
    }).compile();

    controller = module.get<DrinksController>(DrinksController);
  });

  describe('getAllDrinks', () => {
    it('should return all drinks', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ id: 'drk_1', name: 'Latte' }),
        createTestDrink({ id: 'drk_2', name: 'Cappuccino' }),
      ];
      mockDrinkRepository.findAll.mockResolvedValue(drinks);

      // Act
      const result = await controller.getAllDrinks();

      // Assert
      expect(result.total).toBe(2);
      expect(result.drinks).toHaveLength(2);
      expect(result.drinks[0].name).toBe('Latte');
      expect(result.drinks[1].name).toBe('Cappuccino');
    });

    it('should return empty array when no drinks', async () => {
      // Arrange
      mockDrinkRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await controller.getAllDrinks();

      // Assert
      expect(result.total).toBe(0);
      expect(result.drinks).toHaveLength(0);
    });

    it('should include customization options', async () => {
      // Arrange
      const drink = createTestDrink();
      mockDrinkRepository.findAll.mockResolvedValue([drink]);

      // Act
      const result = await controller.getAllDrinks();

      // Assert
      expect(result.drinks[0].customizationOptions).toBeDefined();
      expect(result.drinks[0].customizationOptions.milk).toBe(true);
      expect(result.drinks[0].customizationOptions.size).toBe(true);
    });
  });

  describe('searchDrinks', () => {
    it('should return search results', async () => {
      // Arrange
      const drinks = [
        { drink: createTestDrink({ name: 'Caramel Latte' }), score: 0.95 },
        { drink: createTestDrink({ name: 'Vanilla Latte' }), score: 0.85 },
      ];
      mockDrinkSearcher.findSimilar.mockResolvedValue(drinks);

      // Act
      const result = await controller.searchDrinks({ query: 'sweet latte', limit: 5 });

      // Assert
      expect(result.query).toBe('sweet latte');
      expect(result.count).toBe(2);
      expect(result.results[0].drink.name).toBe('Caramel Latte');
      expect(result.results[0].score).toBe(0.95);
    });

    it('should return empty results when no matches', async () => {
      // Arrange
      mockDrinkSearcher.findSimilar.mockResolvedValue([]);

      // Act
      const result = await controller.searchDrinks({ query: 'nonexistent', limit: 5 });

      // Assert
      expect(result.count).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      // Arrange
      mockDrinkSearcher.findSimilar.mockResolvedValue([]);

      // Act
      await controller.searchDrinks({ query: 'coffee', limit: 3 });

      // Assert
      expect(mockDrinkSearcher.findSimilar).toHaveBeenCalledWith('coffee', 3);
    });

    it('should round scores to 2 decimal places', async () => {
      // Arrange
      const drinks = [{ drink: createTestDrink(), score: 0.9567 }];
      mockDrinkSearcher.findSimilar.mockResolvedValue(drinks);

      // Act
      const result = await controller.searchDrinks({ query: 'test', limit: 5 });

      // Assert
      expect(result.results[0].score).toBe(0.96);
    });
  });

  describe('getDrinkById', () => {
    it('should return drink when found', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_found', name: 'Espresso' });
      mockDrinkRepository.findById.mockResolvedValue(drink);

      // Act
      const result = await controller.getDrinkById('drk_found');

      // Assert
      expect(result.id).toBe('drk_found');
      expect(result.name).toBe('Espresso');
      expect(result.basePrice).toBeDefined();
    });

    it('should throw NotFoundException when drink not found', async () => {
      // Arrange
      mockDrinkRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getDrinkById('drk_notfound')).rejects.toThrow(NotFoundException);
    });

    it('should include customization options', async () => {
      // Arrange
      const drink = createTestDrink();
      mockDrinkRepository.findById.mockResolvedValue(drink);

      // Act
      const result = await controller.getDrinkById('drk_test');

      // Assert
      expect(result.customizationOptions.milk).toBe(true);
      expect(result.customizationOptions.syrup).toBe(true);
      expect(result.customizationOptions.sweetener).toBe(true);
      expect(result.customizationOptions.topping).toBe(true);
      expect(result.customizationOptions.size).toBe(true);
    });
  });
});

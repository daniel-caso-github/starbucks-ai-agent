import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChromaDrinkSearcher } from '@infrastructure/adapters/persistence/chromadb';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

// Mock chromadb module
jest.mock('chromadb', () => ({
  ChromaClient: jest.fn().mockImplementation(() => ({
    getOrCreateCollection: jest.fn(),
  })),
}));

describe('ChromaDrinkSearcher', () => {
  let searcher: ChromaDrinkSearcher;
  let mockCollection: {
    query: jest.Mock;
    get: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  let mockConfigService: jest.Mocked<ConfigService>;

  const createTestDrink = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      price: number;
      customizations: CustomizationOptions;
    }> = {},
  ): Drink => {
    return Drink.reconstitute({
      id: DrinkId.fromString(overrides.id ?? 'drk_test-123'),
      name: overrides.name ?? 'Test Latte',
      description: overrides.description ?? 'A delicious test latte',
      basePrice: Money.fromCents(overrides.price ?? 550),
      customizationOptions: overrides.customizations ?? CustomizationOptions.all(),
    });
  };

  const createMockMetadata = (drink: Drink) => ({
    name: drink.name.toLowerCase(),
    displayName: drink.name,
    description: drink.description,
    basePriceCents: drink.basePrice.cents,
    currency: drink.basePrice.currency,
    supportsMilk: drink.customizationOptions.milk,
    supportsSyrup: drink.customizationOptions.syrup,
    supportsSweetener: drink.customizationOptions.sweetener,
    supportsTopping: drink.customizationOptions.topping,
    supportsSize: drink.customizationOptions.size,
  });

  beforeEach(async () => {
    mockCollection = {
      query: jest.fn(),
      get: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:8000'),
    } as unknown as jest.Mocked<ConfigService>;

    // Get the mocked ChromaClient
    const { ChromaClient } = require('chromadb');
    ChromaClient.mockImplementation(() => ({
      getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChromaDrinkSearcher,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    searcher = module.get<ChromaDrinkSearcher>(ChromaDrinkSearcher);

    // Initialize the module
    await searcher.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should connect to ChromaDB and create collection', async () => {
      // The collection is already created in beforeEach
      expect(mockConfigService.get).toHaveBeenCalledWith('CHROMA_HOST', 'http://localhost:8000');
    });
  });

  describe('findSimilar', () => {
    it('should return drinks matching the query', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_latte', name: 'Caramel Latte' });
      mockCollection.query.mockResolvedValue({
        ids: [['drk_latte']],
        distances: [[0.1]],
        metadatas: [[createMockMetadata(drink)]],
      });

      // Act
      const results = await searcher.findSimilar('sweet coffee drink', 5);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].drink.name).toBe('Caramel Latte');
      expect(results[0].score).toBeGreaterThan(0);
      expect(mockCollection.query).toHaveBeenCalledWith({
        queryTexts: ['sweet coffee drink'],
        nResults: 5,
      });
    });

    it('should apply filters when provided', async () => {
      // Arrange
      mockCollection.query.mockResolvedValue({
        ids: [[]],
        distances: [[]],
        metadatas: [[]],
      });

      // Act
      await searcher.findSimilar('latte', 5, {
        maxPrice: Money.fromDollars(6),
        supportsMilk: true,
      });

      // Assert
      expect(mockCollection.query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            $and: expect.arrayContaining([
              { basePriceCents: { $lte: 600 } },
              { supportsMilk: { $eq: true } },
            ]),
          }),
        }),
      );
    });

    it('should return empty array when no results', async () => {
      // Arrange
      mockCollection.query.mockResolvedValue({
        ids: [[]],
        distances: [[]],
        metadatas: [[]],
      });

      // Act
      const results = await searcher.findSimilar('nonexistent drink');

      // Assert
      expect(results).toHaveLength(0);
    });

    it('should handle multiple results', async () => {
      // Arrange
      const drink1 = createTestDrink({ id: 'drk_1', name: 'Latte' });
      const drink2 = createTestDrink({ id: 'drk_2', name: 'Cappuccino' });
      mockCollection.query.mockResolvedValue({
        ids: [['drk_1', 'drk_2']],
        distances: [[0.1, 0.2]],
        metadatas: [[createMockMetadata(drink1), createMockMetadata(drink2)]],
      });

      // Act
      const results = await searcher.findSimilar('coffee');

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe('findByName', () => {
    it('should return drink when found', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_found', name: 'Vanilla Latte' });
      mockCollection.get.mockResolvedValue({
        ids: ['drk_found'],
        metadatas: [createMockMetadata(drink)],
      });

      // Act
      const result = await searcher.findByName('Vanilla Latte');

      // Assert
      expect(result).toBeInstanceOf(Drink);
      expect(result?.name).toBe('Vanilla Latte');
      expect(mockCollection.get).toHaveBeenCalledWith({
        where: { name: { $eq: 'vanilla latte' } },
        limit: 1,
      });
    });

    it('should return null when not found', async () => {
      // Arrange
      mockCollection.get.mockResolvedValue({
        ids: [],
        metadatas: [],
      });

      // Act
      const result = await searcher.findByName('Nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return drink when found', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_byid', name: 'Espresso' });
      mockCollection.get.mockResolvedValue({
        ids: ['drk_byid'],
        metadatas: [createMockMetadata(drink)],
      });

      // Act
      const result = await searcher.findById(DrinkId.fromString('drk_byid'));

      // Assert
      expect(result).toBeInstanceOf(Drink);
      expect(result?.id.toString()).toBe('drk_byid');
      expect(mockCollection.get).toHaveBeenCalledWith({
        ids: ['drk_byid'],
      });
    });

    it('should return null when not found', async () => {
      // Arrange
      mockCollection.get.mockResolvedValue({
        ids: [],
        metadatas: [],
      });

      // Act
      const result = await searcher.findById(DrinkId.fromString('drk_notfound'));

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all drinks', async () => {
      // Arrange
      const drink1 = createTestDrink({ id: 'drk_1', name: 'Latte' });
      const drink2 = createTestDrink({ id: 'drk_2', name: 'Mocha' });
      mockCollection.get.mockResolvedValue({
        ids: ['drk_1', 'drk_2'],
        metadatas: [createMockMetadata(drink1), createMockMetadata(drink2)],
      });

      // Act
      const results = await searcher.findAll();

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(Drink);
      expect(results[1]).toBeInstanceOf(Drink);
    });

    it('should return empty array when no drinks', async () => {
      // Arrange
      mockCollection.get.mockResolvedValue({
        ids: [],
        metadatas: [],
      });

      // Act
      const results = await searcher.findAll();

      // Assert
      expect(results).toHaveLength(0);
    });

    it('should filter out null metadata entries', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_1', name: 'Latte' });
      mockCollection.get.mockResolvedValue({
        ids: ['drk_1', 'drk_2'],
        metadatas: [createMockMetadata(drink), null],
      });

      // Act
      const results = await searcher.findAll();

      // Assert
      expect(results).toHaveLength(1);
    });
  });

  describe('index', () => {
    it('should upsert drink to collection', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_index', name: 'New Drink' });
      mockCollection.upsert.mockResolvedValue(undefined);

      // Act
      await searcher.index(drink);

      // Assert
      expect(mockCollection.upsert).toHaveBeenCalledWith({
        ids: ['drk_index'],
        documents: [expect.stringContaining('New Drink')],
        metadatas: [expect.objectContaining({ displayName: 'New Drink' })],
      });
    });
  });

  describe('indexBatch', () => {
    it('should upsert multiple drinks', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ id: 'drk_1', name: 'Drink 1' }),
        createTestDrink({ id: 'drk_2', name: 'Drink 2' }),
      ];
      mockCollection.upsert.mockResolvedValue(undefined);

      // Act
      await searcher.indexBatch(drinks);

      // Assert
      expect(mockCollection.upsert).toHaveBeenCalledWith({
        ids: ['drk_1', 'drk_2'],
        documents: expect.any(Array),
        metadatas: expect.any(Array),
      });
    });

    it('should not call upsert for empty array', async () => {
      // Act
      await searcher.indexBatch([]);

      // Assert
      expect(mockCollection.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeFromIndex', () => {
    it('should return true when drink is deleted', async () => {
      // Arrange
      mockCollection.delete.mockResolvedValue(undefined);

      // Act
      const result = await searcher.removeFromIndex(DrinkId.fromString('drk_remove'));

      // Assert
      expect(result).toBe(true);
      expect(mockCollection.delete).toHaveBeenCalledWith({
        ids: ['drk_remove'],
      });
    });

    it('should return false when delete fails', async () => {
      // Arrange
      mockCollection.delete.mockRejectedValue(new Error('Delete failed'));

      // Act
      const result = await searcher.removeFromIndex(DrinkId.fromString('drk_fail'));

      // Assert
      expect(result).toBe(false);
    });
  });
});

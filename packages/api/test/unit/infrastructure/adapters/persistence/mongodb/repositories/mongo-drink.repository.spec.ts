import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoDrinkRepository } from '@infrastructure/adapters/persistence/mongodb/repositories';
import {
  CustomizationOptionsDocument,
  DrinkDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

// Type definitions for mock model
type MockDrinkDocument = {
  _id: string;
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  customizationOptions: CustomizationOptionsDocument;
};

interface MockModel {
  findByIdAndUpdate: jest.Mock;
  findById: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  deleteOne: jest.Mock;
  countDocuments: jest.Mock;
  bulkWrite: jest.Mock;
}

describe('MongoDrinkRepository', () => {
  let repository: MongoDrinkRepository;
  let mockModel: MockModel;

  const createMockDrinkDocument = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      basePriceCents: number;
      currency: string;
      customizationOptions: {
        milk: boolean;
        syrup: boolean;
        sweetener: boolean;
        topping: boolean;
        size: boolean;
      };
    }> = {},
  ): MockDrinkDocument => {
    const customizations = new CustomizationOptionsDocument();
    const opts = overrides.customizationOptions ?? {
      milk: false,
      syrup: false,
      sweetener: false,
      topping: false,
      size: false,
    };
    customizations.milk = opts.milk;
    customizations.syrup = opts.syrup;
    customizations.sweetener = opts.sweetener;
    customizations.topping = opts.topping;
    customizations.size = opts.size;

    return {
      _id: overrides.id ?? 'drk_test-123',
      name: overrides.name ?? 'Test Latte',
      description: overrides.description ?? 'A test latte',
      basePriceCents: overrides.basePriceCents ?? 500,
      currency: overrides.currency ?? 'USD',
      customizationOptions: customizations,
    };
  };

  const createTestDrink = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      price: number;
    }> = {},
  ): Drink => {
    return Drink.create({
      id: overrides.id ? DrinkId.fromString(overrides.id) : undefined,
      name: overrides.name ?? 'Test Drink',
      description: overrides.description ?? 'A test drink',
      basePrice: Money.fromDollars(overrides.price ?? 5),
      customizationOptions: CustomizationOptions.none(),
    });
  };

  beforeEach(async () => {
    mockModel = {
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn(),
      bulkWrite: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoDrinkRepository,
        {
          provide: getModelToken(DrinkDocument.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<MongoDrinkRepository>(MongoDrinkRepository);
  });

  describe('save', () => {
    it('should save a drink using upsert', async () => {
      // Arrange
      const drink = createTestDrink({ id: 'drk_save123', name: 'Espresso' });
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockDrinkDocument());

      // Act
      await repository.save(drink);

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'drk_save123',
        expect.objectContaining({
          $set: expect.objectContaining({
            name: 'Espresso',
          }),
        }),
        { upsert: true, new: true },
      );
    });
  });

  describe('saveMany', () => {
    it('should save multiple drinks using bulkWrite', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ name: 'Latte' }),
        createTestDrink({ name: 'Espresso' }),
        createTestDrink({ name: 'Cappuccino' }),
      ];
      mockModel.bulkWrite.mockResolvedValue({ ok: 1, insertedCount: 3 });

      // Act
      await repository.saveMany(drinks);

      // Assert
      expect(mockModel.bulkWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              upsert: true,
            }),
          }),
        ]),
      );
      expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1);
    });

    it('should handle empty array', async () => {
      // Arrange
      mockModel.bulkWrite.mockResolvedValue({ ok: 1, insertedCount: 0 });

      // Act
      await repository.saveMany([]);

      // Assert
      expect(mockModel.bulkWrite).toHaveBeenCalledWith([]);
    });
  });

  describe('findById', () => {
    it('should return drink when found', async () => {
      // Arrange
      const mockDoc = createMockDrinkDocument({
        id: 'drk_found123',
        name: 'Vanilla Latte',
      });
      mockModel.findById.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findById(DrinkId.fromString('drk_found123'));

      // Assert
      expect(result).toBeInstanceOf(Drink);
      expect(result?.id.toString()).toBe('drk_found123');
      expect(result?.name).toBe('Vanilla Latte');
    });

    it('should return null when not found', async () => {
      // Arrange
      mockModel.findById.mockResolvedValue(null);

      // Act
      const result = await repository.findById(DrinkId.fromString('drk_notfound'));

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return drink when found by exact name (case-insensitive)', async () => {
      // Arrange
      const mockDoc = createMockDrinkDocument({
        id: 'drk_byname',
        name: 'Caramel Macchiato',
      });
      mockModel.findOne.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findByName('caramel macchiato');

      // Assert
      expect(result).toBeInstanceOf(Drink);
      expect(result?.name).toBe('Caramel Macchiato');
      expect(mockModel.findOne).toHaveBeenCalledWith({
        name: { $regex: expect.any(RegExp) },
      });
    });

    it('should return null when not found', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.findByName('Nonexistent Drink');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all drinks sorted by name', async () => {
      // Arrange
      const mockDocs = [
        createMockDrinkDocument({ id: 'drk_1', name: 'Americano' }),
        createMockDrinkDocument({ id: 'drk_2', name: 'Cappuccino' }),
        createMockDrinkDocument({ id: 'drk_3', name: 'Latte' }),
      ];
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDocs),
      });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(Drink);
      expect(mockModel.find).toHaveBeenCalled();
    });

    it('should return empty array when no drinks exist', async () => {
      // Arrange
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should return true when drink is deleted', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1, acknowledged: true });

      // Act
      const result = await repository.delete(DrinkId.fromString('drk_todelete'));

      // Assert
      expect(result).toBe(true);
      expect(mockModel.deleteOne).toHaveBeenCalledWith({ _id: 'drk_todelete' });
    });

    it('should return false when drink not found', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 0, acknowledged: true });

      // Act
      const result = await repository.delete(DrinkId.fromString('drk_notfound'));

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total count of drinks', async () => {
      // Arrange
      mockModel.countDocuments.mockResolvedValue(42);

      // Act
      const result = await repository.count();

      // Assert
      expect(result).toBe(42);
      expect(mockModel.countDocuments).toHaveBeenCalled();
    });

    it('should return 0 when no drinks exist', async () => {
      // Arrange
      mockModel.countDocuments.mockResolvedValue(0);

      // Act
      const result = await repository.count();

      // Assert
      expect(result).toBe(0);
    });
  });
});

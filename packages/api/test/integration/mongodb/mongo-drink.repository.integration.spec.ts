import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { DrinkDocument, DrinkSchema, MongoDrinkRepository } from '@infrastructure/adapters';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

jest.setTimeout(60000);

describe('MongoDrinkRepository Integration', () => {
  let repository: MongoDrinkRepository;
  let mongoServer: MongoMemoryServer;
  let module: TestingModule;
  let drinkModel: Model<DrinkDocument>;

  const createTestDrink = (overrides?: {
    name?: string;
    description?: string;
    priceInDollars?: number;
    customizations?: {
      milk?: boolean;
      syrup?: boolean;
      sweetener?: boolean;
      topping?: boolean;
      size?: boolean;
    };
  }): Drink => {
    const customizations = overrides?.customizations ?? {};
    return Drink.create({
      name: overrides?.name ?? 'Test Latte',
      description: overrides?.description ?? 'A delicious test latte',
      basePrice: Money.fromDollars(overrides?.priceInDollars ?? 5),
      customizationOptions: new CustomizationOptions(
        customizations.milk ?? true,
        customizations.syrup ?? true,
        customizations.sweetener ?? false,
        customizations.topping ?? false,
        customizations.size ?? true,
      ),
    });
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: DrinkDocument.name, schema: DrinkSchema }]),
      ],
      providers: [MongoDrinkRepository],
    }).compile();

    repository = module.get<MongoDrinkRepository>(MongoDrinkRepository);
    drinkModel = module.get<Model<DrinkDocument>>(getModelToken(DrinkDocument.name));
  }, 60000);

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await drinkModel.deleteMany({});
  });

  describe('save', () => {
    it('should save a new drink to the database', async () => {
      // Arrange
      const drink = createTestDrink({
        name: 'Caramel Macchiato',
        description: 'Espresso with vanilla and caramel',
        priceInDollars: 5.75,
      });

      // Act
      await repository.save(drink);

      // Assert
      const savedDoc = await drinkModel.findById(drink.id.toString());
      expect(savedDoc).not.toBeNull();
      expect(savedDoc?.name).toBe('Caramel Macchiato');
      expect(savedDoc?.description).toBe('Espresso with vanilla and caramel');
      expect(savedDoc?.basePriceCents).toBe(575);
    });

    it('should update an existing drink', async () => {
      // Arrange
      const drink = createTestDrink({ name: 'Original Name' });
      await repository.save(drink);

      // Act - Reconstitute with updated description
      const updatedDrink = Drink.reconstitute({
        id: drink.id,
        name: drink.name,
        description: 'Updated description',
        basePrice: drink.basePrice,
        customizationOptions: drink.customizationOptions,
      });
      await repository.save(updatedDrink);

      // Assert
      const docs = await drinkModel.find({});
      expect(docs).toHaveLength(1);
      expect(docs[0].description).toBe('Updated description');
    });

    it('should save drink with customization options', async () => {
      // Arrange
      const drink = createTestDrink({
        customizations: {
          milk: true,
          syrup: true,
          sweetener: true,
          topping: true,
          size: true,
        },
      });

      // Act
      await repository.save(drink);

      // Assert
      const savedDoc = await drinkModel.findById(drink.id.toString());
      expect(savedDoc?.customizationOptions.milk).toBe(true);
      expect(savedDoc?.customizationOptions.syrup).toBe(true);
      expect(savedDoc?.customizationOptions.sweetener).toBe(true);
      expect(savedDoc?.customizationOptions.topping).toBe(true);
      expect(savedDoc?.customizationOptions.size).toBe(true);
    });
  });

  describe('saveMany', () => {
    it('should save multiple drinks in batch', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ name: 'Latte' }),
        createTestDrink({ name: 'Cappuccino' }),
        createTestDrink({ name: 'Espresso' }),
      ];

      // Act
      await repository.saveMany(drinks);

      // Assert
      const count = await drinkModel.countDocuments();
      expect(count).toBe(3);

      const names = (await drinkModel.find({})).map((d) => d.name);
      expect(names).toContain('Latte');
      expect(names).toContain('Cappuccino');
      expect(names).toContain('Espresso');
    });

    it('should handle empty array', async () => {
      // Act
      await repository.saveMany([]);

      // Assert
      const count = await drinkModel.countDocuments();
      expect(count).toBe(0);
    });
  });

  describe('findById', () => {
    it('should find an existing drink by ID', async () => {
      // Arrange
      const drink = createTestDrink({
        name: 'Mocha',
        priceInDollars: 6.25,
      });
      await repository.save(drink);

      // Act
      const found = await repository.findById(drink.id);

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id.equals(drink.id)).toBe(true);
      expect(found?.name).toBe('Mocha');
      expect(found?.basePrice.cents).toBe(625);
    });

    it('should return null for non-existent drink', async () => {
      // Arrange
      const nonExistentId = DrinkId.generate();

      // Act
      const found = await repository.findById(nonExistentId);

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should find drink by exact name', async () => {
      // Arrange
      const drink = createTestDrink({ name: 'Vanilla Latte' });
      await repository.save(drink);

      // Act
      const found = await repository.findByName('Vanilla Latte');

      // Assert
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Vanilla Latte');
    });

    it('should return null when name not found', async () => {
      // Act
      const found = await repository.findByName('Non Existent Drink');

      // Assert
      expect(found).toBeNull();
    });

    it('should be case-insensitive', async () => {
      // Arrange
      const drink = createTestDrink({ name: 'Caramel Latte' });
      await repository.save(drink);

      // Act
      const found = await repository.findByName('caramel latte');

      // Assert - Implementation is case-insensitive for better UX
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Caramel Latte');
    });
  });

  describe('findAll', () => {
    it('should return all drinks', async () => {
      // Arrange
      const drinks = [
        createTestDrink({ name: 'Drink A' }),
        createTestDrink({ name: 'Drink B' }),
        createTestDrink({ name: 'Drink C' }),
      ];
      await repository.saveMany(drinks);

      // Act
      const allDrinks = await repository.findAll();

      // Assert
      expect(allDrinks).toHaveLength(3);
      const names = allDrinks.map((d) => d.name);
      expect(names).toContain('Drink A');
      expect(names).toContain('Drink B');
      expect(names).toContain('Drink C');
    });

    it('should return empty array when no drinks exist', async () => {
      // Act
      const allDrinks = await repository.findAll();

      // Assert
      expect(allDrinks).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete an existing drink', async () => {
      // Arrange
      const drink = createTestDrink();
      await repository.save(drink);

      // Act
      const deleted = await repository.delete(drink.id);

      // Assert
      expect(deleted).toBe(true);
      const found = await repository.findById(drink.id);
      expect(found).toBeNull();
    });

    it('should return false when drink does not exist', async () => {
      // Arrange
      const nonExistentId = DrinkId.generate();

      // Act
      const deleted = await repository.delete(nonExistentId);

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct count of drinks', async () => {
      // Arrange
      const drinks = [createTestDrink({ name: 'Drink 1' }), createTestDrink({ name: 'Drink 2' })];
      await repository.saveMany(drinks);

      // Act
      const count = await repository.count();

      // Assert
      expect(count).toBe(2);
    });

    it('should return zero when no drinks exist', async () => {
      // Act
      const count = await repository.count();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('domain entity integrity', () => {
    it('should preserve all drink properties through save/load cycle', async () => {
      // Arrange
      const drink = createTestDrink({
        name: 'Full Test Drink',
        description: 'Complete description with all options',
        priceInDollars: 7.99,
        customizations: {
          milk: true,
          syrup: true,
          sweetener: true,
          topping: true,
          size: true,
        },
      });
      await repository.save(drink);

      // Act
      const loaded = await repository.findById(drink.id);

      // Assert
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe(drink.name);
      expect(loaded?.description).toBe(drink.description);
      expect(loaded?.basePrice.cents).toBe(drink.basePrice.cents);
      expect(loaded?.customizationOptions.milk).toBe(true);
      expect(loaded?.customizationOptions.syrup).toBe(true);
      expect(loaded?.customizationOptions.sweetener).toBe(true);
      expect(loaded?.customizationOptions.topping).toBe(true);
      expect(loaded?.customizationOptions.size).toBe(true);
    });

    it('should allow domain methods on loaded entity', async () => {
      // Arrange
      const drink = createTestDrink({
        name: 'Method Test Drink',
        priceInDollars: 5,
        customizations: { milk: true, size: true },
      });
      await repository.save(drink);

      // Act
      const loaded = await repository.findById(drink.id);

      // Assert - Domain methods should work on loaded entity
      expect(loaded?.supportsCustomization('milk')).toBe(true);
      expect(loaded?.supportsCustomization('sweetener')).toBe(false);
      expect(loaded?.hasMultipleSizes()).toBe(true);
      expect(loaded?.toSummary()).toContain('Method Test Drink');
    });
  });
});

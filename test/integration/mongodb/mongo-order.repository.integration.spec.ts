import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { MongoOrderRepository, OrderDocument, OrderSchema } from '@infrastructure/adapters';
import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem } from '@domain/value-objects';

describe('MongoOrderRepository Integration', () => {
  let repository: MongoOrderRepository;
  let mongoServer: MongoMemoryServer;
  let module: TestingModule;
  let orderModel: Model<OrderDocument>;

  // Helper to create a test order item
  const createTestItem = (
    overrides?: Partial<{
      drinkId: DrinkId;
      drinkName: string;
      quantity: number;
      unitPrice: Money;
      size: DrinkSize | null;
    }>,
  ): OrderItem => {
    return OrderItem.create({
      drinkId: overrides?.drinkId ?? DrinkId.generate(),
      drinkName: overrides?.drinkName ?? 'Test Latte',
      quantity: overrides?.quantity ?? 1,
      unitPrice: overrides?.unitPrice ?? Money.fromDollars(5),
      size: overrides?.size ?? DrinkSize.grande(),
      customizations: {},
    });
  };

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Create testing module with real MongoDB connection
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: OrderDocument.name, schema: OrderSchema }]),
      ],
      providers: [MongoOrderRepository],
    }).compile();

    repository = module.get<MongoOrderRepository>(MongoOrderRepository);
    orderModel = module.get<Model<OrderDocument>>(getModelToken(OrderDocument.name));
  });

  afterAll(async () => {
    // Clean up resources
    await module.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear the collection before each test
    await orderModel.deleteMany({});
  });

  describe('saveWithConversation', () => {
    it('should save a new order to the database', async () => {
      // Arrange
      const order = Order.create();
      const item = createTestItem({ drinkName: 'Caramel Latte' });
      order.addItem(item);
      const conversationId = 'conv_test_123';

      // Act
      await repository.saveWithConversation(order, conversationId);

      // Assert
      const savedDoc = await orderModel.findById(order.id.toString());
      expect(savedDoc).not.toBeNull();
      expect(savedDoc?.status).toBe('pending');
      expect(savedDoc?.conversationId).toBe(conversationId);
      expect(savedDoc?.items).toHaveLength(1);
      expect(savedDoc?.items[0].drinkName).toBe('Caramel Latte');
    });

    it('should update an existing order', async () => {
      // Arrange
      const order = Order.create();
      const item1 = createTestItem({ drinkName: 'Latte' });
      order.addItem(item1);
      const conversationId = 'conv_test_456';

      await repository.saveWithConversation(order, conversationId);

      // Act - Add another item and save again
      const item2 = createTestItem({ drinkName: 'Espresso' });
      order.addItem(item2);
      await repository.saveWithConversation(order, conversationId);

      // Assert
      const docs = await orderModel.find({});
      expect(docs).toHaveLength(1); // Should not create duplicate
      expect(docs[0].items).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should find an existing order by ID', async () => {
      // Arrange
      const order = Order.create();
      const item = createTestItem({
        drinkName: 'Mocha',
        quantity: 2,
        unitPrice: Money.fromDollars(6.5),
      });
      order.addItem(item);
      await repository.saveWithConversation(order, 'conv_789');

      // Act
      const found = await repository.findById(order.id);

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id.equals(order.id)).toBe(true);
      expect(found?.status.toString()).toBe('pending');
      expect(found?.items).toHaveLength(1);
      expect(found?.items[0].drinkName).toBe('Mocha');
      expect(found?.items[0].quantity).toBe(2);
      expect(found?.items[0].unitPrice.cents).toBe(650);
    });

    it('should return null for non-existent order', async () => {
      // Arrange
      const nonExistentId = OrderId.generate();

      // Act
      const found = await repository.findById(nonExistentId);

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('findByConversationId', () => {
    it('should find all orders for a conversation', async () => {
      // Arrange
      const conversationId = 'conv_multi_orders';

      const order1 = Order.create();
      order1.addItem(createTestItem({ drinkName: 'Latte' }));
      await repository.saveWithConversation(order1, conversationId);

      const order2 = Order.create();
      order2.addItem(createTestItem({ drinkName: 'Cappuccino' }));
      await repository.saveWithConversation(order2, conversationId);

      // Different conversation - should not be included
      const order3 = Order.create();
      order3.addItem(createTestItem({ drinkName: 'Espresso' }));
      await repository.saveWithConversation(order3, 'other_conv');

      // Act
      const orders = await repository.findByConversationId(conversationId);

      // Assert
      expect(orders).toHaveLength(2);
      const drinkNames = orders.flatMap((o) => o.items.map((i) => i.drinkName));
      expect(drinkNames).toContain('Latte');
      expect(drinkNames).toContain('Cappuccino');
      expect(drinkNames).not.toContain('Espresso');
    });

    it('should return empty array when no orders exist', async () => {
      // Act
      const orders = await repository.findByConversationId('non_existent');

      // Assert
      expect(orders).toEqual([]);
    });
  });

  describe('findActiveByConversationId', () => {
    it('should find pending order', async () => {
      // Arrange
      const conversationId = 'conv_active';
      const order = Order.create();
      order.addItem(createTestItem());
      await repository.saveWithConversation(order, conversationId);

      // Act
      const active = await repository.findActiveByConversationId(conversationId);

      // Assert
      expect(active).not.toBeNull();
      expect(active?.status.toString()).toBe('pending');
    });

    it('should find confirmed order', async () => {
      // Arrange
      const conversationId = 'conv_confirmed';
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();
      await repository.saveWithConversation(order, conversationId);

      // Act
      const active = await repository.findActiveByConversationId(conversationId);

      // Assert
      expect(active).not.toBeNull();
      expect(active?.status.toString()).toBe('confirmed');
    });

    it('should not find completed order', async () => {
      // Arrange
      const conversationId = 'conv_completed';
      const order = Order.create();
      order.addItem(createTestItem());
      order.confirm();
      order.complete();
      await repository.saveWithConversation(order, conversationId);

      // Act
      const active = await repository.findActiveByConversationId(conversationId);

      // Assert
      expect(active).toBeNull();
    });

    it('should not find cancelled order', async () => {
      // Arrange
      const conversationId = 'conv_cancelled';
      const order = Order.create();
      order.addItem(createTestItem());
      order.cancel();
      await repository.saveWithConversation(order, conversationId);

      // Act
      const active = await repository.findActiveByConversationId(conversationId);

      // Assert
      expect(active).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing order', async () => {
      // Arrange
      const order = Order.create();
      order.addItem(createTestItem());
      await repository.saveWithConversation(order, 'conv_delete');

      // Act
      const deleted = await repository.delete(order.id);

      // Assert
      expect(deleted).toBe(true);
      const found = await repository.findById(order.id);
      expect(found).toBeNull();
    });

    it('should return false when order does not exist', async () => {
      // Arrange
      const nonExistentId = OrderId.generate();

      // Act
      const deleted = await repository.delete(nonExistentId);

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('order with customizations', () => {
    it('should persist and retrieve customizations correctly', async () => {
      // Arrange
      const order = Order.create();
      const item = OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Customized Latte',
        quantity: 1,
        unitPrice: Money.fromDollars(5.5),
        size: DrinkSize.venti(),
        customizations: {
          milk: 'oat',
          syrup: 'vanilla',
          sweetener: 'stevia',
          topping: 'whipped cream',
        },
      });
      order.addItem(item);
      await repository.saveWithConversation(order, 'conv_custom');

      // Act
      const found = await repository.findById(order.id);

      // Assert
      expect(found).not.toBeNull();
      if (!found) throw new Error('Order not found');
      const savedItem = found.items[0];
      expect(savedItem.customizations.milk).toBe('oat');
      expect(savedItem.customizations.syrup).toBe('vanilla');
      expect(savedItem.customizations.sweetener).toBe('stevia');
      expect(savedItem.customizations.topping).toBe('whipped cream');
      expect(savedItem.size?.toString()).toBe('venti');
    });
  });

  describe('domain entity integrity', () => {
    it('should preserve order timestamps through save/load cycle', async () => {
      // Arrange
      const order = Order.create();
      order.addItem(createTestItem());
      const originalCreatedAt = order.createdAt;
      await repository.saveWithConversation(order, 'conv_timestamps');

      // Act
      const found = await repository.findById(order.id);

      // Assert
      expect(found?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    it('should allow domain operations on loaded entity', async () => {
      // Arrange
      const order = Order.create();
      order.addItem(createTestItem({ drinkName: 'Initial Drink' }));
      await repository.saveWithConversation(order, 'conv_ops');

      // Act - Load, modify, save again
      const loaded = await repository.findById(order.id);
      expect(loaded).not.toBeNull();
      if (!loaded) throw new Error('Order not found');

      loaded.addItem(createTestItem({ drinkName: 'Added Drink' }));
      await repository.save(loaded);

      // Assert
      const reloaded = await repository.findById(order.id);
      expect(reloaded?.items).toHaveLength(2);
    });
  });
});

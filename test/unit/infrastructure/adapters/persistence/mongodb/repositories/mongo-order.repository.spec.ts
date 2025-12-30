import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoOrderRepository } from '@infrastructure/adapters/persistence/mongodb/repositories';
import {
  OrderDocument,
  OrderItemDocument,
  CustomizationsDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem } from '@domain/value-objects';

// Type definitions for mock model
type MockOrderDocument = {
  _id: string;
  status: string;
  items: OrderItemDocument[];
  conversationId: string;
  createdAt: Date;
  updatedAt: Date;
};

interface MockModel {
  findByIdAndUpdate: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  deleteOne: jest.Mock;
}

describe('MongoOrderRepository', () => {
  let repository: MongoOrderRepository;
  let mockModel: MockModel;

  const createMockOrderDocument = (
    overrides: Partial<{
      id: string;
      status: string;
      items: Array<{
        drinkId: string;
        drinkName: string;
        size: string | null;
        quantity: number;
        unitPriceCents: number;
        currency: string;
        customizations: Partial<CustomizationsDocument>;
      }>;
      conversationId: string;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ): MockOrderDocument => {
    const items: OrderItemDocument[] = (overrides.items ?? []).map((item) => {
      const doc = new OrderItemDocument();
      doc.drinkId = item.drinkId;
      doc.drinkName = item.drinkName;
      doc.size = item.size;
      doc.quantity = item.quantity;
      doc.unitPriceCents = item.unitPriceCents;
      doc.currency = item.currency;
      doc.customizations = item.customizations as CustomizationsDocument;
      return doc;
    });

    return {
      _id: overrides.id ?? 'ord_test-123',
      status: overrides.status ?? 'pending',
      items,
      conversationId: overrides.conversationId ?? 'conv_test-123',
      createdAt: overrides.createdAt ?? new Date('2024-01-01'),
      updatedAt: overrides.updatedAt ?? new Date('2024-01-02'),
    };
  };

  const createTestOrder = (withItem = false): Order => {
    const order = Order.create();
    if (withItem) {
      order.addItem(
        OrderItem.create({
          drinkId: DrinkId.fromString('drk_test'),
          drinkName: 'Test Latte',
          size: DrinkSize.grande(),
          quantity: 1,
          unitPrice: Money.fromDollars(5),
        }),
      );
    }
    return order;
  };

  beforeEach(async () => {
    mockModel = {
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoOrderRepository,
        {
          provide: getModelToken(OrderDocument.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<MongoOrderRepository>(MongoOrderRepository);
  });

  describe('save', () => {
    it('should save an order using upsert', async () => {
      // Arrange
      const order = createTestOrder(true);
      const existingDoc = createMockOrderDocument({ conversationId: 'conv_existing' });
      mockModel.findById.mockResolvedValue(existingDoc);
      mockModel.findByIdAndUpdate.mockResolvedValue(existingDoc);

      // Act
      await repository.save(order);

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        order.id.toString(),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'pending',
            conversationId: 'conv_existing',
          }),
        }),
        { upsert: true, new: true },
      );
    });

    it('should use empty conversationId when order does not exist', async () => {
      // Arrange
      const order = createTestOrder();
      mockModel.findById.mockResolvedValue(null);
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockOrderDocument());

      // Act
      await repository.save(order);

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          $set: expect.objectContaining({
            conversationId: '',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('saveWithConversation', () => {
    it('should save order with provided conversationId', async () => {
      // Arrange
      const order = createTestOrder(true);
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockOrderDocument());

      // Act
      await repository.saveWithConversation(order, 'conv_new123');

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        order.id.toString(),
        expect.objectContaining({
          $set: expect.objectContaining({
            conversationId: 'conv_new123',
          }),
        }),
        { upsert: true, new: true },
      );
    });

    it('should save order items correctly', async () => {
      // Arrange
      const order = createTestOrder(true);
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockOrderDocument());

      // Act
      await repository.saveWithConversation(order, 'conv_test');

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          $set: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                drinkName: 'Test Latte',
              }),
            ]),
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('findById', () => {
    it('should return order when found', async () => {
      // Arrange
      const mockDoc = createMockOrderDocument({
        id: 'ord_found123',
        status: 'confirmed',
        items: [
          {
            drinkId: 'drk_1',
            drinkName: 'Latte',
            size: 'grande',
            quantity: 2,
            unitPriceCents: 500,
            currency: 'USD',
            customizations: {},
          },
        ],
      });
      mockModel.findById.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findById(OrderId.fromString('ord_found123'));

      // Assert
      expect(result).toBeInstanceOf(Order);
      expect(result?.id.toString()).toBe('ord_found123');
      expect(result?.status.isConfirmed()).toBe(true);
      expect(result?.items).toHaveLength(1);
    });

    it('should return null when not found', async () => {
      // Arrange
      mockModel.findById.mockResolvedValue(null);

      // Act
      const result = await repository.findById(OrderId.fromString('ord_notfound'));

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByConversationId', () => {
    it('should return all orders for a conversation sorted by date', async () => {
      // Arrange
      const mockDocs = [
        createMockOrderDocument({ id: 'ord_1', status: 'completed' }),
        createMockOrderDocument({ id: 'ord_2', status: 'cancelled' }),
      ];
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDocs),
      });

      // Act
      const result = await repository.findByConversationId('conv_test');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Order);
      expect(mockModel.find).toHaveBeenCalledWith({ conversationId: 'conv_test' });
    });

    it('should return empty array when no orders found', async () => {
      // Arrange
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      // Act
      const result = await repository.findByConversationId('conv_empty');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('findActiveByConversationId', () => {
    it('should return pending order when found', async () => {
      // Arrange
      const mockDoc = createMockOrderDocument({
        id: 'ord_pending',
        status: 'pending',
      });
      mockModel.findOne.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findActiveByConversationId('conv_test');

      // Assert
      expect(result).toBeInstanceOf(Order);
      expect(result?.status.isPending()).toBe(true);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        conversationId: 'conv_test',
        status: { $in: ['pending', 'confirmed'] },
      });
    });

    it('should return confirmed order when found', async () => {
      // Arrange
      const mockDoc = createMockOrderDocument({
        id: 'ord_confirmed',
        status: 'confirmed',
        items: [
          {
            drinkId: 'drk_1',
            drinkName: 'Latte',
            size: 'grande',
            quantity: 1,
            unitPriceCents: 500,
            currency: 'USD',
            customizations: {},
          },
        ],
      });
      mockModel.findOne.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findActiveByConversationId('conv_test');

      // Assert
      expect(result).toBeInstanceOf(Order);
      expect(result?.status.isConfirmed()).toBe(true);
    });

    it('should return null when no active order exists', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.findActiveByConversationId('conv_noactive');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when order is deleted', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1, acknowledged: true });

      // Act
      const result = await repository.delete(OrderId.fromString('ord_todelete'));

      // Assert
      expect(result).toBe(true);
      expect(mockModel.deleteOne).toHaveBeenCalledWith({ _id: 'ord_todelete' });
    });

    it('should return false when order not found', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 0, acknowledged: true });

      // Act
      const result = await repository.delete(OrderId.fromString('ord_notfound'));

      // Assert
      expect(result).toBe(false);
    });
  });
});

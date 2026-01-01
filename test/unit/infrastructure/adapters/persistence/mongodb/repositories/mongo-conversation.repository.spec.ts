import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoConversationRepository } from '@infrastructure/adapters/persistence/mongodb/repositories';
import {
  ConversationDocument,
  MessageDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { CacheService } from '@infrastructure/cache';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';

// Mock CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  getConversationHistory: jest.fn().mockResolvedValue(null),
  setConversationHistory: jest.fn().mockResolvedValue(undefined),
  invalidateConversationHistory: jest.fn().mockResolvedValue(undefined),
  getActiveOrder: jest.fn().mockResolvedValue(null),
  setActiveOrder: jest.fn().mockResolvedValue(undefined),
  invalidateActiveOrder: jest.fn().mockResolvedValue(undefined),
  getConversationContext: jest.fn().mockResolvedValue(null),
  setConversationContext: jest.fn().mockResolvedValue(undefined),
  getDrinksSearch: jest.fn().mockResolvedValue(null),
  setDrinksSearch: jest.fn().mockResolvedValue(undefined),
  getAllDrinks: jest.fn().mockResolvedValue(null),
  setAllDrinks: jest.fn().mockResolvedValue(undefined),
  getExactQuery: jest.fn().mockResolvedValue(null),
  setExactQuery: jest.fn().mockResolvedValue(undefined),
  normalizeAndHash: jest.fn().mockReturnValue('mock-hash'),
};

// Type definitions for mock model
type MockConversationDocument = {
  _id: string;
  messages: MessageDocument[];
  currentOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface MockModel {
  exists: jest.Mock;
  updateOne: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
  aggregate: jest.Mock;
  deleteOne: jest.Mock;
  countDocuments: jest.Mock;
}

describe('MongoConversationRepository', () => {
  let repository: MongoConversationRepository;
  let mockModel: MockModel;

  const createMockConversationDocument = (
    overrides: Partial<{
      id: string;
      messages: Array<{ role: string; content: string; timestamp: Date }>;
      currentOrderId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ): MockConversationDocument => {
    const messages: MessageDocument[] = (overrides.messages ?? []).map((msg) => {
      const doc = new MessageDocument();
      doc.role = msg.role;
      doc.content = msg.content;
      doc.timestamp = msg.timestamp;
      return doc;
    });

    return {
      _id: overrides.id ?? 'conv_test-123',
      messages,
      currentOrderId: overrides.currentOrderId ?? null,
      createdAt: overrides.createdAt ?? new Date('2024-01-01'),
      updatedAt: overrides.updatedAt ?? new Date('2024-01-02'),
    };
  };

  beforeEach(async () => {
    mockModel = {
      exists: jest.fn(),
      updateOne: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      aggregate: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoConversationRepository,
        {
          provide: getModelToken(ConversationDocument.name),
          useValue: mockModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    repository = module.get<MongoConversationRepository>(MongoConversationRepository);
  });

  describe('save', () => {
    it('should create a new conversation when it does not exist', async () => {
      // Arrange
      const conversation = Conversation.create(ConversationId.fromString('conv_new123'));
      conversation.addUserMessage('Hello');
      mockModel.exists.mockResolvedValue(null);
      mockModel.create.mockResolvedValue(createMockConversationDocument({ id: 'conv_new123' }));

      // Act
      await repository.save(conversation);

      // Assert
      expect(mockModel.exists).toHaveBeenCalledWith({ _id: 'conv_new123' });
      expect(mockModel.create).toHaveBeenCalledWith({
        _id: 'conv_new123',
        messages: expect.any(Array),
        currentOrderId: null,
      });
    });

    it('should update existing conversation', async () => {
      // Arrange
      const conversation = Conversation.create(ConversationId.fromString('conv_existing'));
      conversation.addUserMessage('Hello again');
      mockModel.exists.mockResolvedValue({ _id: 'conv_existing' });
      mockModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      // Act
      await repository.save(conversation);

      // Assert
      expect(mockModel.exists).toHaveBeenCalledWith({ _id: 'conv_existing' });
      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { _id: 'conv_existing' },
        {
          $set: expect.objectContaining({
            messages: expect.any(Array),
            currentOrderId: null,
          }),
        },
      );
    });

    it('should save conversation with currentOrderId', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.setCurrentOrder(OrderId.fromString('ord_test'));
      mockModel.exists.mockResolvedValue(null);
      mockModel.create.mockResolvedValue(createMockConversationDocument());

      // Act
      await repository.save(conversation);

      // Assert
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentOrderId: 'ord_test',
        }),
      );
    });

    it('should throw error when save fails', async () => {
      // Arrange
      const conversation = Conversation.create();
      mockModel.exists.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(repository.save(conversation)).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return conversation when found', async () => {
      // Arrange
      const mockDoc = createMockConversationDocument({
        id: 'conv_found123',
        messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }],
      });
      mockModel.findOne.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findById(ConversationId.fromString('conv_found123'));

      // Assert
      expect(result).toBeInstanceOf(Conversation);
      expect(result?.id.toString()).toBe('conv_found123');
      expect(result?.messages).toHaveLength(1);
      expect(mockModel.findOne).toHaveBeenCalledWith({ _id: 'conv_found123' });
    });

    it('should return null when not found', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.findById(ConversationId.fromString('conv_notfound'));

      // Assert
      expect(result).toBeNull();
    });

    it('should return conversation with currentOrderId', async () => {
      // Arrange
      const mockDoc = createMockConversationDocument({
        id: 'conv_with_order',
        currentOrderId: 'ord_abc123',
      });
      mockModel.findOne.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findById(ConversationId.fromString('conv_with_order'));

      // Assert
      expect(result?.currentOrderId?.toString()).toBe('ord_abc123');
    });
  });

  describe('getRecentHistory', () => {
    it('should return conversation with limited messages', async () => {
      // Arrange
      const mockDoc = createMockConversationDocument({
        id: 'conv_history',
        messages: [
          { role: 'user', content: 'Message 1', timestamp: new Date() },
          { role: 'assistant', content: 'Response 1', timestamp: new Date() },
        ],
      });
      mockModel.aggregate.mockResolvedValue([mockDoc]);

      // Act
      const result = await repository.getRecentHistory(
        ConversationId.fromString('conv_history'),
        10,
      );

      // Assert
      expect(result).toBeInstanceOf(Conversation);
      expect(mockModel.aggregate).toHaveBeenCalledWith([
        { $match: { _id: 'conv_history' } },
        {
          $project: {
            _id: 1,
            messages: { $slice: ['$messages', -10] },
            currentOrderId: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
    });

    it('should return null when conversation not found', async () => {
      // Arrange
      mockModel.aggregate.mockResolvedValue([]);

      // Act
      const result = await repository.getRecentHistory(ConversationId.fromString('conv_notfound'));

      // Assert
      expect(result).toBeNull();
    });

    it('should use default limit of 10', async () => {
      // Arrange
      mockModel.aggregate.mockResolvedValue([createMockConversationDocument()]);

      // Act
      await repository.getRecentHistory(ConversationId.fromString('conv_test'));

      // Assert
      expect(mockModel.aggregate).toHaveBeenCalledWith([
        expect.any(Object),
        expect.objectContaining({
          $project: expect.objectContaining({
            messages: { $slice: ['$messages', -10] },
          }),
        }),
      ]);
    });

    it('should support custom limit', async () => {
      // Arrange
      mockModel.aggregate.mockResolvedValue([createMockConversationDocument()]);

      // Act
      await repository.getRecentHistory(ConversationId.fromString('conv_test'), 5);

      // Assert
      expect(mockModel.aggregate).toHaveBeenCalledWith([
        expect.any(Object),
        expect.objectContaining({
          $project: expect.objectContaining({
            messages: { $slice: ['$messages', -5] },
          }),
        }),
      ]);
    });
  });

  describe('delete', () => {
    it('should return true when conversation is deleted', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1, acknowledged: true });

      // Act
      const result = await repository.delete(ConversationId.fromString('conv_todelete'));

      // Assert
      expect(result).toBe(true);
      expect(mockModel.deleteOne).toHaveBeenCalledWith({ _id: 'conv_todelete' });
    });

    it('should return false when conversation not found', async () => {
      // Arrange
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 0, acknowledged: true });

      // Act
      const result = await repository.delete(ConversationId.fromString('conv_notfound'));

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when conversation exists', async () => {
      // Arrange
      mockModel.countDocuments.mockResolvedValue(1);

      // Act
      const result = await repository.exists(ConversationId.fromString('conv_exists'));

      // Assert
      expect(result).toBe(true);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({ _id: 'conv_exists' });
    });

    it('should return false when conversation does not exist', async () => {
      // Arrange
      mockModel.countDocuments.mockResolvedValue(0);

      // Act
      const result = await repository.exists(ConversationId.fromString('conv_notexists'));

      // Assert
      expect(result).toBe(false);
    });
  });
});

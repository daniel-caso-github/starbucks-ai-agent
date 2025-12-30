import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoConversationRepository } from '@infrastructure/adapters/persistence/mongodb/repositories';
import {
  ConversationDocument,
  MessageDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';

// Type definitions for mock model
type MockConversationDocument = {
  _id: string;
  messages: MessageDocument[];
  currentOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface MockModel {
  findByIdAndUpdate: jest.Mock;
  findById: jest.Mock;
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
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
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
      ],
    }).compile();

    repository = module.get<MongoConversationRepository>(MongoConversationRepository);
  });

  describe('save', () => {
    it('should save a conversation using upsert', async () => {
      // Arrange
      const conversation = Conversation.create(ConversationId.fromString('conv_new123'));
      conversation.addUserMessage('Hello');
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockConversationDocument());

      // Act
      await repository.save(conversation);

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv_new123',
        expect.objectContaining({
          $set: expect.objectContaining({
            messages: expect.any(Array),
            currentOrderId: null,
          }),
        }),
        { upsert: true, new: true },
      );
    });

    it('should save conversation with currentOrderId', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.setCurrentOrder(OrderId.fromString('ord_test'));
      mockModel.findByIdAndUpdate.mockResolvedValue(createMockConversationDocument());

      // Act
      await repository.save(conversation);

      // Assert
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          $set: expect.objectContaining({
            currentOrderId: 'ord_test',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('findById', () => {
    it('should return conversation when found', async () => {
      // Arrange
      const mockDoc = createMockConversationDocument({
        id: 'conv_found123',
        messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }],
      });
      mockModel.findById.mockResolvedValue(mockDoc);

      // Act
      const result = await repository.findById(ConversationId.fromString('conv_found123'));

      // Assert
      expect(result).toBeInstanceOf(Conversation);
      expect(result?.id.toString()).toBe('conv_found123');
      expect(result?.messages).toHaveLength(1);
    });

    it('should return null when not found', async () => {
      // Arrange
      mockModel.findById.mockResolvedValue(null);

      // Act
      const result = await repository.findById(ConversationId.fromString('conv_notfound'));

      // Assert
      expect(result).toBeNull();
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

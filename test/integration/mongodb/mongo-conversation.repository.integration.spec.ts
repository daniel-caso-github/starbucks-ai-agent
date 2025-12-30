import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import {
  ConversationDocument,
  ConversationSchema,
  MongoConversationRepository,
} from '@infrastructure/adapters';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';

// Increase timeout for integration tests
jest.setTimeout(60000);

describe('MongoConversationRepository Integration', () => {
  let repository: MongoConversationRepository;
  let mongoServer: MongoMemoryServer;
  let module: TestingModule;
  let conversationModel: Model<ConversationDocument>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: ConversationDocument.name, schema: ConversationSchema },
        ]),
      ],
      providers: [MongoConversationRepository],
    }).compile();

    repository = module.get<MongoConversationRepository>(MongoConversationRepository);
    conversationModel = module.get<Model<ConversationDocument>>(
      getModelToken(ConversationDocument.name),
    );
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
    await conversationModel.deleteMany({});
  });

  describe('save', () => {
    it('should save a new conversation to the database', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('Hello, I want to order a coffee');
      conversation.addAssistantMessage('Hi! What kind of coffee would you like?');

      // Act
      await repository.save(conversation);

      // Assert
      const savedDoc = await conversationModel.findById(conversation.id.toString());
      expect(savedDoc).not.toBeNull();
      expect(savedDoc?.messages).toHaveLength(2);
      expect(savedDoc?.messages[0].role).toBe('user');
      expect(savedDoc?.messages[0].content).toBe('Hello, I want to order a coffee');
      expect(savedDoc?.messages[1].role).toBe('assistant');
    });

    it('should update an existing conversation with new messages', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('Hi');
      await repository.save(conversation);

      // Act - Add more messages
      conversation.addAssistantMessage('Hello! How can I help?');
      conversation.addUserMessage('I want a latte');
      await repository.save(conversation);

      // Assert
      const docs = await conversationModel.find({});
      expect(docs).toHaveLength(1);
      expect(docs[0].messages).toHaveLength(3);
    });

    it('should save conversation with current order ID', async () => {
      // Arrange
      const conversation = Conversation.create();
      const orderId = OrderId.generate();
      conversation.setCurrentOrder(orderId);

      // Act
      await repository.save(conversation);

      // Assert
      const savedDoc = await conversationModel.findById(conversation.id.toString());
      expect(savedDoc?.currentOrderId).toBe(orderId.toString());
    });
  });

  describe('findById', () => {
    it('should find an existing conversation by ID', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('Test message');
      conversation.addAssistantMessage('Test response');
      await repository.save(conversation);

      // Act
      const found = await repository.findById(conversation.id);

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id.equals(conversation.id)).toBe(true);
      expect(found?.messages).toHaveLength(2);
      expect(found?.messages[0].content).toBe('Test message');
    });

    it('should return null for non-existent conversation', async () => {
      // Arrange
      const nonExistentId = ConversationId.generate();

      // Act
      const found = await repository.findById(nonExistentId);

      // Assert
      expect(found).toBeNull();
    });

    it('should restore currentOrderId from database', async () => {
      // Arrange
      const conversation = Conversation.create();
      const orderId = OrderId.generate();
      conversation.setCurrentOrder(orderId);
      await repository.save(conversation);

      // Act
      const found = await repository.findById(conversation.id);

      // Assert
      expect(found?.currentOrderId).not.toBeNull();
      expect(found?.currentOrderId?.equals(orderId)).toBe(true);
    });
  });

  describe('getRecentHistory', () => {
    it('should return conversation with only recent messages', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('First message');
      conversation.addAssistantMessage('First response');
      conversation.addUserMessage('Second message');
      conversation.addAssistantMessage('Second response');
      await repository.save(conversation);

      // Act - Request only last 2 messages
      const result = await repository.getRecentHistory(conversation.id, 2);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      // Should have only the most recent messages
      expect(result?.messages[0].content).toBe('Second message');
      expect(result?.messages[1].content).toBe('Second response');
    });

    it('should return all messages if fewer than limit', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('Only message');
      conversation.addAssistantMessage('Only response');
      await repository.save(conversation);

      // Act - Request more messages than exist
      const result = await repository.getRecentHistory(conversation.id, 10);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0].content).toBe('Only message');
      expect(result?.messages[1].content).toBe('Only response');
    });

    it('should return null for non-existent conversation', async () => {
      // Arrange
      const nonExistentId = ConversationId.generate();

      // Act
      const result = await repository.getRecentHistory(nonExistentId, 5);

      // Assert
      expect(result).toBeNull();
    });

    it('should return conversation with empty messages array when no messages exist', async () => {
      // Arrange
      const conversation = Conversation.create();
      await repository.save(conversation);

      // Act
      const result = await repository.getRecentHistory(conversation.id, 5);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(0);
    });

    it('should preserve conversation ID and metadata', async () => {
      // Arrange
      const conversation = Conversation.create();
      const orderId = OrderId.generate();
      conversation.setCurrentOrder(orderId);
      conversation.addUserMessage('Test message');
      await repository.save(conversation);

      // Act
      const result = await repository.getRecentHistory(conversation.id, 5);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id.equals(conversation.id)).toBe(true);
      expect(result?.currentOrderId?.equals(orderId)).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for existing conversation', async () => {
      // Arrange
      const conversation = Conversation.create();
      await repository.save(conversation);

      // Act
      const exists = await repository.exists(conversation.id);

      // Assert
      expect(exists).toBe(true);
    });

    it('should return false for non-existent conversation', async () => {
      // Arrange
      const nonExistentId = ConversationId.generate();

      // Act
      const exists = await repository.exists(nonExistentId);

      // Assert
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing conversation', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('To be deleted');
      await repository.save(conversation);

      // Act
      const deleted = await repository.delete(conversation.id);

      // Assert
      expect(deleted).toBe(true);
      const found = await repository.findById(conversation.id);
      expect(found).toBeNull();
    });

    it('should return false when conversation does not exist', async () => {
      // Arrange
      const nonExistentId = ConversationId.generate();

      // Act
      const deleted = await repository.delete(nonExistentId);

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('message ordering', () => {
    it('should preserve message order through save/load cycle', async () => {
      // Arrange
      const conversation = Conversation.create();
      const messages = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

      messages.forEach((content, index) => {
        if (index % 2 === 0) {
          conversation.addUserMessage(content);
        } else {
          conversation.addAssistantMessage(content);
        }
      });

      await repository.save(conversation);

      // Act
      const found = await repository.findById(conversation.id);

      // Assert
      expect(found?.messages).toHaveLength(5);
      found?.messages.forEach((msg, index) => {
        expect(msg.content).toBe(messages[index]);
      });
    });
  });

  describe('message timestamps', () => {
    it('should preserve message timestamps', async () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('Timestamped message');
      const originalTimestamp = conversation.messages[0].timestamp;

      await repository.save(conversation);

      // Act
      const found = await repository.findById(conversation.id);

      // Assert
      expect(found?.messages[0].timestamp.getTime()).toBe(originalTimestamp.getTime());
    });
  });
});

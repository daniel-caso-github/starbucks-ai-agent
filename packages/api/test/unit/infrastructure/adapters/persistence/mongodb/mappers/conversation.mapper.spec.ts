import { ConversationMapper } from '@infrastructure/adapters/persistence/mongodb/mappers';
import {
  ConversationDocument,
  MessageDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';

describe('ConversationMapper', () => {
  const createMessageDocument = (
    role: 'user' | 'assistant',
    content: string,
    timestamp?: Date,
  ): MessageDocument => {
    const doc = new MessageDocument();
    doc.role = role;
    doc.content = content;
    doc.timestamp = timestamp ?? new Date();
    return doc;
  };

  const createConversationDocument = (
    overrides: Partial<{
      id: string;
      messages: MessageDocument[];
      currentOrderId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ): ConversationDocument => {
    const doc = new ConversationDocument();
    doc._id = overrides.id ?? 'conv_test-123';
    doc.messages = overrides.messages ?? [];
    doc.currentOrderId = overrides.currentOrderId ?? null;
    doc.createdAt = overrides.createdAt ?? new Date('2024-01-01');
    doc.updatedAt = overrides.updatedAt ?? new Date('2024-01-02');
    return doc;
  };

  describe('toDomain', () => {
    it('should convert document to domain entity', () => {
      // Arrange
      const document = createConversationDocument({
        id: 'conv_abc123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });

      // Act
      const conversation = ConversationMapper.toDomain(document);

      // Assert
      expect(conversation).toBeInstanceOf(Conversation);
      expect(conversation.id.toString()).toBe('conv_abc123');
      expect(conversation.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should convert messages correctly', () => {
      // Arrange
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const messages = [
        createMessageDocument('user', 'Hello', timestamp),
        createMessageDocument('assistant', 'Hi there!', timestamp),
      ];
      const document = createConversationDocument({ messages });

      // Act
      const conversation = ConversationMapper.toDomain(document);

      // Assert
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe('Hello');
      expect(conversation.messages[1].role).toBe('assistant');
      expect(conversation.messages[1].content).toBe('Hi there!');
    });

    it('should convert currentOrderId when present', () => {
      // Arrange
      const document = createConversationDocument({
        currentOrderId: 'ord_order123',
      });

      // Act
      const conversation = ConversationMapper.toDomain(document);

      // Assert
      expect(conversation.currentOrderId?.toString()).toBe('ord_order123');
    });

    it('should handle null currentOrderId', () => {
      // Arrange
      const document = createConversationDocument({
        currentOrderId: null,
      });

      // Act
      const conversation = ConversationMapper.toDomain(document);

      // Assert
      expect(conversation.currentOrderId).toBeNull();
    });

    it('should handle empty messages array', () => {
      // Arrange
      const document = createConversationDocument({ messages: [] });

      // Act
      const conversation = ConversationMapper.toDomain(document);

      // Assert
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.isEmpty()).toBe(true);
    });
  });

  describe('toDocument', () => {
    it('should convert domain entity to document', () => {
      // Arrange
      const conversation = Conversation.create(ConversationId.fromString('conv_test456'));

      // Act
      const document = ConversationMapper.toDocument(conversation);

      // Assert
      expect(document).toBeInstanceOf(ConversationDocument);
      expect(document._id).toBe('conv_test456');
    });

    it('should convert messages correctly', () => {
      // Arrange
      const conversation = Conversation.create();
      conversation.addUserMessage('I want a latte');
      conversation.addAssistantMessage('What size?');

      // Act
      const document = ConversationMapper.toDocument(conversation);

      // Assert
      expect(document.messages).toHaveLength(2);
      expect(document.messages[0].role).toBe('user');
      expect(document.messages[0].content).toBe('I want a latte');
      expect(document.messages[1].role).toBe('assistant');
      expect(document.messages[1].content).toBe('What size?');
    });

    it('should convert currentOrderId when present', () => {
      // Arrange
      const conversation = Conversation.create();
      const orderId = OrderId.fromString('ord_myorder');
      conversation.setCurrentOrder(orderId);

      // Act
      const document = ConversationMapper.toDocument(conversation);

      // Assert
      expect(document.currentOrderId).toBe('ord_myorder');
    });

    it('should handle null currentOrderId', () => {
      // Arrange
      const conversation = Conversation.create();

      // Act
      const document = ConversationMapper.toDocument(conversation);

      // Assert
      expect(document.currentOrderId).toBeNull();
    });

    it('should preserve timestamps', () => {
      // Arrange
      const conversation = Conversation.create();

      // Act
      const document = ConversationMapper.toDocument(conversation);

      // Assert
      expect(document.createdAt).toEqual(conversation.createdAt);
      expect(document.updatedAt).toEqual(conversation.updatedAt);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through domain -> document -> domain conversion', () => {
      // Arrange
      const original = Conversation.create(ConversationId.fromString('conv_roundtrip'));
      original.addUserMessage('Hello');
      original.addAssistantMessage('Hi!');
      original.setCurrentOrder(OrderId.fromString('ord_test'));

      // Act
      const document = ConversationMapper.toDocument(original);
      const restored = ConversationMapper.toDomain(document);

      // Assert
      expect(restored.id.toString()).toBe(original.id.toString());
      expect(restored.messages).toHaveLength(original.messages.length);
      expect(restored.currentOrderId?.toString()).toBe(original.currentOrderId?.toString());
    });
  });
});

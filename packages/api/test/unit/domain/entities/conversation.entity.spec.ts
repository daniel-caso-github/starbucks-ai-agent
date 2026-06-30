import { Conversation } from '@domain/entities';
import { ConversationId, Message, OrderId } from '@domain/value-objects';

describe('Conversation', () => {
  describe('creation', () => {
    it('should create a new empty conversation', () => {
      const conversation = Conversation.create();

      expect(conversation.id).toBeDefined();
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.isEmpty()).toBe(true);
      expect(conversation.currentOrderId).toBeNull();
    });

    it('should create a conversation with specific ID', () => {
      const id = ConversationId.generate();
      const conversation = Conversation.create(id);

      expect(conversation.id.equals(id)).toBe(true);
    });

    it('should reconstitute a conversation from persistence', () => {
      const id = ConversationId.generate();
      const orderId = OrderId.generate();
      const messages = [Message.create('user', 'Hello'), Message.create('assistant', 'Hi there!')];
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');

      const conversation = Conversation.reconstitute({
        id,
        messages,
        currentOrderId: orderId,
        createdAt,
        updatedAt,
      });

      expect(conversation.id.equals(id)).toBe(true);
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.currentOrderId?.equals(orderId)).toBe(true);
      expect(conversation.createdAt).toEqual(createdAt);
    });
  });

  describe('adding messages', () => {
    it('should add a user message', () => {
      const conversation = Conversation.create();

      conversation.addUserMessage('I want a latte');

      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0].isFromUser()).toBe(true);
      expect(conversation.messages[0].content).toBe('I want a latte');
    });

    it('should add an assistant message', () => {
      const conversation = Conversation.create();

      conversation.addAssistantMessage('Sure! What size?');

      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0].isFromAssistant()).toBe(true);
    });

    it('should maintain message order', () => {
      const conversation = Conversation.create();

      conversation.addUserMessage('Hello');
      conversation.addAssistantMessage('Hi!');
      conversation.addUserMessage('I want coffee');

      expect(conversation.messages).toHaveLength(3);
      expect(conversation.messages[0].content).toBe('Hello');
      expect(conversation.messages[1].content).toBe('Hi!');
      expect(conversation.messages[2].content).toBe('I want coffee');
    });

    it('should update updatedAt when adding messages', () => {
      const conversation = Conversation.create();
      const initialUpdatedAt = conversation.updatedAt;

      // Small delay to ensure time difference
      conversation.addUserMessage('Test');

      expect(conversation.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
    });

    it('should enforce max messages limit with sliding window', () => {
      const conversation = Conversation.create();

      // Add more than MAX_MESSAGES (50)
      for (let i = 0; i < 55; i++) {
        conversation.addUserMessage(`Message ${i}`);
      }

      expect(conversation.messageCount).toBeLessThanOrEqual(50);
      // Should keep the most recent messages
      expect(conversation.messages[conversation.messageCount - 1].content).toBe('Message 54');
    });
  });

  describe('order management', () => {
    it('should set current order', () => {
      const conversation = Conversation.create();
      const orderId = OrderId.generate();

      conversation.setCurrentOrder(orderId);

      expect(conversation.currentOrderId?.equals(orderId)).toBe(true);
      expect(conversation.hasActiveOrder()).toBe(true);
    });

    it('should clear current order', () => {
      const conversation = Conversation.create();
      const orderId = OrderId.generate();

      conversation.setCurrentOrder(orderId);
      conversation.clearCurrentOrder();

      expect(conversation.currentOrderId).toBeNull();
      expect(conversation.hasActiveOrder()).toBe(false);
    });
  });

  describe('getRecentMessages', () => {
    it('should return the last N messages', () => {
      const conversation = Conversation.create();
      conversation.addUserMessage('Message 1');
      conversation.addAssistantMessage('Message 2');
      conversation.addUserMessage('Message 3');
      conversation.addAssistantMessage('Message 4');

      const recent = conversation.getRecentMessages(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Message 3');
      expect(recent[1].content).toBe('Message 4');
    });

    it('should return all messages if count exceeds total', () => {
      const conversation = Conversation.create();
      conversation.addUserMessage('Message 1');
      conversation.addAssistantMessage('Message 2');

      const recent = conversation.getRecentMessages(10);

      expect(recent).toHaveLength(2);
    });
  });

  describe('getLastUserMessage', () => {
    it('should return the last user message', () => {
      const conversation = Conversation.create();
      conversation.addUserMessage('First user message');
      conversation.addAssistantMessage('Response');
      conversation.addUserMessage('Second user message');
      conversation.addAssistantMessage('Another response');

      const lastUserMessage = conversation.getLastUserMessage();

      expect(lastUserMessage?.content).toBe('Second user message');
    });

    it('should return null if no user messages', () => {
      const conversation = Conversation.create();
      conversation.addAssistantMessage('Hello!');

      const lastUserMessage = conversation.getLastUserMessage();

      expect(lastUserMessage).toBeNull();
    });

    it('should return null for empty conversation', () => {
      const conversation = Conversation.create();

      const lastUserMessage = conversation.getLastUserMessage();

      expect(lastUserMessage).toBeNull();
    });
  });

  describe('getMessagesForContext', () => {
    it('should format messages for AI context', () => {
      const conversation = Conversation.create();
      conversation.addUserMessage('I want a latte');
      conversation.addAssistantMessage('What size would you like?');

      const context = conversation.getMessagesForContext();

      expect(context).toContain('[user]: I want a latte');
      expect(context).toContain('[assistant]: What size would you like?');
    });
  });

  describe('toSummary', () => {
    it('should generate summary with order info', () => {
      const conversation = Conversation.create();
      const orderId = OrderId.generate();
      conversation.addUserMessage('Test');
      conversation.setCurrentOrder(orderId);

      const summary = conversation.toSummary();

      expect(summary).toContain('1 messages');
      expect(summary).toContain('Active order');
    });

    it('should generate summary without order', () => {
      const conversation = Conversation.create();
      conversation.addUserMessage('Test');

      const summary = conversation.toSummary();

      expect(summary).toContain('No active order');
    });
  });

  describe('equality', () => {
    it('should be equal when IDs match', () => {
      const id = ConversationId.generate();
      const conv1 = Conversation.create(id);
      const conv2 = Conversation.create(id);

      expect(conv1.equals(conv2)).toBe(true);
    });

    it('should not be equal when IDs differ', () => {
      const conv1 = Conversation.create();
      const conv2 = Conversation.create();

      expect(conv1.equals(conv2)).toBe(false);
    });
  });
});

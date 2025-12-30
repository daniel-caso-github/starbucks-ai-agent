import { GetConversationHistoryUseCase } from '@application/use-cases';
import { IConversationRepositoryPort } from '@application/ports';
import { ConversationNotFoundError, UnexpectedError, ValidationError } from '@application/errors';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';

describe('GetConversationHistoryUseCase', () => {
  let mockConversationRepository: jest.Mocked<IConversationRepositoryPort>;
  let useCase: GetConversationHistoryUseCase;

  // Helper to create test conversations
  const createTestConversation = (
    overrides: Partial<{
      id: string;
      messageCount: number;
      hasOrder: boolean;
    }> = {},
  ): Conversation => {
    const conversation = Conversation.create(
      overrides.id ? ConversationId.fromString(overrides.id) : undefined,
    );

    // Add messages if specified
    const messageCount = overrides.messageCount ?? 0;
    for (let i = 0; i < messageCount; i++) {
      if (i % 2 === 0) {
        conversation.addUserMessage(`User message ${i + 1}`);
      } else {
        conversation.addAssistantMessage(`Assistant message ${i + 1}`);
      }
    }

    // Set order if specified
    if (overrides.hasOrder) {
      conversation.setCurrentOrder(OrderId.generate());
    }

    return conversation;
  };

  beforeEach(() => {
    mockConversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      getRecentHistory: jest.fn(),
    };

    useCase = new GetConversationHistoryUseCase(mockConversationRepository);
  });

  describe('execute', () => {
    describe('successful retrieval', () => {
      it('should return conversation history when conversation exists', async () => {
        // Arrange
        const conversation = createTestConversation({
          id: 'conv-123',
          messageCount: 4,
        });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.conversationId).toBe('conv-123');
          expect(result.value.messages).toHaveLength(4);
          expect(result.value.messageCount).toBe(4);
        }
      });

      it('should return messages in correct order', async () => {
        // Arrange
        const conversation = createTestConversation({
          id: 'conv-123',
          messageCount: 2,
        });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.messages[0].role).toBe('user');
          expect(result.value.messages[0].content).toBe('User message 1');
          expect(result.value.messages[1].role).toBe('assistant');
          expect(result.value.messages[1].content).toBe('Assistant message 2');
        }
      });

      it('should include current order ID when order exists', async () => {
        // Arrange
        const conversation = createTestConversation({
          id: 'conv-123',
          hasOrder: true,
        });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.currentOrderId).not.toBeNull();
        }
      });

      it('should return null for currentOrderId when no order exists', async () => {
        // Arrange
        const conversation = createTestConversation({
          id: 'conv-123',
          hasOrder: false,
        });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.currentOrderId).toBeNull();
        }
      });

      it('should return empty messages array for new conversation', async () => {
        // Arrange
        const conversation = createTestConversation({
          id: 'conv-123',
          messageCount: 0,
        });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.messages).toHaveLength(0);
          expect(result.value.messageCount).toBe(0);
        }
      });
    });

    describe('limit handling', () => {
      it('should use default limit of 50 when not specified', async () => {
        // Arrange
        const conversation = createTestConversation({ id: 'conv-123' });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        await useCase.execute({ conversationId: 'conv-123' });

        // Assert
        expect(mockConversationRepository.getRecentHistory).toHaveBeenCalledWith(
          expect.any(ConversationId),
          50,
        );
      });

      it('should use custom limit when specified', async () => {
        // Arrange
        const conversation = createTestConversation({ id: 'conv-123' });
        mockConversationRepository.getRecentHistory.mockResolvedValue(conversation);

        // Act
        await useCase.execute({ conversationId: 'conv-123', limit: 20 });

        // Assert
        expect(mockConversationRepository.getRecentHistory).toHaveBeenCalledWith(
          expect.any(ConversationId),
          20,
        );
      });
    });

    describe('validation errors', () => {
      it('should return validation error when conversationId is empty', async () => {
        // Act
        const result = await useCase.execute({ conversationId: '' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('required');
        }
      });

      it('should return validation error when conversationId is whitespace', async () => {
        // Act
        const result = await useCase.execute({ conversationId: '   ' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
        }
      });

      it('should return validation error when limit is less than 1', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          limit: 0,
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('between 1 and 100');
        }
      });

      it('should return validation error when limit exceeds 100', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          limit: 150,
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
        }
      });
    });

    describe('not found errors', () => {
      it('should return ConversationNotFoundError when conversation does not exist', async () => {
        // Arrange
        mockConversationRepository.getRecentHistory.mockResolvedValue(null);

        // Act
        const result = await useCase.execute({
          conversationId: 'nonexistent-conv',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ConversationNotFoundError);
        }
      });

      it('should return ConversationNotFoundError for invalid conversation ID format', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'invalid-format-%%%',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ConversationNotFoundError);
        }
      });
    });

    describe('error handling', () => {
      it('should return UnexpectedError when repository throws', async () => {
        // Arrange
        mockConversationRepository.getRecentHistory.mockRejectedValue(
          new Error('Database connection failed'),
        );

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(UnexpectedError);
          expect(result.value.message).toContain('Database connection failed');
        }
      });
    });
  });

  describe('startConversation', () => {
    it('should create a new conversation and return welcome message', async () => {
      // Arrange
      mockConversationRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await useCase.startConversation({});

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.conversationId).toBeDefined();
        expect(result.value.welcomeMessage).toContain('Welcome');
        expect(result.value.suggestedPrompts).toBeInstanceOf(Array);
        expect(result.value.suggestedPrompts.length).toBeGreaterThan(0);
      }
    });

    it('should save the new conversation', async () => {
      // Arrange
      mockConversationRepository.save.mockResolvedValue(undefined);

      // Act
      await useCase.startConversation({});

      // Assert
      expect(mockConversationRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should add initial message when provided', async () => {
      // Arrange
      mockConversationRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await useCase.startConversation({
        initialMessage: 'Hello, I want a coffee',
      });

      // Assert
      expect(result.isRight()).toBe(true);
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'Hello, I want a coffee',
              role: 'user',
            }),
          ]),
        }),
      );
    });

    it('should ignore empty initial message', async () => {
      // Arrange
      mockConversationRepository.save.mockResolvedValue(undefined);

      // Act
      await useCase.startConversation({ initialMessage: '   ' });

      // Assert
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
        }),
      );
    });

    it('should return UnexpectedError when save fails', async () => {
      // Arrange
      mockConversationRepository.save.mockRejectedValue(new Error('Failed to save'));

      // Act
      const result = await useCase.startConversation({});

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(UnexpectedError);
      }
    });
  });

  describe('exists', () => {
    it('should return true when conversation exists', async () => {
      // Arrange
      mockConversationRepository.exists.mockResolvedValue(true);

      // Act
      const result = await useCase.exists('conv-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when conversation does not exist', async () => {
      // Arrange
      mockConversationRepository.exists.mockResolvedValue(false);

      // Act
      const result = await useCase.exists('nonexistent');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for invalid conversation ID format', async () => {
      // Arrange
      // Even with unusual characters, the ID is technically valid
      // The repository will just not find it
      mockConversationRepository.exists.mockResolvedValue(false);

      // Act
      const result = await useCase.exists('invalid-%%%');

      // Assert
      expect(result).toBe(false);
      expect(mockConversationRepository.exists).toHaveBeenCalled();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and return success', async () => {
      // Arrange
      mockConversationRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.deleteConversation('conv-123');

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false when conversation ID does not exist', async () => {
      // Arrange
      // The ID format is valid, but no conversation exists with this ID
      mockConversationRepository.delete.mockResolvedValue(false);

      // Act
      const result = await useCase.deleteConversation('nonexistent-id-123');

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value).toBe(false);
      }
    });

    it('should return UnexpectedError when delete fails', async () => {
      // Arrange
      mockConversationRepository.delete.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await useCase.deleteConversation('conv-123');

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(UnexpectedError);
      }
    });
  });
});

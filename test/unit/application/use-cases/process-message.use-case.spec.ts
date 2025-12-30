import { ProcessMessageUseCase } from '@application/use-cases';
import {
  IConversationAIPort,
  IConversationRepositoryPort,
  IDrinkRepositoryPort,
  IDrinkSearcherPort,
  IOrderRepositoryPort,
} from '@application/ports';
import { ConversationNotFoundError, EmptyMessageError, UnexpectedError } from '@application/errors';
import { Conversation, Drink, Order } from '@domain/entities';
import {
  ConversationId,
  CustomizationOptions,
  DrinkId,
  Money,
  OrderId,
  OrderItem,
} from '@domain/value-objects';
import {
  ConversationIntentType,
  ExtractedOrderInfoDto,
  GenerateResponseOutputDto,
} from '@application/dtos/conversation-ai.dto';
import { DrinkSearchResultDto } from '@application/dtos/drink-searcher.dto';

describe('ProcessMessageUseCase', () => {
  let mockConversationRepository: jest.Mocked<IConversationRepositoryPort>;
  let mockOrderRepository: jest.Mocked<IOrderRepositoryPort>;
  let mockDrinkRepository: jest.Mocked<IDrinkRepositoryPort>;
  let mockConversationAI: jest.Mocked<IConversationAIPort>;
  let mockDrinkSearcher: jest.Mocked<IDrinkSearcherPort>;
  let useCase: ProcessMessageUseCase;

  // ============ Test Helpers ============

  const createTestDrink = (
    overrides: Partial<{
      id: string;
      name: string;
      description: string;
      price: number;
    }> = {},
  ): Drink => {
    return Drink.reconstitute({
      id: DrinkId.fromString(overrides.id ?? 'drink-123'),
      name: overrides.name ?? 'Caramel Latte',
      description: overrides.description ?? 'Espresso with caramel and steamed milk',
      basePrice: Money.fromCents(overrides.price ?? 450),
      customizationOptions: CustomizationOptions.all(),
    });
  };

  const createTestConversation = (id?: string): Conversation => {
    return Conversation.create(id ? ConversationId.fromString(id) : undefined);
  };

  const createTestOrder = (
    overrides: Partial<{
      id: string;
      status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
      withItem: boolean;
    }> = {},
  ): Order => {
    const order = Order.create(overrides.id ? OrderId.fromString(overrides.id) : undefined);

    if (
      overrides.withItem ||
      overrides.status === 'confirmed' ||
      overrides.status === 'completed'
    ) {
      const drink = createTestDrink();
      const item = OrderItem.create({
        drinkId: drink.id,
        drinkName: drink.name,
        quantity: 1,
        unitPrice: drink.basePrice,
      });
      order.addItem(item);
    }

    if (overrides.status === 'confirmed') {
      order.confirm();
    } else if (overrides.status === 'completed') {
      order.confirm();
      order.complete();
    } else if (overrides.status === 'cancelled') {
      order.cancel();
    }

    return order;
  };

  const createSearchResult = (drink: Drink, score: number): DrinkSearchResultDto => ({
    drink,
    score,
  });

  const createAIResponse = (
    overrides: Partial<{
      message: string;
      intent: ConversationIntentType;
      extractedOrder: ExtractedOrderInfoDto | null;
    }> = {},
  ): GenerateResponseOutputDto => ({
    message: overrides.message ?? 'Here is your drink recommendation!',
    intent: overrides.intent ?? 'greeting',
    extractedOrder: overrides.extractedOrder ?? null,
    suggestedActions: [],
  });

  const createExtractedOrder = (
    overrides: Partial<ExtractedOrderInfoDto> = {},
  ): ExtractedOrderInfoDto => ({
    drinkName: overrides.drinkName ?? 'Caramel Latte',
    size: overrides.size ?? null,
    quantity: overrides.quantity ?? 1,
    customizations: overrides.customizations ?? {},
    confidence: overrides.confidence ?? 0.9,
  });

  // ============ Setup ============

  beforeEach(() => {
    mockConversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      getRecentHistory: jest.fn(),
    };

    mockOrderRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConversationId: jest.fn(),
      findActiveByConversationId: jest.fn(),
      saveWithConversation: jest.fn(),
      delete: jest.fn(),
    };

    mockDrinkRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    mockConversationAI = {
      generateResponse: jest.fn(),
      extractOrderFromMessage: jest.fn(),
      detectIntent: jest.fn(),
      containsOrderIntent: jest.fn(),
    };

    mockDrinkSearcher = {
      findSimilar: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      index: jest.fn(),
      indexBatch: jest.fn(),
      removeFromIndex: jest.fn(),
    };

    useCase = new ProcessMessageUseCase(
      mockConversationRepository,
      mockOrderRepository,
      mockDrinkRepository,
      mockConversationAI,
      mockDrinkSearcher,
    );
  });

  // ============ Tests ============

  describe('execute', () => {
    describe('input validation', () => {
      it('should return EmptyMessageError when message is empty', async () => {
        // Act
        const result = await useCase.execute({ message: '' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(EmptyMessageError);
        }
      });

      it('should return EmptyMessageError when message is only whitespace', async () => {
        // Act
        const result = await useCase.execute({ message: '   ' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(EmptyMessageError);
        }
      });
    });

    describe('conversation handling', () => {
      it('should create a new conversation when no conversationId provided', async () => {
        // Arrange
        const testDrink = createTestDrink();
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.9)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'greeting' }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Hello!' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.conversationId).toBeDefined();
          expect(result.value.conversationId.length).toBeGreaterThan(0);
        }
        expect(mockConversationRepository.save).toHaveBeenCalled();
      });

      it('should use existing conversation when conversationId is provided', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'greeting' }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          message: 'Hello!',
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.conversationId).toBe('conv-123');
        }
      });

      it('should return ConversationNotFoundError when conversation does not exist', async () => {
        // Arrange
        mockConversationRepository.findById.mockResolvedValue(null);

        // Act
        const result = await useCase.execute({
          message: 'Hello!',
          conversationId: 'nonexistent-conv',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ConversationNotFoundError);
        }
      });
    });

    describe('RAG - drink search', () => {
      it('should search for relevant drinks based on user message', async () => {
        // Arrange
        const testDrink = createTestDrink({ name: 'Iced Caramel Latte' });
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.95)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'I recommend our Iced Caramel Latte!',
            intent: 'ask_question',
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          message: 'What iced drinks do you have with caramel?',
        });

        // Assert
        expect(mockDrinkSearcher.findSimilar).toHaveBeenCalledWith(
          'What iced drinks do you have with caramel?',
          5,
        );
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.response).toContain('Iced Caramel Latte');
        }
      });

      it('should continue even if drink search fails', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockRejectedValue(new Error('Search service unavailable'));
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'greeting' }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Hello!' });

        // Assert
        expect(result.isRight()).toBe(true);
      });
    });

    describe('intent handling - order_drink', () => {
      it('should create a new order when intent is order_drink', async () => {
        // Arrange
        const testDrink = createTestDrink({ name: 'Latte' });
        const extractedOrder = createExtractedOrder({
          drinkName: 'Latte',
          quantity: 2,
          confidence: 0.9,
        });

        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.95)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: "I've added 2 Lattes to your order!",
            intent: 'order_drink',
            extractedOrder,
          }),
        );
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'I want 2 lattes please' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('order_drink');
          expect(result.value.currentOrder).not.toBeNull();
          expect(result.value.currentOrder?.items).toHaveLength(1);
          expect(result.value.currentOrder?.items[0].quantity).toBe(2);
        }
        expect(mockOrderRepository.saveWithConversation).toHaveBeenCalled();
      });

      it('should add to existing order when intent is order_drink and order exists', async () => {
        // Arrange
        const newDrink = createTestDrink({ id: 'drink-2', name: 'Cappuccino' });
        const existingOrder = createTestOrder({ id: 'order-123', withItem: true });

        const extractedOrder = createExtractedOrder({
          drinkName: 'Cappuccino',
          confidence: 0.9,
        });

        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(newDrink, 0.95)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: "I've added a Cappuccino to your order!",
            intent: 'order_drink',
            extractedOrder,
          }),
        );
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Add a cappuccino' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.currentOrder?.items.length).toBeGreaterThan(1);
        }
      });

      it('should not create order when confidence is too low', async () => {
        // Arrange
        const testDrink = createTestDrink({ name: 'Latte' });
        const extractedOrder = createExtractedOrder({
          drinkName: 'Latte',
          confidence: 0.3, // Low confidence
        });

        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.95)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Did you want to order a Latte?',
            intent: 'order_drink',
            extractedOrder,
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Maybe a latte?' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.currentOrder).toBeNull();
        }
        expect(mockOrderRepository.saveWithConversation).not.toHaveBeenCalled();
      });
    });

    describe('intent handling - confirm_order', () => {
      it('should confirm order when intent is confirm_order', async () => {
        // Arrange
        const existingOrder = createTestOrder({ id: 'order-123', withItem: true });
        const conversation = createTestConversation('conv-123');

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Your order has been confirmed! Thank you!',
            intent: 'confirm_order',
          }),
        );
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          message: 'Yes, confirm my order',
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('confirm_order');
        }
        expect(mockOrderRepository.saveWithConversation).toHaveBeenCalled();
      });

      it('should handle confirm when no order exists', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: "You don't have an order yet. Would you like to start one?",
            intent: 'confirm_order',
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Confirm my order' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.currentOrder).toBeNull();
        }
      });
    });

    describe('intent handling - cancel_order', () => {
      it('should cancel order when intent is cancel_order', async () => {
        // Arrange
        const existingOrder = createTestOrder({ id: 'order-123', withItem: true });
        const conversation = createTestConversation('conv-123');

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Your order has been cancelled.',
            intent: 'cancel_order',
          }),
        );
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          message: 'Cancel my order',
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('cancel_order');
          expect(result.value.currentOrder).toBeNull();
        }
      });
    });

    describe('intent handling - greeting and questions', () => {
      it('should handle greeting intent', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Welcome to Starbucks! How can I help you today?',
            intent: 'greeting',
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Hi there!' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('greeting');
          expect(result.value.response).toContain('Welcome');
        }
      });

      it('should handle ask_question intent', async () => {
        // Arrange
        const testDrink = createTestDrink({ name: 'Vanilla Latte', price: 495 });
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(testDrink, 0.9)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Our Vanilla Latte costs $4.95.',
            intent: 'ask_question',
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'How much is a vanilla latte?' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('ask_question');
        }
      });
    });

    describe('suggested replies', () => {
      it('should return suggested replies when no order exists', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'greeting' }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'Hello!' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.suggestedReplies).toContain('Browse our menu');
          expect(result.value.suggestedReplies).toContain('Start an order');
        }
      });

      it('should return order-related suggestions when order is pending', async () => {
        // Arrange
        const existingOrder = createTestOrder({ id: 'order-123', withItem: true });

        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'ask_question' }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({ message: 'What else do you have?' });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.suggestedReplies).toContain('Confirm your order');
          expect(result.value.suggestedReplies).toContain('Cancel your order');
        }
      });
    });

    describe('conversation persistence', () => {
      it('should save user and assistant messages to conversation', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: 'Welcome! What can I get for you?',
            intent: 'greeting',
          }),
        );
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        await useCase.execute({
          message: 'Hi!',
          conversationId: 'conv-123',
        });

        // Assert
        expect(mockConversationRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({ role: 'user', content: 'Hi!' }),
              expect.objectContaining({
                role: 'assistant',
                content: 'Welcome! What can I get for you?',
              }),
            ]),
          }),
        );
      });
    });

    describe('error handling', () => {
      it('should return UnexpectedError when AI service fails', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockRejectedValue(new Error('AI service unavailable'));

        // Act
        const result = await useCase.execute({ message: 'Hello!' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(UnexpectedError);
          expect(result.value.message).toContain('AI service unavailable');
        }
      });

      it('should return UnexpectedError when save fails', async () => {
        // Arrange
        mockDrinkSearcher.findSimilar.mockResolvedValue([]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({ intent: 'greeting' }),
        );
        mockConversationRepository.save.mockRejectedValue(new Error('Database error'));

        // Act
        const result = await useCase.execute({ message: 'Hello!' });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(UnexpectedError);
        }
      });
    });

    describe('modify_order intent', () => {
      it('should add item to order when intent is modify_order', async () => {
        // Arrange
        const existingOrder = createTestOrder({ id: 'order-123', withItem: true });
        const newDrink = createTestDrink({ id: 'drink-2', name: 'Mocha' });
        const conversation = createTestConversation('conv-123');

        const extractedOrder = createExtractedOrder({
          drinkName: 'Mocha',
          confidence: 0.9,
        });

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkSearcher.findSimilar.mockResolvedValue([createSearchResult(newDrink, 0.95)]);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockConversationAI.generateResponse.mockResolvedValue(
          createAIResponse({
            message: "I've added a Mocha to your order!",
            intent: 'modify_order',
            extractedOrder,
          }),
        );
        mockOrderRepository.save.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          message: 'Actually, add a mocha too',
          conversationId: 'conv-123',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.intent).toBe('modify_order');
        }
        expect(mockOrderRepository.save).toHaveBeenCalled();
      });
    });
  });
});

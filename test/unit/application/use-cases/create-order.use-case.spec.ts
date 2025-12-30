import { CreateOrderUseCase } from '@application/use-cases';
import {
  IConversationRepositoryPort,
  IDrinkRepositoryPort,
  IOrderRepositoryPort,
} from '@application/ports';
import {
  ConversationNotFoundError,
  DrinkNotFoundError,
  InvalidOrderStateError,
  OrderNotFoundError,
  UnexpectedError,
  ValidationError,
} from '@application/errors';
import { Conversation, Drink, Order } from '@domain/entities';
import {
  ConversationId,
  CustomizationOptions,
  DrinkId,
  Money,
  OrderId,
  OrderItem,
} from '@domain/value-objects';

describe('CreateOrderUseCase', () => {
  let mockConversationRepository: jest.Mocked<IConversationRepositoryPort>;
  let mockOrderRepository: jest.Mocked<IOrderRepositoryPort>;
  let mockDrinkRepository: jest.Mocked<IDrinkRepositoryPort>;
  let useCase: CreateOrderUseCase;

  // Helper to create test drinks
  const createTestDrink = (
    overrides: Partial<{
      id: string;
      name: string;
      price: number;
    }> = {},
  ): Drink => {
    return Drink.reconstitute({
      id: DrinkId.fromString(overrides.id ?? 'drink-123'),
      name: overrides.name ?? 'Caramel Latte',
      description: 'A delicious caramel latte',
      basePrice: Money.fromCents(overrides.price ?? 450),
      customizationOptions: CustomizationOptions.all(),
    });
  };

  // Helper to create test conversations
  const createTestConversation = (id?: string): Conversation => {
    return Conversation.create(id ? ConversationId.fromString(id) : undefined);
  };

  // Helper to create order items
  const createTestOrderItem = (drink: Drink, quantity = 1): OrderItem => {
    return OrderItem.create({
      drinkId: drink.id,
      drinkName: drink.name,
      quantity,
      unitPrice: drink.basePrice,
    });
  };

  // Helper to create test orders
  const createTestOrder = (
    overrides: Partial<{
      id: string;
      status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
      withItem: boolean;
    }> = {},
  ): Order => {
    const order = Order.create(overrides.id ? OrderId.fromString(overrides.id) : undefined);

    // Add an item if needed (required for confirm/complete)
    if (
      overrides.withItem ||
      overrides.status === 'confirmed' ||
      overrides.status === 'completed'
    ) {
      const drink = createTestDrink();
      const item = createTestOrderItem(drink);
      order.addItem(item);
    }

    // Change status if needed
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

    useCase = new CreateOrderUseCase(
      mockConversationRepository,
      mockOrderRepository,
      mockDrinkRepository,
    );
  });

  describe('execute (create order)', () => {
    describe('successful order creation', () => {
      it('should create a new order when no active order exists', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const drink = createTestDrink({ name: 'Cappuccino' });

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(drink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Cappuccino',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.items).toHaveLength(1);
          expect(result.value.items[0].drinkName).toBe('Cappuccino');
          expect(result.value.status).toBe('pending');
        }
      });

      it('should add item to existing pending order', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const existingDrink = createTestDrink({ id: 'drink-1', name: 'Espresso', price: 300 });
        const newDrink = createTestDrink({ id: 'drink-2', name: 'Latte', price: 450 });

        const existingOrder = createTestOrder({ id: 'order-123' });
        existingOrder.addItem(createTestOrderItem(existingDrink));

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(newDrink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(existingOrder);
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.items).toHaveLength(2);
        }
      });

      it('should apply quantity when specified', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const drink = createTestDrink({ name: 'Mocha', price: 500 });

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(drink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Mocha',
          quantity: 3,
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.items[0].quantity).toBe(3);
          expect(result.value.totalQuantity).toBe(3);
        }
      });

      it('should apply size when specified', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const drink = createTestDrink();

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(drink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
          size: 'grande',
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.items[0].size).toBe('grande');
        }
      });

      it('should apply customizations when specified', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const drink = createTestDrink();

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(drink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        mockOrderRepository.saveWithConversation.mockResolvedValue(undefined);
        mockConversationRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
          customizations: {
            milk: 'oat',
            syrup: 'vanilla',
          },
        });

        // Assert
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(result.value.items[0].customizations.milk).toBe('oat');
          expect(result.value.items[0].customizations.syrup).toBe('vanilla');
        }
      });
    });

    describe('validation errors', () => {
      it('should return validation error when conversationId is empty', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: '',
          drinkName: 'Latte',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('Conversation ID');
        }
      });

      it('should return validation error when drinkName is empty', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: '',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('Drink name');
        }
      });

      it('should return validation error when quantity is less than 1', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
          quantity: 0,
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('Quantity');
        }
      });

      it('should return validation error when quantity exceeds 10', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
          quantity: 15,
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
        }
      });

      it('should return validation error for invalid size', async () => {
        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
          size: 'extra-large',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ValidationError);
          expect(result.value.message).toContain('size');
        }
      });
    });

    describe('not found errors', () => {
      it('should return ConversationNotFoundError when conversation does not exist', async () => {
        // Arrange
        mockConversationRepository.findById.mockResolvedValue(null);

        // Act
        const result = await useCase.execute({
          conversationId: 'nonexistent',
          drinkName: 'Latte',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(ConversationNotFoundError);
        }
      });

      it('should return DrinkNotFoundError when drink does not exist', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(null);

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Nonexistent Drink',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(DrinkNotFoundError);
        }
      });
    });

    describe('error handling', () => {
      it('should return UnexpectedError when repository throws', async () => {
        // Arrange
        const conversation = createTestConversation('conv-123');
        const drink = createTestDrink({ name: 'Latte' });

        mockConversationRepository.findById.mockResolvedValue(conversation);
        mockDrinkRepository.findByName.mockResolvedValue(drink);
        mockOrderRepository.findActiveByConversationId.mockResolvedValue(null);
        // Simulate database error when saving
        mockOrderRepository.saveWithConversation.mockRejectedValue(new Error('Database error'));

        // Act
        const result = await useCase.execute({
          conversationId: 'conv-123',
          drinkName: 'Latte',
        });

        // Assert
        expect(result.isLeft()).toBe(true);
        if (result.isLeft()) {
          expect(result.value).toBeInstanceOf(UnexpectedError);
          expect(result.value.message).toContain('Database error');
        }
      });
    });
  });

  describe('confirmOrder', () => {
    it('should confirm a pending order with items', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123', withItem: true });
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await useCase.confirmOrder({ orderId: 'order-123' });

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.status).toBe('confirmed');
      }
    });

    it('should return OrderNotFoundError when order does not exist', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.confirmOrder({ orderId: 'nonexistent' });

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(OrderNotFoundError);
      }
    });

    it('should return InvalidOrderStateError when order cannot be confirmed', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123', status: 'completed' });
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await useCase.confirmOrder({ orderId: 'order-123' });

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(InvalidOrderStateError);
      }
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a pending order', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123' });
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await useCase.cancelOrder({ orderId: 'order-123' });

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.status).toBe('cancelled');
      }
    });

    it('should return OrderNotFoundError when order does not exist', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.cancelOrder({ orderId: 'nonexistent' });

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(OrderNotFoundError);
      }
    });

    it('should return InvalidOrderStateError when order is already completed', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123', status: 'completed' });
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await useCase.cancelOrder({ orderId: 'order-123' });

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(InvalidOrderStateError);
      }
    });

    it('should return InvalidOrderStateError when order is already cancelled', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123', status: 'cancelled' });
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await useCase.cancelOrder({ orderId: 'order-123' });

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(InvalidOrderStateError);
      }
    });
  });

  describe('getOrder', () => {
    it('should return order when found', async () => {
      // Arrange
      const order = createTestOrder({ id: 'order-123' });
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await useCase.getOrder('order-123');

      // Assert
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.orderId).toBe('order-123');
      }
    });

    it('should return OrderNotFoundError when order does not exist', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.getOrder('nonexistent');

      // Assert
      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(OrderNotFoundError);
      }
    });
  });
});

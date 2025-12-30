import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeConversationAdapter } from '@infrastructure/adapters';
import { Drink } from '@domain/entities';
import { CustomizationOptions, Money } from '@domain/value-objects';

// Mock the Anthropic SDK
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('ClaudeConversationAdapter', () => {
  let adapter: ClaudeConversationAdapter;
  let module: TestingModule;

  const createTestDrink = (name: string): Drink => {
    return Drink.create({
      name,
      description: `Delicious ${name}`,
      basePrice: Money.fromDollars(5),
      customizationOptions: new CustomizationOptions(true, true, false, false, true),
    });
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ClaudeConversationAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    adapter = module.get<ClaudeConversationAdapter>(ClaudeConversationAdapter);
    adapter.onModuleInit();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    // Reset mock before each test
    mockCreate.mockReset();
  });

  describe('generateResponse', () => {
    it('should generate a response from Claude', async () => {
      // Arrange
      // Mock three sequential calls: generateResponse, detectIntent, extractOrderFromMessage
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: 'Hello! I would be happy to help you order a drink. What would you like?',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'order_drink' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                drinkName: 'Coffee',
                size: null,
                quantity: 1,
                confidence: 0.8,
              }),
            },
          ],
        });

      const input = {
        userMessage: 'Hi, I want to order a coffee',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte'), createTestDrink('Cappuccino')],
        currentOrderSummary: null,
      };

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.message).toContain('Hello');
      expect(mockCreate).toHaveBeenCalledTimes(3); // generateResponse calls detectIntent and possibly extractOrder
    });

    it('should include relevant drinks in context', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'We have great lattes!' }],
      });

      const drinks = [createTestDrink('Caramel Latte'), createTestDrink('Vanilla Latte')];
      const input = {
        userMessage: 'What lattes do you have?',
        conversationHistory: '',
        relevantDrinks: drinks,
        currentOrderSummary: null,
      };

      // Act
      await adapter.generateResponse(input);

      // Assert - Verify the system prompt contains drink info
      const call = mockCreate.mock.calls[0];
      expect(call[0].system).toContain('Caramel Latte');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error('API Error'));

      const input = {
        userMessage: 'Hello',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      // Act
      const result = await adapter.generateResponse(input);

      // Assert - Should return error response, not throw
      expect(result.message).toContain('trouble');
      expect(result.intent).toBe('unknown');
    });
  });

  describe('detectIntent', () => {
    it('should detect order_drink intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'order_drink' }],
      });

      // Act
      const intent = await adapter.detectIntent('I want a large caramel latte');

      // Assert
      expect(intent).toBe('order_drink');
    });

    it('should detect greeting intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'greeting' }],
      });

      // Act
      const intent = await adapter.detectIntent('Hello!');

      // Assert
      expect(intent).toBe('greeting');
    });

    it('should detect confirm_order intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'confirm_order' }],
      });

      // Act
      const intent = await adapter.detectIntent('Yes, that looks correct. Please confirm.');

      // Assert
      expect(intent).toBe('confirm_order');
    });

    it('should detect cancel_order intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'cancel_order' }],
      });

      // Act
      const intent = await adapter.detectIntent('Cancel my order please');

      // Assert
      expect(intent).toBe('cancel_order');
    });

    it('should detect ask_question intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ask_question' }],
      });

      // Act
      const intent = await adapter.detectIntent('What sizes do you have?');

      // Assert
      expect(intent).toBe('ask_question');
    });

    it('should return unknown for unrecognized intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'something_invalid' }],
      });

      // Act
      const intent = await adapter.detectIntent('asdfghjkl');

      // Assert
      expect(intent).toBe('unknown');
    });

    it('should handle API errors and return unknown', async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error('API Error'));

      // Act
      const intent = await adapter.detectIntent('Hello');

      // Assert
      expect(intent).toBe('unknown');
    });
  });

  describe('extractOrderFromMessage', () => {
    it('should extract drink order information', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              drinkName: 'Caramel Latte',
              size: 'grande',
              quantity: 2,
              customizations: {
                milk: 'oat',
                syrup: null,
              },
              confidence: 0.95,
            }),
          },
        ],
      });

      const drinks = [createTestDrink('Caramel Latte')];

      // Act
      const result = await adapter.extractOrderFromMessage(
        'I want 2 grande caramel lattes with oat milk',
        drinks,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.drinkName).toBe('Caramel Latte');
      expect(result?.quantity).toBe(2);
      expect(result?.confidence).toBe(0.95);
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```json\n{"drinkName": "Latte", "size": "tall", "quantity": 1, "confidence": 0.8}\n```',
          },
        ],
      });

      // Act
      const result = await adapter.extractOrderFromMessage('A tall latte please', []);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.drinkName).toBe('Latte');
    });

    it('should return null when extraction fails', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I could not understand the order' }],
      });

      // Act
      const result = await adapter.extractOrderFromMessage('random gibberish', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle API errors and return null', async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.extractOrderFromMessage('A latte please', []);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('containsOrderIntent', () => {
    it('should return true for order-related messages', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'order_drink' }],
      });

      // Act
      const result = await adapter.containsOrderIntent('I want a latte');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for modify_order intent', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'modify_order' }],
      });

      // Act
      const result = await adapter.containsOrderIntent('Change my order to a cappuccino');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-order messages', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'greeting' }],
      });

      // Act
      const result = await adapter.containsOrderIntent('Hello!');

      // Assert
      expect(result).toBe(false);
    });
  });
});

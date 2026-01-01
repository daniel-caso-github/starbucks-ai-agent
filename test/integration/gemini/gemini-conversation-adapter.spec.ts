import { Test, TestingModule } from '@nestjs/testing';
import { GeminiConversationAdapter, MessageSanitizerService } from '@infrastructure/adapters/ai/gemini';
import { EnvConfigService } from '@infrastructure/config';
import { Drink } from '@domain/entities';
import { CustomizationOptions, Money } from '@domain/value-objects';

// Mock the Google Generative AI SDK
const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  class GoogleGenerativeAIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'GoogleGenerativeAIError';
    }
  }

  const MockGenerativeModel = jest.fn().mockImplementation(() => ({
    generateContent: mockGenerateContent,
  }));

  const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: MockGenerativeModel,
  }));

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    GoogleGenerativeAIError,
    FunctionCallingMode: { AUTO: 'AUTO' },
    SchemaType: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
    },
  };
});

describe('GeminiConversationAdapter', () => {
  let adapter: GeminiConversationAdapter;
  let module: TestingModule;

  const createTestDrink = (name: string): Drink => {
    return Drink.create({
      name,
      description: `Delicious ${name}`,
      basePrice: Money.fromDollars(5),
      customizationOptions: new CustomizationOptions(true, true, false, false, true),
    });
  };

  const createMockTextResponse = (text: string) => ({
    response: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
      text: () => text,
    },
  });

  const createMockFunctionCallResponse = (
    functionName: string,
    args: object,
    text = '',
  ) => ({
    response: {
      candidates: [
        {
          content: {
            parts: [
              ...(text ? [{ text }] : []),
              {
                functionCall: {
                  name: functionName,
                  args,
                },
              },
            ],
          },
        },
      ],
      text: () => text,
    },
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        GeminiConversationAdapter,
        MessageSanitizerService,
        {
          provide: EnvConfigService,
          useValue: {
            googleAiApiKey: 'test-api-key',
          },
        },
      ],
    }).compile();

    adapter = module.get<GeminiConversationAdapter>(GeminiConversationAdapter);
    adapter.onModuleInit();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  describe('generateResponse', () => {
    it('should generate a response from Gemini', async () => {
      // Arrange
      // First call for generateResponse (no function call, just text)
      mockGenerateContent.mockResolvedValueOnce(
        createMockTextResponse('Hello! I would be happy to help you order a drink. What would you like?'),
      );
      // Second call for detectIntent (when no function call is found)
      mockGenerateContent.mockResolvedValueOnce(createMockTextResponse('greeting'));

      const input = {
        userMessage: 'Hi there!',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte'), createTestDrink('Cappuccino')],
        currentOrderSummary: null,
      };

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.message).toContain('Hello');
      expect(result.intent).toBe('greeting');
    });

    it('should handle function call for ordering a drink', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'create_order',
          { drinkName: 'Latte', size: 'grande', quantity: 1, customizations: {} },
          '¡Perfecto! Te agrego un Latte grande a tu orden.',
        ),
      );

      const input = {
        userMessage: 'I want a grande latte',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte')],
        currentOrderSummary: null,
      };

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('order_drink');
      expect(result.extractedOrder).not.toBeNull();
      expect(result.extractedOrder?.drinkName).toBe('Latte');
      expect(result.extractedOrder?.quantity).toBe(1);
    });

    it('should include relevant drinks in context', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createMockTextResponse('We have great lattes!'),
      );
      mockGenerateContent.mockResolvedValueOnce(createMockTextResponse('ask_question'));

      const drinks = [createTestDrink('Caramel Latte'), createTestDrink('Vanilla Latte')];
      const input = {
        userMessage: 'What lattes do you have?',
        conversationHistory: '',
        relevantDrinks: drinks,
        currentOrderSummary: null,
      };

      // Act
      await adapter.generateResponse(input);

      // Assert
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Use fake timers to avoid waiting for retry delays
      jest.useFakeTimers();

      // Arrange
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      const input = {
        userMessage: 'Hello',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      // Act - start the async operation
      const resultPromise = adapter.generateResponse(input);

      // Advance timers to complete all retry delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // Assert - Should return error response in Spanish, not throw
      expect(result.message).toContain('problema');
      expect(result.intent).toBe('unknown');

      // Restore real timers
      jest.useRealTimers();
    });
  });

  describe('detectIntent', () => {
    it('should detect order_drink intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('order_drink'));

      // Act
      const intent = await adapter.detectIntent('I want a large caramel latte');

      // Assert
      expect(intent).toBe('order_drink');
    });

    it('should detect greeting intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('greeting'));

      // Act
      const intent = await adapter.detectIntent('Hello!');

      // Assert
      expect(intent).toBe('greeting');
    });

    it('should detect confirm_order intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('confirm_order'));

      // Act
      const intent = await adapter.detectIntent('Yes, that looks correct. Please confirm.');

      // Assert
      expect(intent).toBe('confirm_order');
    });

    it('should detect cancel_order intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('cancel_order'));

      // Act
      const intent = await adapter.detectIntent('Cancel my order please');

      // Assert
      expect(intent).toBe('cancel_order');
    });

    it('should detect process_payment intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('process_payment'));

      // Act
      const intent = await adapter.detectIntent('Proceder al pago');

      // Assert
      expect(intent).toBe('process_payment');
    });

    it('should detect ask_question intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('ask_question'));

      // Act
      const intent = await adapter.detectIntent('What sizes do you have?');

      // Assert
      expect(intent).toBe('ask_question');
    });

    it('should return unknown for unrecognized intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('something_invalid'));

      // Act
      const intent = await adapter.detectIntent('asdfghjkl');

      // Assert
      expect(intent).toBe('unknown');
    });

    it('should handle API errors and return unknown', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act
      const intent = await adapter.detectIntent('Hello');

      // Assert
      expect(intent).toBe('unknown');
    });
  });

  describe('extractOrderFromMessage', () => {
    it('should extract drink order information using function calling', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        createMockFunctionCallResponse('create_order', {
          drinkName: 'Caramel Latte',
          size: 'grande',
          quantity: 2,
          customizations: { milk: 'oat' },
        }),
      );

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
      expect(result?.size?.value).toBe('grande');
      expect(result?.customizations.milk).toBe('oat');
    });

    it('should return null when no function call in response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        createMockTextResponse('I could not understand the order'),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('random gibberish', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle API errors and return null', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.extractOrderFromMessage('A latte please', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should default to quantity 1 when not specified', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        createMockFunctionCallResponse('create_order', { drinkName: 'Espresso' }),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('An espresso please', []);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.quantity).toBe(1);
    });
  });

  describe('containsOrderIntent', () => {
    it('should return true for order-related messages', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('order_drink'));

      // Act
      const result = await adapter.containsOrderIntent('I want a latte');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for modify_order intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('modify_order'));

      // Act
      const result = await adapter.containsOrderIntent('Change my order to a cappuccino');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-order messages', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('greeting'));

      // Act
      const result = await adapter.containsOrderIntent('Hello!');

      // Assert
      expect(result).toBe(false);
    });
  });
});

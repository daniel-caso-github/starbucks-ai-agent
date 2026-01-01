import { Test, TestingModule } from '@nestjs/testing';
import { GeminiConversationAdapter, MessageSanitizerService } from '@infrastructure/adapters/ai/gemini';
import { EnvConfigService } from '@infrastructure/config';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';
import { GenerateResponseInputDto } from '@application/dtos/conversation-ai.dto';

// Mock Google Generative AI SDK - everything inside factory to avoid hoisting issues
const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  // Define GoogleGenerativeAIError inside factory
  class GoogleGenerativeAIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'GoogleGenerativeAIError';
    }
  }

  // Mock GenerativeModel
  const MockGenerativeModel = jest.fn().mockImplementation(() => ({
    generateContent: mockGenerateContent,
  }));

  // Mock GoogleGenerativeAI
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
  let mockEnvConfigService: Partial<EnvConfigService>;

  const createTestDrink = (name: string): Drink => {
    return Drink.reconstitute({
      id: DrinkId.generate(),
      name,
      description: `A delicious ${name}`,
      basePrice: Money.fromDollars(5),
      customizationOptions: CustomizationOptions.all(),
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

  const createMockFunctionCallResponse = (functionName: string, args: object, text = '') => ({
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

  beforeEach(async () => {
    mockGenerateContent.mockReset();

    mockEnvConfigService = {
      googleAiApiKey: 'test-api-key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiConversationAdapter,
        MessageSanitizerService,
        {
          provide: EnvConfigService,
          useValue: mockEnvConfigService,
        },
      ],
    }).compile();

    adapter = module.get<GeminiConversationAdapter>(GeminiConversationAdapter);
    adapter.onModuleInit();
  });

  describe('generateResponse', () => {
    it('should generate a response from Gemini', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Hola',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte')],
        currentOrderSummary: null,
      };

      // First call for generateResponse (no function call, just text)
      mockGenerateContent.mockResolvedValueOnce(
        createMockTextResponse('¡Hola! Bienvenido a Starbucks. ¿Qué te puedo servir?'),
      );
      // Second call for detectIntent (when no function call is found)
      mockGenerateContent.mockResolvedValueOnce(createMockTextResponse('greeting'));

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.message).toContain('Hola');
      expect(result.intent).toBe('greeting');
    });

    it('should handle create_order function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Quiero un latte',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte')],
        currentOrderSummary: null,
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'create_order',
          { drinkName: 'Latte', size: 'grande', quantity: 1 },
          '¡Perfecto! Te agrego un Latte grande.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('order_drink');
      expect(result.extractedOrder).not.toBeNull();
      expect(result.extractedOrder?.drinkName).toBe('Latte');
    });

    it('should handle multiple function calls for multiple items', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Quiero un latte y un cappuccino',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte'), createTestDrink('Cappuccino')],
        currentOrderSummary: null,
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  { text: '¡Perfecto! Te agrego un Latte y un Cappuccino.' },
                  {
                    functionCall: {
                      name: 'create_order',
                      args: { drinkName: 'Latte', size: 'grande', quantity: 1 },
                    },
                  },
                  {
                    functionCall: {
                      name: 'create_order',
                      args: { drinkName: 'Cappuccino', size: 'grande', quantity: 1 },
                    },
                  },
                ],
              },
            },
          ],
          text: () => '¡Perfecto! Te agrego un Latte y un Cappuccino.',
        },
      });

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('order_drink');
      expect(result.extractedOrders).not.toBeNull();
      expect(result.extractedOrders?.items).toHaveLength(2);
      expect(result.extractedOrders?.items[0].drinkName).toBe('Latte');
      expect(result.extractedOrders?.items[1].drinkName).toBe('Cappuccino');
    });

    it('should handle modify_order function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Cambia el primero a venti',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1. Latte grande - $5.00',
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'modify_order',
          { itemIndex: 1, changes: { newSize: 'venti' } },
          'He cambiado tu Latte a tamaño venti.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('modify_order');
      expect(result.extractedModifications).toHaveLength(1);
      expect(result.extractedModifications[0].action).toBe('modify');
      expect(result.extractedModifications[0].itemIndex).toBe(1);
    });

    it('should handle remove_from_order function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Quita el Latte',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1. Latte - $5.00\n2. Cappuccino - $5.00',
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'remove_from_order',
          { drinkName: 'Latte' },
          'He eliminado el Latte de tu orden.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('modify_order');
      expect(result.extractedModifications).toHaveLength(1);
      expect(result.extractedModifications[0].action).toBe('remove');
      expect(result.extractedModifications[0].drinkName).toBe('Latte');
    });

    it('should handle confirm_order function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Confirmar mi orden',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1. Latte - $5.00',
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'confirm_order',
          { confirmationMessage: '¡Tu orden está confirmada!' },
          '¡Perfecto! Tu orden de 1 Latte por $5.00 está confirmada.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('confirm_order');
      expect(result.suggestedActions).toContainEqual(
        expect.objectContaining({ type: 'confirm_order' }),
      );
    });

    it('should handle cancel_order function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Cancelar todo',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1. Latte - $5.00',
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'cancel_order',
          { reason: 'Cliente solicitó cancelación' },
          'He cancelado tu orden.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('cancel_order');
    });

    it('should handle process_payment function call', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Proceder al pago',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1. Latte - $5.00',
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockFunctionCallResponse(
          'process_payment',
          { paymentMessage: '¡Gracias por tu compra!' },
          '¡Gracias por tu compra! Tu orden está lista.',
        ),
      );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('process_payment');
    });

    it('should return error response when API fails', async () => {
      // Use fake timers to avoid waiting for retry delays
      jest.useFakeTimers();

      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Hello',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act - start the async operation
      const resultPromise = adapter.generateResponse(input);

      // Advance timers to complete all retry delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // Assert
      expect(result.intent).toBe('unknown');
      expect(result.message).toContain('problema');
      expect(result.extractedOrder).toBeNull();

      // Restore real timers
      jest.useRealTimers();
    });

    it('should include relevant drinks in system prompt', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'What drinks do you have?',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte'), createTestDrink('Cappuccino')],
        currentOrderSummary: null,
      };

      mockGenerateContent.mockResolvedValueOnce(
        createMockTextResponse('We have Latte and Cappuccino!'),
      );
      mockGenerateContent.mockResolvedValueOnce(createMockTextResponse('ask_question'));

      // Act
      await adapter.generateResponse(input);

      // Assert
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });

  describe('extractOrderFromMessage', () => {
    it('should extract order details using function calling', async () => {
      // Arrange
      const drinks = [createTestDrink('Latte'), createTestDrink('Espresso')];
      mockGenerateContent.mockResolvedValue(
        createMockFunctionCallResponse('create_order', {
          drinkName: 'Latte',
          size: 'venti',
          quantity: 2,
          customizations: { milk: 'oat' },
        }),
      );

      // Act
      const result = await adapter.extractOrderFromMessage(
        'I want 2 venti lattes with oat milk',
        drinks,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.drinkName).toBe('Latte');
      expect(result?.size?.value).toBe('venti');
      expect(result?.quantity).toBe(2);
      expect(result?.customizations.milk).toBe('oat');
    });

    it('should return null when no function call in response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        createMockTextResponse('I need more information about what you want.'),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('something', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.extractOrderFromMessage('test', []);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('detectIntent', () => {
    it.each([
      ['order_drink', 'I want a latte'],
      ['modify_order', 'Change my order'],
      ['cancel_order', 'Cancel everything'],
      ['confirm_order', 'Confirm my order'],
      ['process_payment', 'Proceder al pago'],
      ['ask_question', 'What drinks do you have?'],
      ['greeting', 'Hello'],
    ])('should detect %s intent', async (expectedIntent, message) => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse(expectedIntent));

      // Act
      const result = await adapter.detectIntent(message);

      // Assert
      expect(result).toBe(expectedIntent);
    });

    it('should return unknown for invalid intent', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('invalid_intent'));

      // Act
      const result = await adapter.detectIntent('test');

      // Assert
      expect(result).toBe('unknown');
    });

    it('should return unknown on API error', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.detectIntent('test');

      // Assert
      expect(result).toBe('unknown');
    });
  });

  describe('containsOrderIntent', () => {
    it('should return true for order_drink intent', async () => {
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
      const result = await adapter.containsOrderIntent('Add another one');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-order intents', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(createMockTextResponse('greeting'));

      // Act
      const result = await adapter.containsOrderIntent('Hello');

      // Assert
      expect(result).toBe(false);
    });
  });
});

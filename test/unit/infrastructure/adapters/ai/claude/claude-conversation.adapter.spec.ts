import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeConversationAdapter } from '@infrastructure/adapters/ai/claude';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';
import { GenerateResponseInputDto } from '@application/dtos/conversation-ai.dto';

// Mock Anthropic SDK
const mockMessagesCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  })),
}));

describe('ClaudeConversationAdapter', () => {
  let adapter: ClaudeConversationAdapter;
  let mockConfigService: jest.Mocked<ConfigService>;

  const createTestDrink = (name: string): Drink => {
    return Drink.reconstitute({
      id: DrinkId.generate(),
      name,
      description: `A delicious ${name}`,
      basePrice: Money.fromDollars(5),
      customizationOptions: CustomizationOptions.all(),
    });
  };

  const createMockApiResponse = (text: string) => ({
    content: [{ type: 'text', text }],
  });

  beforeEach(async () => {
    mockMessagesCreate.mockReset();

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeConversationAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<ClaudeConversationAdapter>(ClaudeConversationAdapter);
    adapter.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize the client with API key', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('should handle missing API key gracefully', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClaudeConversationAdapter,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const newAdapter = module.get<ClaudeConversationAdapter>(ClaudeConversationAdapter);

      expect(() => newAdapter.onModuleInit()).not.toThrow();
    });
  });

  describe('generateResponse', () => {
    it('should generate a response for user message', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'What drinks do you recommend?',
        conversationHistory: '',
        relevantDrinks: [createTestDrink('Latte'), createTestDrink('Cappuccino')],
        currentOrderSummary: null,
      };

      mockMessagesCreate
        .mockResolvedValueOnce(createMockApiResponse('I recommend our delicious Latte!'))
        .mockResolvedValueOnce(createMockApiResponse('ask_question'));

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.message).toBe('I recommend our delicious Latte!');
      expect(result.intent).toBe('ask_question');
      expect(mockMessagesCreate).toHaveBeenCalled();
    });

    it('should handle order_drink intent with extraction', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'I want a grande latte',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      mockMessagesCreate
        .mockResolvedValueOnce(createMockApiResponse("I'll add a grande latte!"))
        .mockResolvedValueOnce(createMockApiResponse('order_drink'))
        .mockResolvedValueOnce(
          createMockApiResponse(
            JSON.stringify({
              drinkName: 'Latte',
              size: 'grande',
              quantity: 1,
              customizations: {},
              confidence: 0.9,
            }),
          ),
        );

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('order_drink');
      expect(result.extractedOrder).not.toBeNull();
      expect(result.extractedOrder?.drinkName).toBe('Latte');
      expect(result.extractedOrder?.size?.value).toBe('grande');
    });

    it('should return error response when API fails', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Hello',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      mockMessagesCreate.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.generateResponse(input);

      // Assert
      expect(result.intent).toBe('unknown');
      expect(result.message).toContain('trouble');
      expect(result.extractedOrder).toBeNull();
    });

    it('should include conversation history in prompt', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'What about iced drinks?',
        conversationHistory: '[user]: Hello\n[assistant]: Hi! How can I help?',
        relevantDrinks: [],
        currentOrderSummary: null,
      };

      mockMessagesCreate
        .mockResolvedValueOnce(createMockApiResponse('We have great iced drinks!'))
        .mockResolvedValueOnce(createMockApiResponse('ask_question'));

      // Act
      await adapter.generateResponse(input);

      // Assert
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Previous conversation'),
            }),
          ],
        }),
      );
    });

    it('should include current order summary in system prompt', async () => {
      // Arrange
      const input: GenerateResponseInputDto = {
        userMessage: 'Anything else?',
        conversationHistory: '',
        relevantDrinks: [],
        currentOrderSummary: '1x Latte - $5.00',
      };

      mockMessagesCreate
        .mockResolvedValueOnce(createMockApiResponse('Your order looks good!'))
        .mockResolvedValueOnce(createMockApiResponse('ask_question'));

      // Act
      await adapter.generateResponse(input);

      // Assert
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Current order'),
        }),
      );
    });
  });

  describe('extractOrderFromMessage', () => {
    it('should extract order details from message', async () => {
      // Arrange
      const drinks = [createTestDrink('Latte'), createTestDrink('Espresso')];
      mockMessagesCreate.mockResolvedValue(
        createMockApiResponse(
          JSON.stringify({
            drinkName: 'Latte',
            size: 'venti',
            quantity: 2,
            customizations: { milk: 'oat' },
            confidence: 0.95,
          }),
        ),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('I want 2 venti lattes with oat milk', drinks);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.drinkName).toBe('Latte');
      expect(result?.size?.value).toBe('venti');
      expect(result?.quantity).toBe(2);
      expect(result?.customizations.milk).toBe('oat');
      expect(result?.confidence).toBe(0.95);
    });

    it('should handle JSON wrapped in code blocks', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        createMockApiResponse(
          '```json\n{"drinkName": "Espresso", "quantity": 1, "confidence": 0.8}\n```',
        ),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('One espresso please', []);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.drinkName).toBe('Espresso');
    });

    it('should return null on API error', async () => {
      // Arrange
      mockMessagesCreate.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.extractOrderFromMessage('test', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null on invalid JSON', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('not valid json'));

      // Act
      const result = await adapter.extractOrderFromMessage('test', []);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle invalid size gracefully', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        createMockApiResponse(
          JSON.stringify({
            drinkName: 'Latte',
            size: 'invalid_size',
            quantity: 1,
            confidence: 0.8,
          }),
        ),
      );

      // Act
      const result = await adapter.extractOrderFromMessage('test', []);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.size).toBeNull();
    });
  });

  describe('detectIntent', () => {
    it.each([
      ['order_drink', 'I want a latte'],
      ['modify_order', 'Change my order'],
      ['cancel_order', 'Cancel everything'],
      ['confirm_order', 'Confirm my order'],
      ['ask_question', 'What drinks do you have?'],
      ['greeting', 'Hello'],
    ])('should detect %s intent', async (expectedIntent, message) => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse(expectedIntent));

      // Act
      const result = await adapter.detectIntent(message);

      // Assert
      expect(result).toBe(expectedIntent);
    });

    it('should return unknown for invalid intent', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('invalid_intent'));

      // Act
      const result = await adapter.detectIntent('test');

      // Assert
      expect(result).toBe('unknown');
    });

    it('should return unknown on API error', async () => {
      // Arrange
      mockMessagesCreate.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await adapter.detectIntent('test');

      // Assert
      expect(result).toBe('unknown');
    });

    it('should include conversation history when provided', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('order_drink'));

      // Act
      await adapter.detectIntent('Add that one', 'Previous conversation here');

      // Assert
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Previous conversation'),
            }),
          ],
        }),
      );
    });
  });

  describe('containsOrderIntent', () => {
    it('should return true for order_drink intent', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('order_drink'));

      // Act
      const result = await adapter.containsOrderIntent('I want a latte');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for modify_order intent', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('modify_order'));

      // Act
      const result = await adapter.containsOrderIntent('Add another one');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-order intents', async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(createMockApiResponse('greeting'));

      // Act
      const result = await adapter.containsOrderIntent('Hello');

      // Assert
      expect(result).toBe(false);
    });
  });
});

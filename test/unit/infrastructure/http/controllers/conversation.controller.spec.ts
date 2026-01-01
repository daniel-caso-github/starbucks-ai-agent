import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationController } from '@infrastructure/http/controllers/conversation.controller';
import { ProcessMessageUseCase, ProcessMessageStreamUseCase } from '@application/use-cases';
import { IConversationRepositoryPort } from '@application/ports/outbound';
import { Conversation } from '@domain/entities';
import { ConversationId, OrderId } from '@domain/value-objects';
import { left, right } from '@application/common/either';
import { ProcessMessageOutputDto } from '@application/dtos/process-message.dto';
import { ConversationIntentType } from '@application/dtos/conversation-ai.dto';
import { ConversationNotFoundError, ValidationError } from '@application/errors/application.errors';

describe('ConversationController', () => {
  let controller: ConversationController;
  let mockProcessMessageUseCase: jest.Mocked<ProcessMessageUseCase>;
  let mockProcessMessageStreamUseCase: jest.Mocked<ProcessMessageStreamUseCase>;
  let mockConversationRepository: jest.Mocked<IConversationRepositoryPort>;

  const createTestConversation = (id?: string): Conversation => {
    const conversation = Conversation.create(ConversationId.fromString(id ?? 'conv_test'));
    conversation.addUserMessage('Hello');
    conversation.addAssistantMessage('Hi! How can I help you?');
    return conversation;
  };

  beforeEach(async () => {
    mockProcessMessageUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessMessageUseCase>;

    mockProcessMessageStreamUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessMessageStreamUseCase>;

    mockConversationRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getRecentHistory: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepositoryPort>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: 'ProcessMessageUseCase',
          useValue: mockProcessMessageUseCase,
        },
        {
          provide: 'ProcessMessageStreamUseCase',
          useValue: mockProcessMessageStreamUseCase,
        },
        {
          provide: 'IConversationRepository',
          useValue: mockConversationRepository,
        },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
  });

  describe('sendMessage', () => {
    it('should process message successfully', async () => {
      // Arrange
      const successResponse: ProcessMessageOutputDto = {
        response: '¡Perfecto! Te agrego un Latte.',
        conversationId: 'conv_123',
        intent: 'order_drink' as ConversationIntentType,
        currentOrder: null,
        suggestedReplies: ['Confirmar mi orden', 'Ver el menú'],
      };
      mockProcessMessageUseCase.execute.mockResolvedValue(right(successResponse));

      // Act
      const result = await controller.sendMessage({
        message: 'Quiero un latte',
        conversationId: undefined,
      });

      // Assert
      expect(result.response).toBe('¡Perfecto! Te agrego un Latte.');
      expect(result.conversationId).toBe('conv_123');
      expect(result.intent).toBe('order_drink');
    });

    it('should handle existing conversation', async () => {
      // Arrange
      const successResponse: ProcessMessageOutputDto = {
        response: 'Tu orden ha sido actualizada.',
        conversationId: 'conv_existing',
        intent: 'modify_order' as ConversationIntentType,
        currentOrder: { orderId: 'ord_123', status: 'pending', items: [], totalPrice: '$0.00', itemCount: 0, canConfirm: false },
        suggestedReplies: [],
      };
      mockProcessMessageUseCase.execute.mockResolvedValue(right(successResponse));

      // Act
      const result = await controller.sendMessage({
        message: 'Cambia a grande',
        conversationId: 'conv_existing',
      });

      // Assert
      expect(result.conversationId).toBe('conv_existing');
    });

    it('should throw NotFoundException for 404 errors', async () => {
      // Arrange
      mockProcessMessageUseCase.execute.mockResolvedValue(
        left(new ConversationNotFoundError('conv_notfound')),
      );

      // Act & Assert
      await expect(
        controller.sendMessage({
          message: 'Hello',
          conversationId: 'conv_notfound',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for other errors', async () => {
      // Arrange
      mockProcessMessageUseCase.execute.mockResolvedValue(
        left(new ValidationError('Invalid request')),
      );

      // Act & Assert
      await expect(
        controller.sendMessage({
          message: '',
          conversationId: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return suggested replies', async () => {
      // Arrange
      const successResponse: ProcessMessageOutputDto = {
        response: 'Welcome!',
        conversationId: 'conv_123',
        intent: 'greeting' as ConversationIntentType,
        currentOrder: null,
        suggestedReplies: ['Ver el menú', 'Hacer un pedido'],
      };
      mockProcessMessageUseCase.execute.mockResolvedValue(right(successResponse));

      // Act
      const result = await controller.sendMessage({
        message: 'Hola',
        conversationId: undefined,
      });

      // Assert
      expect(result.suggestedReplies).toContain('Ver el menú');
      expect(result.suggestedReplies).toContain('Hacer un pedido');
    });
  });

  describe('getConversation', () => {
    it('should return conversation when found', async () => {
      // Arrange
      const conversation = createTestConversation('conv_found');
      mockConversationRepository.findById.mockResolvedValue(conversation);

      // Act
      const result = await controller.getConversation('conv_found');

      // Assert
      expect(result.id).toBe('conv_found');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello');
    });

    it('should throw NotFoundException when conversation not found', async () => {
      // Arrange
      mockConversationRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getConversation('conv_notfound')).rejects.toThrow(NotFoundException);
    });

    it('should include timestamps in response', async () => {
      // Arrange
      const conversation = createTestConversation();
      mockConversationRepository.findById.mockResolvedValue(conversation);

      // Act
      const result = await controller.getConversation('conv_test');

      // Assert
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.messages[0].timestamp).toBeDefined();
    });

    it('should include currentOrderId when present', async () => {
      // Arrange
      const conversation = createTestConversation();
      conversation.setCurrentOrder(OrderId.fromString('ord_123'));
      mockConversationRepository.findById.mockResolvedValue(conversation);

      // Act
      const result = await controller.getConversation('conv_test');

      // Assert
      expect(result.currentOrderId).toBe('ord_123');
    });

    it('should return null currentOrderId when not present', async () => {
      // Arrange
      const conversation = createTestConversation();
      mockConversationRepository.findById.mockResolvedValue(conversation);

      // Act
      const result = await controller.getConversation('conv_test');

      // Assert
      expect(result.currentOrderId).toBeNull();
    });
  });
});

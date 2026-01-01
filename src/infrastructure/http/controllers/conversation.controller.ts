import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, from, map, catchError, of } from 'rxjs';
import { ProcessMessageUseCase, ProcessMessageStreamUseCase } from '@application/use-cases';
import { IConversationRepositoryPort } from '@application/ports/outbound';
import { ConversationId } from '@domain/value-objects';
import { SendMessageRequestDto } from '../dtos/request';

/**
 * Controller for conversation-related endpoints.
 *
 * This controller handles all interactions with the barista AI,
 * including starting new conversations and sending messages.
 * Each conversation maintains state including order information
 * and chat history for context-aware responses.
 */
@ApiTags('Conversations')
@Controller('api/v1/conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    @Inject('ProcessMessageUseCase')
    private readonly processMessageUseCase: ProcessMessageUseCase,
    @Inject('ProcessMessageStreamUseCase')
    private readonly processMessageStreamUseCase: ProcessMessageStreamUseCase,
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepositoryPort,
  ) {}

  /**
   * Send a message to the barista AI.
   *
   * This is the main endpoint for interacting with the AI barista.
   * If no conversationId is provided, a new conversation is created.
   * The AI will understand natural language requests like:
   * - "Quiero un latte grande"
   * - "¿Qué bebidas frías tienen?"
   * - "Agregar un cappuccino a mi orden"
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute for chat (AI cost protection)
  @ApiOperation({
    summary: 'Send a message to the barista AI',
    description: `Send a natural language message to the AI barista. 
    The barista can help with ordering drinks, answering questions about the menu, 
    and managing orders. If no conversationId is provided, a new conversation is started.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          example: '¡Perfecto! Te agrego un Caffè Latte grande a tu orden.',
        },
        conversationId: {
          type: 'string',
          example: 'conv_abc123-def456-ghi789',
        },
        intent: {
          type: 'string',
          enum: [
            'order_drink',
            'modify_order',
            'cancel_order',
            'confirm_order',
            'ask_question',
            'greeting',
            'unknown',
          ],
          example: 'order_drink',
        },
        currentOrder: {
          type: 'object',
          nullable: true,
          properties: {
            orderId: { type: 'string', example: 'ord_abc123' },
            status: { type: 'string', example: 'pending' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  drinkName: { type: 'string', example: 'Caffè Latte' },
                  size: { type: 'string', example: 'grande' },
                  quantity: { type: 'number', example: 1 },
                  price: { type: 'string', example: '$4.75' },
                },
              },
            },
            totalPrice: { type: 'string', example: '$4.75' },
            itemCount: { type: 'number', example: 1 },
            canConfirm: { type: 'boolean', example: true },
          },
        },
        suggestedReplies: {
          type: 'array',
          items: { type: 'string' },
          example: ['Agregar otra bebida', 'Confirmar mi orden', 'Ver el menú'],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  async sendMessage(@Body() dto: SendMessageRequestDto): Promise<{
    response: string;
    conversationId: string;
    intent: string;
    currentOrder: object | null;
    suggestedReplies: string[];
  }> {
    this.logger.debug(
      `Processing message: conversationId=${dto.conversationId ?? 'new'}, messageLength=${
        dto.message.length
      }`,
    );

    const result = await this.processMessageUseCase.execute({
      message: dto.message,
      conversationId: dto.conversationId,
    });

    if (result.isLeft()) {
      const error = result.value;
      this.logger.warn(`Message processing failed: ${error.message}`);
      if (error.statusCode === 404) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }

    this.logger.debug(`Message processed: intent=${result.value.intent}`);

    return result.value;
  }

  /**
   * Get conversation history by ID.
   *
   * Retrieves the full conversation including all messages exchanged
   * between the user and the barista AI.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get conversation by ID',
    description:
      'Retrieve the conversation history including all messages and current order state.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conv_abc123-def456-ghi789',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'conv_abc123-def456-ghi789' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
        currentOrderId: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async getConversation(@Param('id') id: string): Promise<{
    id: string;
    messages: Array<{ role: string; content: string; timestamp: string }>;
    currentOrderId: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    this.logger.debug(`Getting conversation: ${id}`);

    const conversationId = ConversationId.fromString(id);
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      this.logger.debug(`Conversation not found: ${id}`);
      throw new NotFoundException(`Conversation with ID '${id}' not found`);
    }

    this.logger.debug(`Retrieved conversation ${id} with ${conversation.messageCount} messages`);

    return {
      id: conversation.id.toString(),
      messages: conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
      currentOrderId: conversation.currentOrderId?.toString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  /**
   * Stream a message response from the barista AI using Server-Sent Events.
   *
   * This endpoint provides real-time streaming of the AI response,
   * allowing the client to display text as it's generated.
   * Events:
   * - 'text': A chunk of the response text
   * - 'complete': Final response with all metadata
   * - 'error': Error occurred during processing
   */
  @Sse('messages/stream')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Stream a message response from the barista AI',
    description: `Send a message and receive a streaming response via Server-Sent Events.
    The response is streamed in chunks as the AI generates it, providing a more
    responsive user experience.`,
  })
  @ApiQuery({
    name: 'message',
    description: 'The message to send to the barista',
    required: true,
    example: 'Quiero un latte grande',
  })
  @ApiQuery({
    name: 'conversationId',
    description: 'Existing conversation ID (optional)',
    required: false,
    example: 'conv_abc123-def456-ghi789',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of response chunks',
  })
  streamMessage(
    @Query('message') message: string,
    @Query('conversationId') conversationId?: string,
  ): Observable<MessageEvent> {
    if (!message || message.trim().length === 0) {
      return of({
        data: { type: 'error', data: 'Message is required' },
      } as MessageEvent);
    }

    this.logger.debug(
      `Streaming message: conversationId=${conversationId ?? 'new'}, messageLength=${
        message.length
      }`,
    );

    const generator = this.processMessageStreamUseCase.execute({
      message: message.trim(),
      conversationId,
    });

    return from(this.streamToAsyncIterable(generator)).pipe(
      map((chunk) => ({
        data: chunk,
      })),
      catchError((error) => {
        this.logger.error(
          `Stream error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return of({
          data: { type: 'error', data: 'Error processing message' },
        } as MessageEvent);
      }),
    );
  }

  /**
   * Helper to convert async generator to async iterable for RxJS
   */
  private async *streamToAsyncIterable<T>(generator: AsyncGenerator<T>): AsyncIterable<T> {
    for await (const chunk of generator) {
      yield chunk;
    }
  }
}

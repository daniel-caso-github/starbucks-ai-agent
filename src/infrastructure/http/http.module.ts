import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChromaDBModule, MongoDBModule } from '@infrastructure/adapters';
import { GeminiModule } from '@infrastructure/adapters/ai/gemini/gemini.module';
import { CacheService } from '@infrastructure/cache';
import { ProcessMessageUseCase, ProcessMessageStreamUseCase } from '@application/use-cases';
import {
  ConversationController,
  DrinksController,
  HealthController,
  OrdersController,
} from './controllers';
import {
  IConversationAIPort,
  IConversationRepositoryPort,
  IDrinkRepositoryPort,
  IDrinkSearcherPort,
  IOrderRepositoryPort,
} from '@application/ports';

/**
 * HTTP Module that configures all REST API endpoints.
 *
 * This module brings together all controllers and provides
 * the necessary dependencies including use cases and repositories.
 */
@Module({
  imports: [ConfigModule, MongoDBModule, ChromaDBModule, GeminiModule],
  controllers: [ConversationController, DrinksController, OrdersController, HealthController],
  providers: [
    // ProcessMessageUseCase with all its dependencies
    {
      provide: 'ProcessMessageUseCase',
      useFactory: (
        conversationRepository: IConversationRepositoryPort,
        orderRepository: IOrderRepositoryPort,
        drinkRepository: IDrinkRepositoryPort,
        conversationAI: IConversationAIPort,
        drinkSearcher: IDrinkSearcherPort,
        cacheService: CacheService,
      ): ProcessMessageUseCase => {
        return new ProcessMessageUseCase(
          conversationRepository,
          orderRepository,
          drinkRepository,
          conversationAI,
          drinkSearcher,
          cacheService,
        );
      },
      inject: [
        'IConversationRepository',
        'IOrderRepository',
        'IDrinkRepository',
        'IConversationAI',
        'IDrinkSearcher',
        CacheService,
      ],
    },
    // ProcessMessageStreamUseCase for SSE streaming
    {
      provide: 'ProcessMessageStreamUseCase',
      useFactory: (
        conversationAI: IConversationAIPort,
        conversationRepository: IConversationRepositoryPort,
        orderRepository: IOrderRepositoryPort,
        drinkSearcher: IDrinkSearcherPort,
      ): ProcessMessageStreamUseCase => {
        return new ProcessMessageStreamUseCase(
          conversationAI,
          conversationRepository,
          orderRepository,
          drinkSearcher,
        );
      },
      inject: ['IConversationAI', 'IConversationRepository', 'IOrderRepository', 'IDrinkSearcher'],
    },
  ],
})
export class HttpModule {}

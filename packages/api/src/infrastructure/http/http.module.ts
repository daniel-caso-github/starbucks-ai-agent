import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChromaDBModule, MongoDBModule } from '@infrastructure/adapters';
import { GeminiModule } from '@infrastructure/adapters/ai/gemini/gemini.module';
import { CacheService } from '@infrastructure/cache';
import { MetricsService, MetricsModule } from '@infrastructure/observability';
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
  imports: [ConfigModule, MongoDBModule, ChromaDBModule, GeminiModule, MetricsModule],
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
        metricsService: MetricsService,
      ): ProcessMessageUseCase => {
        return new ProcessMessageUseCase(
          conversationRepository,
          orderRepository,
          drinkRepository,
          conversationAI,
          drinkSearcher,
          cacheService,
          metricsService,
        );
      },
      inject: [
        'IConversationRepository',
        'IOrderRepository',
        'IDrinkRepository',
        'IConversationAI',
        'IDrinkSearcher',
        CacheService,
        MetricsService,
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
        drinkRepository: IDrinkRepositoryPort,
      ): ProcessMessageStreamUseCase => {
        return new ProcessMessageStreamUseCase(
          conversationAI,
          conversationRepository,
          orderRepository,
          drinkSearcher,
          drinkRepository,
        );
      },
      inject: ['IConversationAI', 'IConversationRepository', 'IOrderRepository', 'IDrinkSearcher', 'IDrinkRepository'],
    },
  ],
})
export class HttpModule {}

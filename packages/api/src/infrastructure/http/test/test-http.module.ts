import { Module } from '@nestjs/common';
import { ProcessMessageUseCase } from '@application/use-cases';
import { ProcessMessageStreamUseCase } from '@application/use-cases';
import { IConversationAIPort, IConversationRepositoryPort, IDrinkRepositoryPort, IDrinkSearcherPort, IOrderRepositoryPort } from '@application/ports/outbound';
import { ConversationController } from '../controllers/conversation.controller';
import { DrinksController } from '../controllers/drinks.controller';
import { OrdersController } from '../controllers/orders.controller';
import { InMemoryStoreService } from './in-memory-store.service';
import { InMemoryConversationRepository } from './in-memory-conversation.repository';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import { InMemoryDrinkRepository, InMemoryDrinkSearcher } from './in-memory-drink.repository';
import { DeterministicConversationAdapter } from './deterministic-conversation.adapter';
import { NopCacheService } from './nop-cache.service';
import { NopMetricsService } from './nop-metrics.service';
import { TestController } from './test.controller';

@Module({
  controllers: [ConversationController, DrinksController, OrdersController, TestController],
  providers: [
    InMemoryStoreService,

    { provide: 'IConversationAI', useClass: DeterministicConversationAdapter },
    { provide: 'IConversationRepository', useClass: InMemoryConversationRepository },
    { provide: 'IOrderRepository', useClass: InMemoryOrderRepository },
    { provide: 'IDrinkRepository', useClass: InMemoryDrinkRepository },
    { provide: 'IDrinkSearcher', useClass: InMemoryDrinkSearcher },

    DeterministicConversationAdapter,
    InMemoryConversationRepository,
    InMemoryOrderRepository,
    InMemoryDrinkRepository,
    InMemoryDrinkSearcher,

    {
      provide: 'NopCacheService',
      useClass: NopCacheService,
    },
    NopCacheService,
    NopMetricsService,

    {
      provide: 'ProcessMessageUseCase',
      useFactory: (
        conversationRepository: IConversationRepositoryPort,
        orderRepository: IOrderRepositoryPort,
        drinkRepository: IDrinkRepositoryPort,
        conversationAI: IConversationAIPort,
        drinkSearcher: IDrinkSearcherPort,
        cacheService: NopCacheService,
        metricsService: NopMetricsService,
      ): ProcessMessageUseCase =>
        new ProcessMessageUseCase(
          conversationRepository,
          orderRepository,
          drinkRepository,
          conversationAI,
          drinkSearcher,
          cacheService as never,
          metricsService as never,
        ),
      inject: [
        'IConversationRepository',
        'IOrderRepository',
        'IDrinkRepository',
        'IConversationAI',
        'IDrinkSearcher',
        NopCacheService,
        NopMetricsService,
      ],
    },

    {
      provide: 'ProcessMessageStreamUseCase',
      useFactory: (
        conversationAI: IConversationAIPort,
        conversationRepository: IConversationRepositoryPort,
        orderRepository: IOrderRepositoryPort,
        drinkSearcher: IDrinkSearcherPort,
        drinkRepository: IDrinkRepositoryPort,
      ): ProcessMessageStreamUseCase =>
        new ProcessMessageStreamUseCase(
          conversationAI,
          conversationRepository,
          orderRepository,
          drinkSearcher,
          drinkRepository,
        ),
      inject: ['IConversationAI', 'IConversationRepository', 'IOrderRepository', 'IDrinkSearcher', 'IDrinkRepository'],
    },
  ],
})
export class TestHttpModule {}

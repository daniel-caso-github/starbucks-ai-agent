import { Module } from '@nestjs/common';
import { MongoDBModule, ChromaDBModule, GeminiModule } from '@infrastructure/adapters';
import { CacheService } from '@infrastructure/cache';
import {
  IConversationRepositoryPort,
  IOrderRepositoryPort,
  IDrinkRepositoryPort,
  IConversationAIPort,
  IDrinkSearcherPort,
} from '@application/ports/outbound';
import { ProcessMessageUseCase } from '@application/use-cases';
import { DrinkSeederService } from './drink-seeder.service';
import { SeedCommand } from './seed.command';
import { SearchTestCommand } from './search-test.command';
import { ChatTestCommand } from './chat-test.command';

/**
 * Module for database seeding and testing functionality.
 *
 * This module provides CLI commands for:
 * - Seeding the database with drinks
 * - Testing semantic search
 * - Interactive chat with the barista AI (full end-to-end)
 */
@Module({
  imports: [MongoDBModule, ChromaDBModule, GeminiModule],
  providers: [
    // Seeder service
    {
      provide: DrinkSeederService,
      useFactory: (
        drinkRepository: IDrinkRepositoryPort,
        drinkSearcher: IDrinkSearcherPort,
      ): DrinkSeederService => {
        return new DrinkSeederService(drinkRepository, drinkSearcher);
      },
      inject: ['IDrinkRepository', 'IDrinkSearcher'],
    },
    // ProcessMessageUseCase for full end-to-end chat
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
    // CLI Commands
    SeedCommand,
    SearchTestCommand,
    ChatTestCommand,
  ],
  exports: [DrinkSeederService],
})
export class SeedsModule {}

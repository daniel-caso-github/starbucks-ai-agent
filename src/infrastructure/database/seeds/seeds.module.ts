import { Module } from '@nestjs/common';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports/outbound';
import { ChromaDBModule, MongoDBModule } from '@infrastructure/adapters';
import { DrinkSeederService } from './drink-seeder.service';
import { SeedCommand } from './seed.command';
import { SearchTestCommand } from '@infrastructure/database/seeds/search-test.command';

/**
 * Module for database seeding functionality.
 *
 * This module provides CLI commands to seed the database
 * with initial drink data for development and testing.
 */
@Module({
  imports: [MongoDBModule, ChromaDBModule],
  providers: [
    {
      provide: DrinkSeederService,
      useFactory: (
        drinkRepository: IDrinkRepositoryPort,
        drinkSearcher: IDrinkSearcherPort,
      ): DrinkSeederService => new DrinkSeederService(drinkRepository, drinkSearcher),
      inject: ['IDrinkRepository', 'IDrinkSearcher'],
    },
    SeedCommand,
    SearchTestCommand,
  ],
  exports: [DrinkSeederService],
})
export class SeedsModule {}

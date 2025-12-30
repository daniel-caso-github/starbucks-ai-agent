import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChromaDrinkSearcher } from './chroma-drink-searcher';

/**
 * Module that configures ChromaDB for semantic search.
 *
 * ChromaDB is used for vector-based similarity search,
 * enabling natural language queries to find relevant drinks.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IDrinkSearcher',
      useClass: ChromaDrinkSearcher,
    },
  ],
  exports: ['IDrinkSearcher'],
})
export class ChromaDBModule {}

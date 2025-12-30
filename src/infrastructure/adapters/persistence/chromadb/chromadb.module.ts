import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChromaDrinkSearcher } from './chroma-drink-searcher';
import { OpenAIEmbeddingAdapter } from '@infrastructure/adapters/ai';
import { IEmbeddingGeneratorPort } from '@application/ports/outbound';

/**
 * Module that configures ChromaDB for semantic search.
 *
 * ChromaDB is used for vector-based similarity search,
 * enabling natural language queries to find relevant drinks.
 *
 * This module uses OpenAI's text-embedding-3-small model
 * for high-quality semantic embeddings that capture the
 * meaning of drink descriptions and user queries.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Embedding generator using OpenAI's text-embedding-3-small
    {
      provide: 'IEmbeddingGenerator',
      useFactory: (configService: ConfigService): IEmbeddingGeneratorPort => {
        return new OpenAIEmbeddingAdapter(configService);
      },
      inject: [ConfigService],
    },
    // Drink searcher that uses ChromaDB + OpenAI embeddings
    {
      provide: 'IDrinkSearcher',
      useFactory: (
        configService: ConfigService,
        embeddingGenerator: IEmbeddingGeneratorPort,
      ): ChromaDrinkSearcher => {
        return new ChromaDrinkSearcher(configService, embeddingGenerator);
      },
      inject: [ConfigService, 'IEmbeddingGenerator'],
    },
  ],
  exports: ['IDrinkSearcher', 'IEmbeddingGenerator'],
})
export class ChromaDBModule {}

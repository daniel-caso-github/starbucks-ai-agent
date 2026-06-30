import { Module } from '@nestjs/common';
import { ChromaDrinkSearcher } from './chroma-drink-searcher';
import { OpenAIEmbeddingAdapter } from '@infrastructure/adapters/ai';
import { EnvConfigService } from '@infrastructure/config';
import { CacheService } from '@infrastructure/cache';
import { MetricsService, MetricsModule, TracingService } from '@infrastructure/observability';
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
  imports: [MetricsModule],
  providers: [
    // Embedding generator using OpenAI's text-embedding-3-small
    {
      provide: 'IEmbeddingGenerator',
      useFactory: (envConfig: EnvConfigService): IEmbeddingGeneratorPort => {
        return new OpenAIEmbeddingAdapter(envConfig);
      },
      inject: [EnvConfigService],
    },
    // Drink searcher that uses ChromaDB + OpenAI embeddings + Redis cache
    {
      provide: 'IDrinkSearcher',
      useFactory: (
        envConfig: EnvConfigService,
        embeddingGenerator: IEmbeddingGeneratorPort,
        cacheService: CacheService,
        metricsService: MetricsService,
        tracingService: TracingService,
      ): ChromaDrinkSearcher => {
        return new ChromaDrinkSearcher(envConfig, embeddingGenerator, cacheService, metricsService, tracingService);
      },
      inject: [EnvConfigService, 'IEmbeddingGenerator', CacheService, MetricsService, TracingService],
    },
  ],
  exports: ['IDrinkSearcher', 'IEmbeddingGenerator'],
})
export class ChromaDBModule {}

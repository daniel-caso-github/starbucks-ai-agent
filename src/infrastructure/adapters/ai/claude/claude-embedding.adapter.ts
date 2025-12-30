import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingGeneratorPort } from '@application/ports/outbound';
import { EmbeddingResultDto, EmbeddingType } from '@application/dtos/embedding-generator.dto';

/**
 * Placeholder implementation of IEmbeddingGenerator.
 *
 * Note: Anthropic doesn't have a dedicated embedding API.
 * This adapter uses a simple hash-based approach for demonstration.
 *
 * For production, consider using:
 * - OpenAI's text-embedding-ada-002
 * - Cohere's embed API
 * - Local sentence-transformers
 * - ChromaDB's built-in embedding functions
 */
@Injectable()
export class ClaudeEmbeddingAdapter implements IEmbeddingGeneratorPort, OnModuleInit {
  private readonly logger = new Logger(ClaudeEmbeddingAdapter.name);
  private readonly dimensions = 1536;
  private readonly maxTokens = 8191;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured');
      return;
    }

    this.logger.log('Claude Embedding adapter initialized (using placeholder embeddings)');
  }

  /**
   * Generates an embedding for a single text.
   */
  generate(text: string): Promise<EmbeddingResultDto> {
    const embedding = this.generateSimpleEmbedding(text);
    const tokenCount = this.estimateTokenCount(text);

    return Promise.resolve({
      text,
      embedding,
      tokenCount,
    });
  }

  /**
   * Generates embeddings for multiple texts in batch.
   */
  generateBatch(texts: string[]): Promise<EmbeddingResultDto[]> {
    const results = texts.map((text) => ({
      text,
      embedding: this.generateSimpleEmbedding(text),
      tokenCount: this.estimateTokenCount(text),
    }));

    return Promise.resolve(results);
  }

  /**
   * Returns the dimensionality of embeddings produced.
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Returns the maximum number of tokens that can be embedded.
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Calculates cosine similarity between two embeddings.
   */
  cosineSimilarity(embedding1: EmbeddingType, embedding2: EmbeddingType): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Generates a simple deterministic embedding based on text content.
   *
   * WARNING: This is a placeholder implementation for demonstration.
   * It does NOT capture semantic meaning.
   */
  private generateSimpleEmbedding(text: string): EmbeddingType {
    const embedding: number[] = new Array<number>(this.dimensions).fill(0);
    const normalizedText = text.toLowerCase();

    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i);
      const index = (charCode * (i + 1)) % this.dimensions;
      embedding[index] += 1 / (i + 1);
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Estimates token count for a text (rough approximation).
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

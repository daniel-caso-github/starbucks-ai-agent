import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IEmbeddingGeneratorPort } from '@application/ports/outbound';
import { EmbeddingResultDto, EmbeddingType } from '@application/dtos/embedding-generator.dto';

/**
 * OpenAI implementation of IEmbeddingGenerator.
 *
 * Uses OpenAI's text-embedding-3-small model for high-quality
 * semantic embeddings. This enables true semantic search where
 * queries like "something cold and refreshing" find iced drinks
 * even without exact keyword matches.
 *
 * The text-embedding-3-small model offers:
 * - 1536 dimensions
 * - Excellent semantic understanding
 * - Very affordable pricing ($0.02 per million tokens)
 * - Fast response times
 */
@Injectable()
export class OpenAIEmbeddingAdapter implements IEmbeddingGeneratorPort, OnModuleInit {
  private readonly logger = new Logger(OpenAIEmbeddingAdapter.name);
  private client!: OpenAI;
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 1536;
  private readonly maxTokens = 8191;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      this.logger.warn('OPENAI_API_KEY not configured - semantic search will not work correctly');
      return;
    }

    this.client = new OpenAI({ apiKey });
    this.initialized = true;
    this.logger.log(`OpenAI Embedding adapter initialized with model: ${this.model}`);
  }

  /**
   * Generates an embedding for a single text.
   *
   * The embedding is a 1536-dimensional vector that captures
   * the semantic meaning of the text. Similar texts will have
   * similar embeddings, enabling semantic search.
   */
  async generate(text: string): Promise<EmbeddingResultDto> {
    if (!this.initialized) {
      this.logger.warn('OpenAI not initialized, returning placeholder embedding');
      return this.generatePlaceholder(text);
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data[0].embedding;
      const tokenCount = response.usage?.total_tokens ?? this.estimateTokenCount(text);

      return {
        text,
        embedding,
        tokenCount,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate embedding: ${message}`);
      return this.generatePlaceholder(text);
    }
  }

  /**
   * Generates embeddings for multiple texts in batch.
   *
   * OpenAI's API supports batching natively, which is more
   * efficient than making individual requests. This is ideal
   * for seeding the database with many drinks at once.
   */
  async generateBatch(texts: string[]): Promise<EmbeddingResultDto[]> {
    if (texts.length === 0) return [];

    if (!this.initialized) {
      this.logger.warn('OpenAI not initialized, returning placeholder embeddings');
      return texts.map((text) => this.generatePlaceholder(text));
    }

    try {
      this.logger.log(`Generating embeddings for ${texts.length} texts...`);

      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      this.logger.log(`Successfully generated ${response.data.length} embeddings`);

      return response.data.map((item: { embedding: number[] }, index: number) => ({
        text: texts[index],
        embedding: item.embedding,
        tokenCount: Math.ceil(texts[index].length / 4),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate batch embeddings: ${message}`);
      return texts.map((text) => this.generatePlaceholder(text));
    }
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
   *
   * Returns a value between -1 and 1, where:
   * - 1 means identical direction (very similar)
   * - 0 means orthogonal (unrelated)
   * - -1 means opposite direction (very different)
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
   * Generates a placeholder embedding when OpenAI is not available.
   * This allows the system to function in development without an API key,
   * though semantic search quality will be poor.
   */
  private generatePlaceholder(text: string): EmbeddingResultDto {
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

    return {
      text,
      embedding,
      tokenCount: this.estimateTokenCount(text),
    };
  }

  /**
   * Estimates token count for a text (rough approximation).
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

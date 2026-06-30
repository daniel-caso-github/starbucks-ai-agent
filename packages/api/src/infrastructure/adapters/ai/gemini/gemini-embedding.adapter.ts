import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { EnvConfigService } from '@infrastructure/config';
import { IEmbeddingGeneratorPort } from '@application/ports/outbound';
import { EmbeddingResultDto, EmbeddingType } from '@application/dtos/embedding-generator.dto';

@Injectable()
export class GeminiEmbeddingAdapter implements IEmbeddingGeneratorPort, OnModuleInit {
  private readonly logger = new Logger(GeminiEmbeddingAdapter.name);
  private genAI!: GoogleGenerativeAI;
  private readonly model = 'text-embedding-004';
  private readonly dimensions = 768;
  private initialized = false;

  constructor(private readonly envConfig: EnvConfigService) {}

  onModuleInit(): void {
    const apiKey = this.envConfig.googleAiApiKey;

    if (!apiKey) {
      this.logger.warn('GOOGLE_AI_API_KEY not configured - semantic search will use placeholders');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.initialized = true;
    this.logger.log(`Gemini Embedding adapter initialized with model: ${this.model}`);
  }

  async generate(text: string): Promise<EmbeddingResultDto> {
    if (!this.initialized) {
      return this.generatePlaceholder(text);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_QUERY,
      });

      return {
        text,
        embedding: result.embedding.values,
        tokenCount: Math.ceil(text.length / 4),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate embedding: ${message}`);
      return this.generatePlaceholder(text);
    }
  }

  async generateBatch(texts: string[]): Promise<EmbeddingResultDto[]> {
    if (texts.length === 0) return [];

    if (!this.initialized) {
      return texts.map((t) => this.generatePlaceholder(t));
    }

    try {
      this.logger.log(`Generating ${texts.length} embeddings via Gemini...`);
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const results = await Promise.all(
        texts.map(async (text) => {
          const result = await model.embedContent({
            content: { role: 'user', parts: [{ text }] },
            taskType: TaskType.RETRIEVAL_DOCUMENT,
          });
          return {
            text,
            embedding: result.embedding.values,
            tokenCount: Math.ceil(text.length / 4),
          };
        }),
      );

      this.logger.log(`Successfully generated ${results.length} embeddings`);
      return results;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate batch embeddings: ${message}`);
      return texts.map((t) => this.generatePlaceholder(t));
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getMaxTokens(): number {
    return 2048;
  }

  cosineSimilarity(embedding1: EmbeddingType, embedding2: EmbeddingType): number {
    let dot = 0, mag1 = 0, mag2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dot += embedding1[i] * embedding2[i];
      mag1 += embedding1[i] * embedding1[i];
      mag2 += embedding2[i] * embedding2[i];
    }
    const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
    return denom === 0 ? 0 : dot / denom;
  }

  private generatePlaceholder(text: string): EmbeddingResultDto {
    const embedding = new Array<number>(this.dimensions).fill(0);
    const norm = text.toLowerCase();
    for (let i = 0; i < norm.length; i++) {
      embedding[(norm.charCodeAt(i) * (i + 1)) % this.dimensions] += 1 / (i + 1);
    }
    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    if (mag > 0) embedding.forEach((_, i) => (embedding[i] /= mag));
    return { text, embedding, tokenCount: Math.ceil(text.length / 4) };
  }
}

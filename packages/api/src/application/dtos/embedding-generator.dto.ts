export type EmbeddingType = number[];

export interface EmbeddingResultDto {
  /** The original text that was embedded */
  text: string;

  /** The generated embedding vector */
  embedding: EmbeddingType;

  /** Number of tokens used (for tracking API usage) */
  tokenCount: number;
}

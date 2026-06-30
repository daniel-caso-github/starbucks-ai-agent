import { EmbeddingResultDto, EmbeddingType } from '@application/dtos/embedding-generator.dto';

export interface IEmbeddingGeneratorPort {
  /**
   * Generates an embedding vector for a single text input.
   *
   * @param text - The text to convert into an embedding
   * @returns Promise resolving to the embedding result
   * @throws EmbeddingException if generation fails
   *
   * @example
   * ```typescript
   * const result = await generator.generate("Caramel Frappuccino: A sweet blended coffee drink");
   * console.log(result.embedding.length); // e.g., 1536
   * ```
   */
  generate(text: string): Promise<EmbeddingResultDto>;

  /**
   * Generates embeddings for multiple texts in a single batch.
   * More efficient than calling generate() multiple times due to
   * reduced API overhead and potential parallelization.
   *
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding results (same order as input)
   * @throws EmbeddingException if generation fails for any text
   *
   * @example
   * ```typescript
   * const drinks = await drinkRepository.findAll();
   * const texts = drinks.map(d => d.toSummary());
   * const results = await generator.generateBatch(texts);
   *
   * // Index all embeddings
   * for (let i = 0; i < drinks.length; i++) {
   *   await chromaDB.addEmbedding(drinks[i].id, results[i].embedding);
   * }
   * ```
   */
  generateBatch(texts: string[]): Promise<EmbeddingResultDto[]>;

  /**
   * Returns the dimensionality of embeddings produced by this generator.
   * Useful for validating compatibility with vector databases.
   *
   * @returns The number of dimensions in generated embeddings
   *
   * @example
   * ```typescript
   * const dimensions = generator.getDimensions();
   * console.log(`This generator produces ${dimensions}-dimensional embeddings`);
   * // Common values: 384, 768, 1024, 1536
   * ```
   */
  getDimensions(): number;

  /**
   * Returns the maximum number of tokens that can be embedded at once.
   * Texts exceeding this limit may be truncated or rejected.
   *
   * @returns The maximum token limit
   */
  getMaxTokens(): number;

  /**
   * Calculates the cosine similarity between two embeddings.
   * This is a convenience method for comparing embeddings without
   * needing a vector database.
   *
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Similarity score between -1 and 1 (1 = identical, 0 = unrelated)
   *
   * @example
   * ```typescript
   * const latte = await generator.generate("Caramel Latte");
   * const frap = await generator.generate("Caramel Frappuccino");
   * const espresso = await generator.generate("Plain Espresso");
   *
   * // Latte and Frappuccino are more similar (both caramel)
   * generator.cosineSimilarity(latte.embedding, frap.embedding);     // ~0.85
   * generator.cosineSimilarity(latte.embedding, espresso.embedding); // ~0.60
   * ```
   */
  cosineSimilarity(embedding1: EmbeddingType, embedding2: EmbeddingType): number;
}

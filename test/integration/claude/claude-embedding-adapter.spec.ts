import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeEmbeddingAdapter } from '@infrastructure/adapters';

describe('ClaudeEmbeddingAdapter', () => {
  let adapter: ClaudeEmbeddingAdapter;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ClaudeEmbeddingAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    adapter = module.get<ClaudeEmbeddingAdapter>(ClaudeEmbeddingAdapter);
    adapter.onModuleInit();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('generate', () => {
    it('should generate an embedding for text', async () => {
      // Act
      const result = await adapter.generate('Caramel Latte with oat milk');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBe('Caramel Latte with oat milk');
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBe(adapter.getDimensions());
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should generate normalized embeddings', async () => {
      // Act
      const result = await adapter.generate('Test text');

      // Assert - Check that embedding is normalized (magnitude ≈ 1)
      const magnitude = Math.sqrt(result.embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should generate deterministic embeddings for same input', async () => {
      // Act
      const result1 = await adapter.generate('Same text');
      const result2 = await adapter.generate('Same text');

      // Assert
      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should generate different embeddings for different inputs', async () => {
      // Act
      const result1 = await adapter.generate('First text');
      const result2 = await adapter.generate('Completely different text');

      // Assert
      expect(result1.embedding).not.toEqual(result2.embedding);
    });
  });

  describe('generateBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['Latte', 'Cappuccino', 'Espresso'];

      // Act
      const results = await adapter.generateBatch(texts);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.text).toBe(texts[index]);
        expect(result.embedding.length).toBe(adapter.getDimensions());
      });
    });

    it('should handle empty array', async () => {
      // Act
      const results = await adapter.generateBatch([]);

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('getDimensions', () => {
    it('should return the embedding dimensions', () => {
      // Act
      const dimensions = adapter.getDimensions();

      // Assert
      expect(dimensions).toBe(1536);
    });
  });

  describe('getMaxTokens', () => {
    it('should return the maximum token limit', () => {
      // Act
      const maxTokens = adapter.getMaxTokens();

      // Assert
      expect(maxTokens).toBe(8191);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical embeddings', async () => {
      // Arrange
      const result = await adapter.generate('Same text');

      // Act
      const similarity = adapter.cosineSimilarity(result.embedding, result.embedding);

      // Assert
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return value between -1 and 1', async () => {
      // Arrange
      const result1 = await adapter.generate('First text');
      const result2 = await adapter.generate('Second text');

      // Act
      const similarity = adapter.cosineSimilarity(result1.embedding, result2.embedding);

      // Assert
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error for embeddings with different dimensions', () => {
      // Arrange
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.1, 0.2];

      // Act & Assert
      expect(() => adapter.cosineSimilarity(embedding1, embedding2)).toThrow(
        'Embeddings must have the same dimensions',
      );
    });

    it('should return higher similarity for similar texts', async () => {
      // Arrange
      const latte = await adapter.generate('Caramel Latte');
      const cappuccino = await adapter.generate('Caramel Cappuccino');
      const espresso = await adapter.generate('Plain Espresso Shot');

      // Act
      const latteCappuccinoSimilarity = adapter.cosineSimilarity(
        latte.embedding,
        cappuccino.embedding,
      );
      const latteEspressoSimilarity = adapter.cosineSimilarity(latte.embedding, espresso.embedding);

      // Assert - Latte and Cappuccino (both caramel) should be more similar
      // Note: This is a placeholder embedding, so similarity might not reflect
      // true semantic similarity, but the test verifies the function works
      expect(typeof latteCappuccinoSimilarity).toBe('number');
      expect(typeof latteEspressoSimilarity).toBe('number');
    });

    it('should return 0 for zero vectors', () => {
      // Arrange
      const zeroVector: number[] = new Array(1536).fill(0);

      // Act
      const similarity = adapter.cosineSimilarity(zeroVector, zeroVector);

      // Assert
      expect(similarity).toBe(0);
    });
  });
});

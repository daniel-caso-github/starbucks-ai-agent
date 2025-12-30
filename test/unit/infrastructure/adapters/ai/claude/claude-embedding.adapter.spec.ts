import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeEmbeddingAdapter } from '@infrastructure/adapters/ai/claude';

describe('ClaudeEmbeddingAdapter', () => {
  let adapter: ClaudeEmbeddingAdapter;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeEmbeddingAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<ClaudeEmbeddingAdapter>(ClaudeEmbeddingAdapter);
    adapter.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully with API key', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('should handle missing API key gracefully', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClaudeEmbeddingAdapter,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const newAdapter = module.get<ClaudeEmbeddingAdapter>(ClaudeEmbeddingAdapter);
      expect(() => newAdapter.onModuleInit()).not.toThrow();
    });
  });

  describe('generate', () => {
    it('should generate embedding for text', async () => {
      // Act
      const result = await adapter.generate('Hello world');

      // Assert
      expect(result.text).toBe('Hello world');
      expect(result.embedding).toHaveLength(1536);
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should generate deterministic embeddings', async () => {
      // Act
      const result1 = await adapter.generate('Same text');
      const result2 = await adapter.generate('Same text');

      // Assert
      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should generate different embeddings for different texts', async () => {
      // Act
      const result1 = await adapter.generate('Hello');
      const result2 = await adapter.generate('Goodbye');

      // Assert
      expect(result1.embedding).not.toEqual(result2.embedding);
    });

    it('should estimate token count based on text length', async () => {
      // Arrange
      const shortText = 'Hi';
      const longText = 'This is a much longer text that should have more tokens';

      // Act
      const shortResult = await adapter.generate(shortText);
      const longResult = await adapter.generate(longText);

      // Assert
      expect(longResult.tokenCount).toBeGreaterThan(shortResult.tokenCount);
    });
  });

  describe('generateBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['Hello', 'World', 'Test'];

      // Act
      const results = await adapter.generateBatch(texts);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('Hello');
      expect(results[1].text).toBe('World');
      expect(results[2].text).toBe('Test');
    });

    it('should handle empty array', async () => {
      // Act
      const results = await adapter.generateBatch([]);

      // Assert
      expect(results).toHaveLength(0);
    });

    it('should generate unique embeddings for each text', async () => {
      // Arrange
      const texts = ['First', 'Second', 'Third'];

      // Act
      const results = await adapter.generateBatch(texts);

      // Assert
      expect(results[0].embedding).not.toEqual(results[1].embedding);
      expect(results[1].embedding).not.toEqual(results[2].embedding);
    });
  });

  describe('getDimensions', () => {
    it('should return 1536 dimensions', () => {
      // Act
      const dimensions = adapter.getDimensions();

      // Assert
      expect(dimensions).toBe(1536);
    });
  });

  describe('getMaxTokens', () => {
    it('should return 8191 max tokens', () => {
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

    it('should return value between 0 and 1 for similar texts', async () => {
      // Arrange
      const result1 = await adapter.generate('Hello world');
      const result2 = await adapter.generate('Hello there');

      // Act
      const similarity = adapter.cosineSimilarity(result1.embedding, result2.embedding);

      // Assert
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return lower similarity for different texts', async () => {
      // Arrange
      const result1 = await adapter.generate('Hello world');
      const result2 = await adapter.generate('Hello there');
      const result3 = await adapter.generate('Completely different text about coffee');

      // Act
      const similarSimilarity = adapter.cosineSimilarity(result1.embedding, result2.embedding);
      const differentSimilarity = adapter.cosineSimilarity(result1.embedding, result3.embedding);

      // Assert
      expect(similarSimilarity).toBeGreaterThan(differentSimilarity);
    });

    it('should throw error for different dimensions', () => {
      // Arrange
      const embedding1 = [1, 2, 3];
      const embedding2 = [1, 2];

      // Act & Assert
      expect(() => adapter.cosineSimilarity(embedding1, embedding2)).toThrow(
        'Embeddings must have the same dimensions',
      );
    });

    it('should return 0 for zero magnitude embeddings', () => {
      // Arrange
      const zeroEmbedding = new Array(1536).fill(0);

      // Act
      const similarity = adapter.cosineSimilarity(zeroEmbedding, zeroEmbedding);

      // Assert
      expect(similarity).toBe(0);
    });
  });
});

import { validateEnv, envSchema } from '@infrastructure/config';

describe('Environment Validation', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    MONGO_URI: 'mongodb://localhost:27017/test',
    CHROMA_HOST: 'http://localhost:8000',
    GOOGLE_AI_API_KEY: 'test-google-key',
    OPENAI_API_KEY: 'test-openai-key',
  };

  describe('validateEnv', () => {
    it('should validate valid environment variables', () => {
      const result = validateEnv(validEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
      expect(result.MONGO_URI).toBe('mongodb://localhost:27017/test');
      expect(result.CHROMA_HOST).toBe('http://localhost:8000');
      expect(result.GOOGLE_AI_API_KEY).toBe('test-google-key');
      expect(result.OPENAI_API_KEY).toBe('test-openai-key');
    });

    it('should transform PORT from string to number', () => {
      const result = validateEnv({ ...validEnv, PORT: '8080' });

      expect(result.PORT).toBe(8080);
      expect(typeof result.PORT).toBe('number');
    });

    it('should use default values for optional fields', () => {
      const minimalEnv = {
        MONGO_URI: 'mongodb://localhost:27017/test',
        CHROMA_HOST: 'http://localhost:8000',
        GOOGLE_AI_API_KEY: 'test-key',
        OPENAI_API_KEY: 'test-key',
      };

      const result = validateEnv(minimalEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
    });

    it('should throw error for missing MONGO_URI', () => {
      const invalidEnv = { ...validEnv };
      delete (invalidEnv as Record<string, unknown>).MONGO_URI;

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('MONGO_URI');
    });

    it('should throw error for missing CHROMA_HOST', () => {
      const invalidEnv = { ...validEnv };
      delete (invalidEnv as Record<string, unknown>).CHROMA_HOST;

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('CHROMA_HOST');
    });

    it('should throw error for missing GOOGLE_AI_API_KEY', () => {
      const invalidEnv = { ...validEnv };
      delete (invalidEnv as Record<string, unknown>).GOOGLE_AI_API_KEY;

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('GOOGLE_AI_API_KEY');
    });

    it('should throw error for missing OPENAI_API_KEY', () => {
      const invalidEnv = { ...validEnv };
      delete (invalidEnv as Record<string, unknown>).OPENAI_API_KEY;

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('OPENAI_API_KEY');
    });

    it('should throw error for invalid NODE_ENV', () => {
      const invalidEnv = { ...validEnv, NODE_ENV: 'invalid' };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
    });

    it('should throw error for invalid MONGO_URI format', () => {
      const invalidEnv = { ...validEnv, MONGO_URI: 'not-a-url' };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('valid URL');
    });

    it('should throw error for invalid CHROMA_HOST format', () => {
      const invalidEnv = { ...validEnv, CHROMA_HOST: 'not-a-url' };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
      expect(() => validateEnv(invalidEnv)).toThrow('valid URL');
    });

    it('should throw error for PORT out of range', () => {
      const invalidEnv = { ...validEnv, PORT: '70000' };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
    });

    it('should throw error for negative PORT', () => {
      const invalidEnv = { ...validEnv, PORT: '-1' };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed');
    });
  });

  describe('envSchema', () => {
    it('should accept production NODE_ENV', () => {
      const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'production' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
      }
    });

    it('should accept test NODE_ENV', () => {
      const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'test' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('test');
      }
    });

    it('should accept valid port numbers', () => {
      const ports = ['80', '443', '3000', '8080', '65535'];

      for (const port of ports) {
        const result = envSchema.safeParse({ ...validEnv, PORT: port });
        expect(result.success).toBe(true);
      }
    });
  });
});

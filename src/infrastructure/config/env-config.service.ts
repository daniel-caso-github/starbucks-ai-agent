import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './env.validation';

/**
 * Typed configuration service for environment variables.
 *
 * Provides type-safe access to validated environment variables.
 * Use this instead of ConfigService.get() for better autocomplete
 * and compile-time type checking.
 *
 * Note: Values are guaranteed to exist because they are validated
 * at application startup by the Zod schema.
 */
@Injectable()
export class EnvConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): EnvConfig['PORT'] {
    return this.configService.get('PORT', { infer: true });
  }

  get mongoUri(): EnvConfig['MONGO_URI'] {
    return this.configService.get('MONGO_URI', { infer: true });
  }

  get chromaHost(): EnvConfig['CHROMA_HOST'] {
    return this.configService.get('CHROMA_HOST', { infer: true });
  }

  get redisUrl(): EnvConfig['REDIS_URL'] {
    return this.configService.get('REDIS_URL', { infer: true });
  }

  get googleAiApiKey(): EnvConfig['GOOGLE_AI_API_KEY'] {
    return this.configService.get('GOOGLE_AI_API_KEY', { infer: true });
  }

  get openaiApiKey(): EnvConfig['OPENAI_API_KEY'] {
    return this.configService.get('OPENAI_API_KEY', { infer: true });
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}

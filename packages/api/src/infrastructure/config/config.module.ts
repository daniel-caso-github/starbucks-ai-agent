import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvConfigService } from './env-config.service';
import { validateEnv } from './env.validation';

/**
 * Global configuration module.
 *
 * Provides validated environment configuration throughout the application.
 * This module:
 * - Loads and validates environment variables using Zod schema
 * - Provides EnvConfigService for type-safe access to configuration
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
  providers: [EnvConfigService],
  exports: [EnvConfigService],
})
export class ConfigModule {}

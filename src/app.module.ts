import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HttpModule } from '@infrastructure/http';
import { CacheModule } from '@infrastructure/cache';
import { ConfigModule, EnvConfigService } from '@infrastructure/config';
import { LoggerModule, MetricsModule, MetricsInterceptor } from '@infrastructure/observability';

/**
 * Root application module.
 *
 * Configures the NestJS application with:
 * - Environment configuration with Zod validation
 * - MongoDB connection
 * - HTTP API module with all controllers
 */
@Module({
  imports: [
    // Load and validate environment variables globally
    ConfigModule,
    // Structured logging with Pino
    LoggerModule,
    // Prometheus metrics
    MetricsModule,
    // Redis caching
    CacheModule,
    // Rate limiting configuration - 60 requests per minute by default
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute in milliseconds
        limit: 60, // 60 requests per minute
      },
    ]),
    // Connect to MongoDB using environment variable
    MongooseModule.forRootAsync({
      useFactory: (envConfig: EnvConfigService) => ({
        uri: envConfig.mongoUri,
      }),
      inject: [EnvConfigService],
    }),
    // HTTP API module with all controllers and use cases
    HttpModule,
  ],
  providers: [
    // Enable rate limiting globally for all endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Enable metrics collection globally for all HTTP requests
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}

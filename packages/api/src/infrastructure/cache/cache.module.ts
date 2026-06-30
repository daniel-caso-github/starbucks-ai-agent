import { Module, Global, Logger } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EnvConfigService } from '@infrastructure/config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (envConfig: EnvConfigService) => {
        const logger = new Logger('CacheModule');
        // Parse Redis URL to extract host and port
        const redisUrl = new URL(envConfig.redisUrl);
        const host = redisUrl.hostname || 'localhost';
        const port = parseInt(redisUrl.port, 10) || 6379;

        logger.log(`Connecting to Redis at ${host}:${port}`);

        return {
          type: 'single',
          options: {
            host,
            port,
            family: 4, // Force IPv4
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn('Redis connection failed after 3 retries');
                return null; // Stop retrying
              }
              return Math.min(times * 200, 2000);
            },
          },
        };
      },
      inject: [EnvConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [RedisModule, CacheService],
})
export class CacheModule {}

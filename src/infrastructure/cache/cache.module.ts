import { Module, Global } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EnvConfigService } from '@infrastructure/config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (envConfig: EnvConfigService) => ({
        type: 'single',
        url: envConfig.redisUrl,
      }),
      inject: [EnvConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [RedisModule, CacheService],
})
export class CacheModule {}

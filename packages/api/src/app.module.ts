import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HttpModule } from '@infrastructure/http';
import { CacheModule } from '@infrastructure/cache';
import { ConfigModule, EnvConfigService } from '@infrastructure/config';
import { LoggerModule, MetricsModule, MetricsInterceptor, TracingModule } from '@infrastructure/observability';
import { TestHttpModule } from '@infrastructure/http/test/test-http.module';
import { RealTestRoutesModule } from '@infrastructure/http/test/real-test-routes.module';

const useMockAI = process.env.TEST_MODE === 'true';
const exposeTestRoutes = useMockAI || process.env.ENABLE_TEST_ROUTES === 'true';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    ...(useMockAI
      ? [TestHttpModule]
      : [
          MetricsModule,
          TracingModule,
          CacheModule,
          ThrottlerModule.forRoot([
            {
              name: 'default',
              ttl: 60000,
              limit: process.env.ENABLE_TEST_ROUTES === 'true' ? 10_000 : 60,
            },
          ]),
          MongooseModule.forRootAsync({
            useFactory: (envConfig: EnvConfigService) => ({
              uri: envConfig.mongoUri,
            }),
            inject: [EnvConfigService],
          }),
          HttpModule,
          ...(exposeTestRoutes ? [RealTestRoutesModule] : []),
        ]),
  ],
  providers: useMockAI
    ? []
    : [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: MetricsInterceptor,
        },
      ],
})
export class AppModule {}

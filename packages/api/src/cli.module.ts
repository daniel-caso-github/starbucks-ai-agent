import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, EnvConfigService } from '@infrastructure/config';
import { CacheModule } from '@infrastructure/cache';
import { SeedsModule } from '@infrastructure/database/seeds/seeds.module';
import { ChromaCliModule } from '@infrastructure/database/chroma/chroma-cli.module';

/**
 * Module for CLI commands.
 *
 * This module is used as the entry point for nest-commander,
 * providing database seeding and other CLI utilities.
 */
@Module({
  imports: [
    ConfigModule,
    CacheModule,
    MongooseModule.forRootAsync({
      useFactory: (envConfig: EnvConfigService) => ({
        uri: envConfig.mongoUri,
        // Keep connection alive for CLI commands that wait for user input
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 360000,
        maxIdleTimeMS: 360000,
      }),
      inject: [EnvConfigService],
    }),
    SeedsModule,
    ChromaCliModule,
  ],
})
export class CliModule {}

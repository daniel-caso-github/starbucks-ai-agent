import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedsModule } from '@infrastructure/database/seeds/seeds.module';

/**
 * Module for CLI commands.
 *
 * This module is used as the entry point for nest-commander,
 * providing database seeding and other CLI utilities.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    SeedsModule,
  ],
})
export class CliModule {}

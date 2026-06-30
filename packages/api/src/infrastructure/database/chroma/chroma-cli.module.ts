import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChromaCommand } from './chroma.command';

@Module({
  imports: [ConfigModule],
  providers: [ChromaCommand],
})
export class ChromaCliModule {}

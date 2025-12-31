import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClaudeConversationAdapter } from '@infrastructure/adapters';
import { IConversationAIPort } from '@application/ports/outbound';

/**
 * Module that configures Claude AI for conversation.
 *
 * This module provides the conversation AI adapter that uses
 * Anthropic's Claude model with tool calling for structured
 * order management.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IConversationAI',
      useFactory: (configService: ConfigService): IConversationAIPort => {
        return new ClaudeConversationAdapter(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['IConversationAI'],
})
export class ClaudeModule {}

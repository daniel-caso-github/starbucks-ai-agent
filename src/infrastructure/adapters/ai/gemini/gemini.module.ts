import { Module } from '@nestjs/common';
import { GeminiConversationAdapter } from '@infrastructure/adapters';
import { MessageSanitizerService } from './services';
import { EnvConfigService } from '@infrastructure/config';
import { IConversationAIPort } from '@application/ports/outbound';

/**
 * Module that configures Gemini AI for conversation.
 *
 * This module provides the conversation AI adapter that uses
 * Google's Gemini model with function calling for structured
 * order management.
 */
@Module({
  providers: [
    MessageSanitizerService,
    {
      provide: 'IConversationAI',
      useFactory: (
        envConfig: EnvConfigService,
        messageSanitizer: MessageSanitizerService,
      ): IConversationAIPort => {
        return new GeminiConversationAdapter(envConfig, messageSanitizer);
      },
      inject: [EnvConfigService, MessageSanitizerService],
    },
  ],
  exports: ['IConversationAI', MessageSanitizerService],
})
export class GeminiModule {}

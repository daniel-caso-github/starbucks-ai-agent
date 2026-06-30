import { Module } from '@nestjs/common';
import { GeminiConversationAdapter } from '@infrastructure/adapters';
import { MessageSanitizerService } from './services';
import { EnvConfigService } from '@infrastructure/config';
import { MetricsService, MetricsModule, TracingService } from '@infrastructure/observability';
import { IConversationAIPort } from '@application/ports/outbound';

/**
 * Module that configures Gemini AI for conversation.
 *
 * This module provides the conversation AI adapter that uses
 * Google's Gemini model with function calling for structured
 * order management.
 */
@Module({
  imports: [MetricsModule],
  providers: [
    MessageSanitizerService,
    {
      provide: 'IConversationAI',
      useFactory: (
        envConfig: EnvConfigService,
        messageSanitizer: MessageSanitizerService,
        metricsService: MetricsService,
        tracingService: TracingService,
      ): IConversationAIPort => {
        return new GeminiConversationAdapter(envConfig, messageSanitizer, metricsService, tracingService);
      },
      inject: [EnvConfigService, MessageSanitizerService, MetricsService, TracingService],
    },
  ],
  exports: ['IConversationAI', MessageSanitizerService],
})
export class GeminiModule {}

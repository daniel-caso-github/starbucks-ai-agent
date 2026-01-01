// src/infrastructure/observability/logging/app-logger.service.ts
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

export interface LogContext {
  component?: string;
  conversationId?: string;
  orderId?: string;
  userId?: string;
  duration?: number;
  tokens?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;
}

@Injectable()
export class AppLoggerService {
  constructor(
    @InjectPinoLogger(AppLoggerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Log para operaciones de IA
   */
  logAICall(context: {
    provider: 'claude' | 'gemini' | 'openai';
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
    error?: string;
  }): void {
    const logData = {
      component: 'ai',
      ...context,
      totalTokens: context.inputTokens + context.outputTokens,
      costEstimate: this.estimateCost(context),
    };

    if (context.success) {
      this.logger.info(logData, `AI call to ${context.provider}/${context.model} completed`);
    } else {
      this.logger.error(logData, `AI call to ${context.provider}/${context.model} failed`);
    }
  }

  /**
   * Log para operaciones de base de datos
   */
  logDBOperation(context: {
    operation: 'find' | 'save' | 'update' | 'delete';
    collection: string;
    durationMs: number;
    success: boolean;
    error?: string;
  }): void {
    const logData = {
      component: 'database',
      ...context,
    };

    if (context.success) {
      this.logger.debug(logData, `DB ${context.operation} on ${context.collection}`);
    } else {
      this.logger.error(logData, `DB ${context.operation} failed on ${context.collection}`);
    }
  }

  /**
   * Log para búsqueda vectorial
   */
  logVectorSearch(context: {
    query: string;
    resultsCount: number;
    durationMs: number;
    topScore?: number;
  }): void {
    this.logger.info(
      {
        component: 'chromadb',
        ...context,
      },
      `Vector search completed: ${context.resultsCount} results`,
    );
  }

  /**
   * Log para eventos de orden
   */
  logOrderEvent(context: {
    orderId: string;
    conversationId: string;
    event: 'created' | 'item_added' | 'confirmed' | 'cancelled';
    itemCount?: number;
    totalPrice?: string;
  }): void {
    this.logger.info(
      {
        component: 'order',
        ...context,
      },
      `Order ${context.event}: ${context.orderId}`,
    );
  }

  private estimateCost(context: {
    provider: string;
    inputTokens: number;
    outputTokens: number;
  }): number {
    // Precios aproximados por 1M tokens
    const pricing: Record<string, { input: number; output: number }> = {
      claude: { input: 3, output: 15 }, // Sonnet
      gemini: { input: 0.3, output: 2.5 }, // Flash
      openai: { input: 5, output: 15 }, // GPT-4o
    };

    const price = pricing[context.provider] || pricing.claude;
    const inputCost = (context.inputTokens / 1_000_000) * price.input;
    const outputCost = (context.outputTokens / 1_000_000) * price.output;

    return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimales
  }
}

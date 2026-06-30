import { Injectable } from '@nestjs/common';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer('starbucks-barista-ai');

  /**
   * Crea un span para una operación
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    return this.tracer.startSpan(name, { attributes });
  }

  /**
   * Ejecuta una función dentro de un span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Span para llamadas a AI
   */
  async traceAICall<T>(
    provider: string,
    model: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.withSpan(`ai.${provider}.${operation}`, async (span) => {
      span.setAttribute('ai.provider', provider);
      span.setAttribute('ai.model', model);
      span.setAttribute('ai.operation', operation);

      const result = await fn();

      // Extraer tokens según el formato de Gemini (usageMetadata)
      if (result && typeof result === 'object') {
        const usage = (result as any).response?.usageMetadata ?? (result as any).usageMetadata;
        if (usage) {
          span.setAttribute('ai.tokens.input', usage.promptTokenCount ?? 0);
          span.setAttribute('ai.tokens.output', usage.candidatesTokenCount ?? 0);
        }
      }

      return result;
    });
  }

  /**
   * Span para búsquedas vectoriales
   */
  async traceVectorSearch<T>(query: string, fn: () => Promise<T>): Promise<T> {
    return this.withSpan('chromadb.search', async (span) => {
      span.setAttribute('db.system', 'chromadb');
      span.setAttribute('db.operation', 'search');
      span.setAttribute('search.query', query.substring(0, 100)); // Truncar

      const result = await fn();

      if (Array.isArray(result)) {
        span.setAttribute('search.results_count', result.length);
      }

      return result;
    });
  }

  /**
   * Span para operaciones de base de datos
   */
  async traceDBOperation<T>(
    operation: string,
    collection: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.withSpan(`mongodb.${operation}`, async (span) => {
      span.setAttribute('db.system', 'mongodb');
      span.setAttribute('db.operation', operation);
      span.setAttribute('db.mongodb.collection', collection);

      return fn();
    });
  }

  /**
   * Obtiene el trace ID actual para correlación de logs
   */
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  /**
   * Obtiene el span ID actual
   */
  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }
}

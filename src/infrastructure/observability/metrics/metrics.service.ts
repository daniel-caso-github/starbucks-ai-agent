import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { METRICS } from './metrics.constants';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(METRICS.HTTP_REQUESTS_TOTAL)
    private readonly httpRequestsCounter: Counter<string>,

    @InjectMetric(METRICS.AI_CALLS_TOTAL)
    private readonly aiCallsCounter: Counter<string>,

    @InjectMetric(METRICS.AI_ERRORS_TOTAL)
    private readonly aiErrorsCounter: Counter<string>,

    @InjectMetric(METRICS.ORDERS_TOTAL)
    private readonly ordersCounter: Counter<string>,

    @InjectMetric(METRICS.HTTP_REQUEST_DURATION)
    private readonly httpDurationHistogram: Histogram<string>,

    @InjectMetric(METRICS.AI_CALL_DURATION)
    private readonly aiDurationHistogram: Histogram<string>,

    @InjectMetric(METRICS.DB_QUERY_DURATION)
    private readonly dbDurationHistogram: Histogram<string>,

    @InjectMetric(METRICS.VECTOR_SEARCH_DURATION)
    private readonly vectorSearchHistogram: Histogram<string>,

    @InjectMetric(METRICS.ACTIVE_CONVERSATIONS)
    private readonly activeConversationsGauge: Gauge<string>,

    @InjectMetric(METRICS.TOKENS_USED_TOTAL)
    private readonly tokensGauge: Gauge<string>,
  ) {}

  // HTTP Metrics
  recordHttpRequest(method: string, path: string, status: number, durationSec: number): void {
    this.httpRequestsCounter.inc({ method, path, status: status.toString() });
    this.httpDurationHistogram.observe({ method, path, status: status.toString() }, durationSec);
  }

  // AI Metrics
  recordAICall(
    provider: 'claude' | 'gemini' | 'openai',
    model: string,
    operation: string,
    durationSec: number,
    success: boolean,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const status = success ? 'success' : 'error';

    this.aiCallsCounter.inc({ provider, model, operation, status });
    this.aiDurationHistogram.observe({ provider, model, operation }, durationSec);

    // Track tokens
    this.tokensGauge.inc({ provider, type: 'input' }, inputTokens);
    this.tokensGauge.inc({ provider, type: 'output' }, outputTokens);
  }

  recordAIError(provider: string, model: string, errorType: string): void {
    this.aiErrorsCounter.inc({ provider, model, error_type: errorType });
  }

  // Database Metrics
  recordDBQuery(operation: string, collection: string, durationSec: number): void {
    this.dbDurationHistogram.observe({ operation, collection }, durationSec);
  }

  // Vector Search Metrics
  recordVectorSearch(collection: string, durationSec: number): void {
    this.vectorSearchHistogram.observe({ collection }, durationSec);
  }

  // Order Metrics
  recordOrder(status: 'created' | 'confirmed' | 'cancelled' | 'completed'): void {
    this.ordersCounter.inc({ status });
  }

  // Active Conversations
  setActiveConversations(count: number): void {
    this.activeConversationsGauge.set(count);
  }

  incrementActiveConversations(): void {
    this.activeConversationsGauge.inc();
  }

  decrementActiveConversations(): void {
    this.activeConversationsGauge.dec();
  }
}

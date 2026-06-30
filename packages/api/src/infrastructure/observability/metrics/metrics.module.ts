import { Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import { METRICS } from './metrics.constants';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    // Contadores
    makeCounterProvider({
      name: METRICS.HTTP_REQUESTS_TOTAL,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeCounterProvider({
      name: METRICS.AI_CALLS_TOTAL,
      help: 'Total number of AI API calls',
      labelNames: ['provider', 'model', 'operation', 'status'],
    }),
    makeCounterProvider({
      name: METRICS.AI_ERRORS_TOTAL,
      help: 'Total number of AI API errors',
      labelNames: ['provider', 'model', 'error_type'],
    }),
    makeCounterProvider({
      name: METRICS.ORDERS_TOTAL,
      help: 'Total number of orders',
      labelNames: ['status'],
    }),

    // Histogramas para latencia
    makeHistogramProvider({
      name: METRICS.HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    }),
    makeHistogramProvider({
      name: METRICS.AI_CALL_DURATION,
      help: 'AI API call duration in seconds',
      labelNames: ['provider', 'model', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }),
    makeHistogramProvider({
      name: METRICS.DB_QUERY_DURATION,
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'collection'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    }),
    makeHistogramProvider({
      name: METRICS.VECTOR_SEARCH_DURATION,
      help: 'Vector search duration in seconds',
      labelNames: ['collection'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    }),

    // Gauges
    makeGaugeProvider({
      name: METRICS.ACTIVE_CONVERSATIONS,
      help: 'Number of active conversations',
    }),
    makeGaugeProvider({
      name: METRICS.TOKENS_USED_TOTAL,
      help: 'Total tokens used',
      labelNames: ['provider', 'type'], // type: input/output
    }),
    MetricsService,
    MetricsInterceptor,
  ],
  exports: [PrometheusModule, MetricsService, MetricsInterceptor],
})
export class MetricsModule {}

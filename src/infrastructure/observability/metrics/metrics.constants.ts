/**
 * Prometheus metric names used throughout the application.
 */
export const METRICS = {
  // Counters
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  AI_CALLS_TOTAL: 'ai_calls_total',
  AI_ERRORS_TOTAL: 'ai_errors_total',
  ORDERS_TOTAL: 'orders_total',

  // Histograms (latency)
  HTTP_REQUEST_DURATION: 'http_request_duration_seconds',
  AI_CALL_DURATION: 'ai_call_duration_seconds',
  DB_QUERY_DURATION: 'db_query_duration_seconds',
  VECTOR_SEARCH_DURATION: 'vector_search_duration_seconds',

  // Gauges
  ACTIVE_CONVERSATIONS: 'active_conversations',
  TOKENS_USED_TOTAL: 'tokens_used_total',
} as const;

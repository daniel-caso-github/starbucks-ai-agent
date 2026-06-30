import type { ProcessMessageOutputDto } from '@starbucks/shared';

export type SseEvent =
  | { type: 'text'; data: string }
  | { type: 'complete'; data: ProcessMessageOutputDto }
  | { type: 'error' };

export function openMessageStream(
  message: string,
  conversationId: string | undefined,
  onEvent: (event: SseEvent) => void,
): () => void {
  const params = new URLSearchParams({ message });
  if (conversationId) {
    params.set('conversationId', conversationId);
  }

  const url = `/api/v1/conversations/messages/stream?${params.toString()}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data as string) as { type: string; data: unknown };
      if (parsed.type === 'text') {
        onEvent({ type: 'text', data: parsed.data as string });
      } else if (parsed.type === 'complete') {
        onEvent({ type: 'complete', data: parsed.data as ProcessMessageOutputDto });
        es.close();
      } else if (parsed.type === 'error') {
        onEvent({ type: 'error' });
        es.close();
      }
    } catch {
      onEvent({ type: 'error' });
      es.close();
    }
  };

  es.onerror = () => {
    onEvent({ type: 'error' });
    es.close();
  };

  return () => es.close();
}

import type { ConversationHistoryDto, ProcessMessageOutputDto } from '@starbucks/shared';
import { apiClient } from './client';

export async function sendMessage(
  message: string,
  conversationId?: string,
): Promise<ProcessMessageOutputDto> {
  return apiClient
    .post('conversations/messages', { json: { message, conversationId } })
    .json<ProcessMessageOutputDto>();
}

export async function getHistory(conversationId: string): Promise<ConversationHistoryDto> {
  return apiClient.get(`conversations/${conversationId}`).json<ConversationHistoryDto>();
}

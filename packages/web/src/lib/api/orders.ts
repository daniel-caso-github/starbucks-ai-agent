import type { OrderOutputDto } from '@starbucks/shared';
import { apiClient } from './client';

export async function confirmOrder(orderId: string): Promise<OrderOutputDto> {
  return apiClient.post(`orders/${orderId}/confirm`).json<OrderOutputDto>();
}

export async function cancelOrder(orderId: string): Promise<OrderOutputDto> {
  return apiClient.post(`orders/${orderId}/cancel`).json<OrderOutputDto>();
}

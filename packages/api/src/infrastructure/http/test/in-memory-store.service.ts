import { Injectable } from '@nestjs/common';
import { Conversation } from '@domain/entities';
import { Order } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';

@Injectable()
export class InMemoryStoreService {
  readonly conversations = new Map<string, Conversation>();
  readonly orders = new Map<string, Order>();
  readonly conversationToOrder = new Map<string, string>();

  reset(): void {
    this.conversations.clear();
    this.orders.clear();
    this.conversationToOrder.clear();
  }

  saveConversation(conv: Conversation): void {
    this.conversations.set(conv.id.toString(), conv);
  }

  findConversation(id: ConversationId): Conversation | null {
    return this.conversations.get(id.toString()) ?? null;
  }

  saveOrder(order: Order, conversationId?: string): void {
    this.orders.set(order.id.toString(), order);
    if (conversationId) {
      this.conversationToOrder.set(conversationId, order.id.toString());
    }
  }

  findActiveOrder(conversationId: string): Order | null {
    const orderId = this.conversationToOrder.get(conversationId);
    if (!orderId) return null;
    const order = this.orders.get(orderId);
    if (!order) return null;
    const s = order.status.toString();
    if (s === 'pending' || s === 'confirmed') return order;
    return null;
  }
}

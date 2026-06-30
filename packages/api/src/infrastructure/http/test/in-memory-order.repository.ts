import { Injectable } from '@nestjs/common';
import { Order } from '@domain/entities';
import { OrderId } from '@domain/value-objects';
import { IOrderRepositoryPort } from '@application/ports/outbound';
import { InMemoryStoreService } from './in-memory-store.service';

@Injectable()
export class InMemoryOrderRepository implements IOrderRepositoryPort {
  constructor(private readonly store: InMemoryStoreService) {}

  async save(order: Order): Promise<void> {
    this.store.saveOrder(order);
  }

  async saveWithConversation(order: Order, conversationId: string): Promise<void> {
    this.store.saveOrder(order, conversationId);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.orders.get(id.toString()) ?? null;
  }

  async findByConversationId(conversationId: string): Promise<Order[]> {
    const orderId = this.store.conversationToOrder.get(conversationId);
    if (!orderId) return [];
    const order = this.store.orders.get(orderId);
    return order ? [order] : [];
  }

  async findActiveByConversationId(conversationId: string): Promise<Order | null> {
    return this.store.findActiveOrder(conversationId);
  }

  async delete(id: OrderId): Promise<boolean> {
    return this.store.orders.delete(id.toString());
  }
}

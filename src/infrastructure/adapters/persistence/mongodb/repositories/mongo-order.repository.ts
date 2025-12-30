import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '@domain/entities';
import { OrderId } from '@domain/value-objects';
import { IOrderRepositoryPort } from '@application/ports/outbound';
import { OrderDocument, OrderDocumentType } from '../schemas';
import { OrderMapper } from '../mappers';

/**
 * MongoDB implementation of IOrderRepository.
 * Handles persistence of Order entities using Mongoose.
 */
@Injectable()
export class MongoOrderRepository implements IOrderRepositoryPort {
  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocumentType>,
  ) {}

  /**
   * Saves an order to MongoDB.
   * Uses upsert to handle both create and update operations.
   */
  async save(order: Order): Promise<void> {
    // We need the conversationId from somewhere - for now we'll extract it
    // from an existing document or require it to be passed differently
    const existingDoc = await this.orderModel.findById(order.id.toString());
    const conversationId = existingDoc?.conversationId ?? '';

    const document = OrderMapper.toDocument(order, conversationId);

    await this.orderModel.findByIdAndUpdate(
      document._id,
      {
        $set: {
          status: document.status,
          items: document.items,
          conversationId: document.conversationId,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Saves an order with an associated conversation ID.
   * This is the preferred method when creating new orders.
   */
  async saveWithConversation(order: Order, conversationId: string): Promise<void> {
    const document = OrderMapper.toDocument(order, conversationId);

    await this.orderModel.findByIdAndUpdate(
      document._id,
      {
        $set: {
          status: document.status,
          items: document.items,
          conversationId: document.conversationId,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Finds an order by its unique identifier.
   */
  async findById(id: OrderId): Promise<Order | null> {
    const document = await this.orderModel.findById(id.toString());

    if (!document) {
      return null;
    }

    return OrderMapper.toDomain(document);
  }

  /**
   * Finds all orders for a specific conversation.
   * Returns orders sorted by creation date (newest first).
   */
  async findByConversationId(conversationId: string): Promise<Order[]> {
    const documents = await this.orderModel.find({ conversationId }).sort({ createdAt: -1 });

    return documents.map((doc) => OrderMapper.toDomain(doc));
  }

  /**
   * Finds the active (pending or confirmed) order for a conversation.
   * There should only be one active order per conversation at a time.
   */
  async findActiveByConversationId(conversationId: string): Promise<Order | null> {
    const document = await this.orderModel.findOne({
      conversationId,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (!document) {
      return null;
    }

    return OrderMapper.toDomain(document);
  }

  /**
   * Deletes an order by its ID.
   */
  async delete(id: OrderId): Promise<boolean> {
    const result = await this.orderModel.deleteOne({ _id: id.toString() });
    return result.deletedCount > 0;
  }
}

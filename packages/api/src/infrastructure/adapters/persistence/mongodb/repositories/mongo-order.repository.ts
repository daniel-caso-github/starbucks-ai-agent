import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '@domain/entities';
import { OrderId } from '@domain/value-objects';
import { IOrderRepositoryPort } from '@application/ports/outbound';
import { CacheService, ActiveOrderCache } from '@infrastructure/cache';
import { MetricsService } from '@infrastructure/observability';
import { OrderDocument, OrderDocumentType } from '../schemas';
import { OrderMapper } from '../mappers';

/**
 * MongoDB implementation of IOrderRepository.
 * Handles persistence of Order entities using Mongoose.
 * Includes Redis caching for active orders.
 */
@Injectable()
export class MongoOrderRepository implements IOrderRepositoryPort {
  private readonly logger = new Logger(MongoOrderRepository.name);
  private readonly collectionName = 'orders';

  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocumentType>,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Saves an order to MongoDB.
   * Uses upsert to handle both create and update operations.
   */
  async save(order: Order): Promise<void> {
    this.logger.debug(`Saving order: ${order.id.toString()}`);
    const startTime = Date.now();

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

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('upsert', this.collectionName, durationSec);

    // Invalidate active order cache
    if (conversationId) {
      await this.cacheService.invalidateActiveOrder(conversationId);
    }

    this.logger.debug(`Order saved: ${order.id.toString()}, status: ${order.status.toString()}`);
  }

  /**
   * Saves an order with an associated conversation ID.
   * This is the preferred method when creating new orders.
   * Invalidates the active order cache after save.
   */
  async saveWithConversation(order: Order, conversationId: string): Promise<void> {
    this.logger.debug(
      `Saving order with conversation: ${order.id.toString()}, conversation: ${conversationId}`,
    );
    const startTime = Date.now();

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

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('upsert', this.collectionName, durationSec);

    // Invalidate active order cache and update with new data
    await this.cacheService.invalidateActiveOrder(conversationId);

    this.logger.debug(`Order saved: ${order.id.toString()}, items: ${order.totalQuantity}`);
  }

  /**
   * Finds an order by its unique identifier.
   */
  async findById(id: OrderId): Promise<Order | null> {
    this.logger.debug(`Finding order by ID: ${id.toString()}`);
    const startTime = Date.now();

    const document = await this.orderModel.findById(id.toString());

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('findById', this.collectionName, durationSec);

    if (!document) {
      this.logger.debug(`Order not found: ${id.toString()}`);
      return null;
    }

    return OrderMapper.toDomain(document);
  }

  /**
   * Finds all orders for a specific conversation.
   * Returns orders sorted by creation date (newest first).
   */
  async findByConversationId(conversationId: string): Promise<Order[]> {
    this.logger.debug(`Finding orders by conversation: ${conversationId}`);
    const startTime = Date.now();

    const documents = await this.orderModel.find({ conversationId }).sort({ createdAt: -1 });

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('find', this.collectionName, durationSec);

    this.logger.debug(`Found ${documents.length} orders for conversation ${conversationId}`);

    return documents.map((doc) => OrderMapper.toDomain(doc));
  }

  /**
   * Finds the active (pending or confirmed) order for a conversation.
   * There should only be one active order per conversation at a time.
   * Uses Redis cache for improved performance.
   */
  async findActiveByConversationId(conversationId: string): Promise<Order | null> {
    this.logger.debug(`Finding active order for conversation: ${conversationId}`);

    // Try to get from cache first
    const cached = await this.cacheService.getActiveOrder(conversationId);
    if (cached) {
      this.logger.debug(`Cache HIT for active order: ${conversationId}`);
      const startTime = Date.now();
      // We have cached data, but still need to verify it's still active in DB
      // and return the full Order entity
      const document = await this.orderModel.findById(cached.orderId);
      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.recordDBQuery('findById', this.collectionName, durationSec);

      if (document && ['pending', 'confirmed'].includes(document.status)) {
        return OrderMapper.toDomain(document);
      }
      // Cache is stale, invalidate it
      await this.cacheService.invalidateActiveOrder(conversationId);
    }

    // Cache miss or stale - query database
    const startTime = Date.now();
    const document = await this.orderModel.findOne({
      conversationId,
      status: { $in: ['pending', 'confirmed'] },
    });

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('findOne', this.collectionName, durationSec);

    if (!document) {
      this.logger.debug(`No active order found for conversation ${conversationId}`);
      return null;
    }

    // Store in cache for future requests
    const orderCache: ActiveOrderCache = {
      orderId: document._id,
      status: document.status,
      items: document.items.map((item) => ({
        drinkName: item.drinkName,
        size: item.size ?? 'regular',
        quantity: item.quantity,
        price: `$${(item.unitPriceCents / 100).toFixed(2)}`,
      })),
      totalPrice: `$${(
        document.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) / 100
      ).toFixed(2)}`,
      cachedAt: new Date().toISOString(),
    };
    await this.cacheService.setActiveOrder(conversationId, orderCache);

    this.logger.debug(`Found active order ${document._id} for conversation ${conversationId}`);

    return OrderMapper.toDomain(document);
  }

  /**
   * Deletes an order by its ID.
   */
  async delete(id: OrderId): Promise<boolean> {
    this.logger.debug(`Deleting order: ${id.toString()}`);
    const startTime = Date.now();

    const result = await this.orderModel.deleteOne({ _id: id.toString() });

    // Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('delete', this.collectionName, durationSec);

    const deleted = result.deletedCount > 0;

    if (deleted) {
      this.logger.log(`Order deleted: ${id.toString()}`);
    }

    return deleted;
  }
}

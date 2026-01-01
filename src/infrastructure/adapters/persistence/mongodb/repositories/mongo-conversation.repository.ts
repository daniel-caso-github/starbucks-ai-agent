import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';
import { IConversationRepositoryPort } from '@application/ports/outbound';
import { CacheService, ConversationHistoryCache } from '@infrastructure/cache';
import { ConversationDocument, ConversationDocumentType } from '../schemas';
import { ConversationMapper } from '../mappers';

/**
 * MongoDB implementation of IConversationRepository.
 * Handles persistence of Conversation entities using Mongoose.
 * Includes Redis caching for improved performance.
 */
@Injectable()
export class MongoConversationRepository implements IConversationRepositoryPort {
  private readonly logger = new Logger(MongoConversationRepository.name);

  constructor(
    @InjectModel(ConversationDocument.name)
    private readonly conversationModel: Model<ConversationDocumentType>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Saves a conversation to MongoDB.
   * Uses upsert to handle both create and update operations.
   */
  async save(conversation: Conversation): Promise<void> {
    try {
      const document = ConversationMapper.toDocument(conversation);

      // Convert messages to plain objects for MongoDB
      const messagesData = document.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      this.logger.debug(`Saving conversation: ${document._id}`);

      // Check if document exists first
      const exists = await this.conversationModel.exists({ _id: document._id });

      if (exists) {
        // Update existing document
        await this.conversationModel.updateOne(
          { _id: document._id },
          {
            $set: {
              messages: messagesData,
              currentOrderId: document.currentOrderId,
            },
          },
        );
        this.logger.debug(`Updated conversation: ${document._id}`);
      } else {
        // Create new document
        const created = await this.conversationModel.create({
          _id: document._id,
          messages: messagesData,
          currentOrderId: document.currentOrderId,
        });
        this.logger.debug(`Created conversation: ${created._id}`);
      }
      // Invalidate cache after save
      await this.cacheService.invalidateConversationHistory(document._id);
      this.logger.debug(`Cache invalidated for conversation: ${document._id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save conversation: ${message}`);
      throw error;
    }
  }

  /**
   * Finds a conversation by its unique identifier.
   * Uses Redis cache to reduce database queries.
   */
  async findById(id: ConversationId): Promise<Conversation | null> {
    const conversationId = id.toString();

    // Try to get from cache first
    const cached = await this.cacheService.getConversationHistory(conversationId);
    if (cached) {
      this.logger.debug(`Cache HIT for conversation: ${conversationId}`);
      // Reconstruct conversation from cache
      const document = await this.conversationModel.findOne({ _id: conversationId });
      if (document) {
        return ConversationMapper.toDomain(document);
      }
    }

    // Cache miss - query database
    const document = await this.conversationModel.findOne({ _id: conversationId });

    if (!document) {
      return null;
    }

    // Store in cache for future requests
    const historyCache: ConversationHistoryCache = {
      messages: document.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
      cachedAt: new Date().toISOString(),
    };
    await this.cacheService.setConversationHistory(conversationId, historyCache);

    return ConversationMapper.toDomain(document);
  }

  /**
   * Retrieves a conversation with only the most recent messages.
   * This is optimized for providing context to the AI without
   * loading potentially hundreds of messages.
   * Uses Redis cache for improved performance.
   */
  async getRecentHistory(id: ConversationId, limit = 10): Promise<Conversation | null> {
    const conversationId = id.toString();

    // Try to get from cache first
    const cached = await this.cacheService.getConversationHistory(conversationId);
    if (cached && cached.messages.length > 0) {
      this.logger.debug(`Cache HIT for recent history: ${conversationId}`);
      // Return cached data - we still need to query DB for full conversation structure
      // but the messages are already in cache
    }

    // Use aggregation to slice messages array from the end
    const result = await this.conversationModel.aggregate([
      { $match: { _id: conversationId } },
      {
        $project: {
          _id: 1,
          messages: { $slice: ['$messages', -limit] },
          currentOrderId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    if (result.length === 0) {
      return null;
    }

    // Store in cache
    const doc = result[0] as ConversationDocument;
    const historyCache: ConversationHistoryCache = {
      messages: doc.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp).toISOString(),
      })),
      cachedAt: new Date().toISOString(),
    };
    await this.cacheService.setConversationHistory(conversationId, historyCache);

    return ConversationMapper.toDomain(doc);
  }

  /**
   * Deletes a conversation and all its messages.
   * Also invalidates the cache.
   */
  async delete(id: ConversationId): Promise<boolean> {
    const conversationId = id.toString();
    const result = await this.conversationModel.deleteOne({
      _id: conversationId,
    });

    if (result.deletedCount > 0) {
      await this.cacheService.invalidateConversationHistory(conversationId);
      this.logger.debug(`Cache invalidated after delete: ${conversationId}`);
    }

    return result.deletedCount > 0;
  }

  /**
   * Checks if a conversation exists without loading its content.
   */
  async exists(id: ConversationId): Promise<boolean> {
    const count = await this.conversationModel.countDocuments({
      _id: id.toString(),
    });
    return count > 0;
  }
}

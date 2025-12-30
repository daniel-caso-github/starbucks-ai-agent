import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';
import { IConversationRepositoryPort } from '@application/ports/outbound';
import { ConversationDocument, ConversationDocumentType } from '../schemas';
import { ConversationMapper } from '../mappers';

/**
 * MongoDB implementation of IConversationRepository.
 * Handles persistence of Conversation entities using Mongoose.
 */
@Injectable()
export class MongoConversationRepository implements IConversationRepositoryPort {
  constructor(
    @InjectModel(ConversationDocument.name)
    private readonly conversationModel: Model<ConversationDocumentType>,
  ) {}

  /**
   * Saves a conversation to MongoDB.
   * Uses upsert to handle both create and update operations.
   */
  async save(conversation: Conversation): Promise<void> {
    const document = ConversationMapper.toDocument(conversation);

    await this.conversationModel.findByIdAndUpdate(
      document._id,
      {
        $set: {
          messages: document.messages,
          currentOrderId: document.currentOrderId,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Finds a conversation by its unique identifier.
   */
  async findById(id: ConversationId): Promise<Conversation | null> {
    const document = await this.conversationModel.findById(id.toString());

    if (!document) {
      return null;
    }

    return ConversationMapper.toDomain(document);
  }

  /**
   * Retrieves a conversation with only the most recent messages.
   * This is optimized for providing context to the AI without
   * loading potentially hundreds of messages.
   */
  async getRecentHistory(id: ConversationId, limit = 10): Promise<Conversation | null> {
    // Use aggregation to slice messages array from the end
    const result = await this.conversationModel.aggregate([
      { $match: { _id: id.toString() } },
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

    // Manually create the document structure for the mapper
    const doc = result[0] as ConversationDocument;
    return ConversationMapper.toDomain(doc);
  }

  /**
   * Deletes a conversation and all its messages.
   */
  async delete(id: ConversationId): Promise<boolean> {
    const result = await this.conversationModel.deleteOne({
      _id: id.toString(),
    });
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

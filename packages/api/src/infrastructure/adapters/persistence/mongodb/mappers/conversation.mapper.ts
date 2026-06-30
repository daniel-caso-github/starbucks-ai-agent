import { Conversation } from '@domain/entities';
import { ConversationId, Message, OrderId } from '@domain/value-objects';
import { ConversationDocument, MessageDocument } from '../schemas';

/**
 * Mapper for converting between Conversation domain entity and MongoDB document.
 */
export class ConversationMapper {
  /**
   * Converts a MongoDB document to a domain Conversation entity.
   */
  static toDomain(document: ConversationDocument): Conversation {
    const messages = document.messages.map((msg) => this.messageToDomain(msg));

    return Conversation.reconstitute({
      id: ConversationId.fromString(document._id),
      messages,
      currentOrderId: document.currentOrderId ? OrderId.fromString(document.currentOrderId) : null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  /**
   * Converts a domain Conversation entity to a MongoDB document.
   */
  static toDocument(conversation: Conversation): ConversationDocument {
    const document = new ConversationDocument();
    document._id = conversation.id.toString();
    document.messages = conversation.messages.map((msg) => this.messageToDocument(msg));
    document.currentOrderId = conversation.currentOrderId?.toString() ?? null;
    document.createdAt = conversation.createdAt;
    document.updatedAt = conversation.updatedAt;
    return document;
  }

  /**
   * Converts a MongoDB message subdocument to domain Message.
   */
  private static messageToDomain(document: MessageDocument): Message {
    return Message.reconstitute(
      document.role as 'user' | 'assistant',
      document.content,
      document.timestamp,
    );
  }

  /**
   * Converts a domain Message to MongoDB subdocument.
   */
  private static messageToDocument(message: Message): MessageDocument {
    const document = new MessageDocument();
    document.role = message.role;
    document.content = message.content;
    document.timestamp = message.timestamp;
    return document;
  }
}

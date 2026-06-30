import { Injectable } from '@nestjs/common';
import { Conversation } from '@domain/entities';
import { ConversationId } from '@domain/value-objects';
import { IConversationRepositoryPort } from '@application/ports/outbound';
import { InMemoryStoreService } from './in-memory-store.service';

@Injectable()
export class InMemoryConversationRepository implements IConversationRepositoryPort {
  constructor(private readonly store: InMemoryStoreService) {}

  async save(conversation: Conversation): Promise<void> {
    this.store.saveConversation(conversation);
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    return this.store.findConversation(id);
  }

  async getRecentHistory(id: ConversationId, _limit = 10): Promise<Conversation | null> {
    return this.store.findConversation(id);
  }

  async delete(id: ConversationId): Promise<boolean> {
    return this.store.conversations.delete(id.toString());
  }

  async exists(id: ConversationId): Promise<boolean> {
    return this.store.conversations.has(id.toString());
  }
}

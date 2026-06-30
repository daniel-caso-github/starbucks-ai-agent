import { Injectable } from '@nestjs/common';
import {
  ActiveOrderCache,
  ConversationContextCache,
  ConversationHistoryCache,
} from '@infrastructure/cache/cache.service';

@Injectable()
export class NopCacheService {
  normalizeAndHash(_query: string): string { return ''; }

  async get<T>(_key: string): Promise<T | null> { return null; }
  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {}
  async del(_key: string): Promise<void> {}

  async getConversationHistory(_id: string): Promise<ConversationHistoryCache | null> { return null; }
  async setConversationHistory(_id: string, _h: ConversationHistoryCache): Promise<void> {}
  async invalidateConversationHistory(_id: string): Promise<void> {}

  async getActiveOrder(_id: string): Promise<ActiveOrderCache | null> { return null; }
  async setActiveOrder(_id: string, _o: ActiveOrderCache): Promise<void> {}
  async invalidateActiveOrder(_id: string): Promise<void> {}

  async getConversationContext(_id: string): Promise<ConversationContextCache | null> { return null; }
  async setConversationContext(_id: string, _c: ConversationContextCache): Promise<void> {}

  async getDrinksSearch<T>(_hash: string): Promise<T | null> { return null; }
  async setDrinksSearch<T>(_hash: string, _results: T): Promise<void> {}

  async getAllDrinks<T>(): Promise<T | null> { return null; }
  async setAllDrinks<T>(_drinks: T): Promise<void> {}

  async getExactQuery<T>(_hash: string): Promise<T | null> { return null; }
  async setExactQuery<T>(_hash: string, _response: T): Promise<void> {}
}

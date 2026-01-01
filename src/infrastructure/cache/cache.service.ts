import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * Cache TTL constants (in seconds for Redis)
 */
export const CACHE_TTL = {
  CONVERSATION_HISTORY: 1800, // 30 minutes
  ACTIVE_ORDER: 900, // 15 minutes
  CONVERSATION_CONTEXT: 600, // 10 minutes
  DRINKS_SEARCH: 3600, // 1 hour
  DRINKS_ALL: 86400, // 24 hours
  EXACT_QUERY: 3600, // 1 hour
} as const;

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  conversationHistory: (id: string) => `conv:${id}:history`,
  activeOrder: (conversationId: string) => `conv:${conversationId}:order`,
  conversationContext: (id: string) => `conv:${id}:context`,
  drinksSearch: (queryHash: string) => `drinks:search:${queryHash}`,
  drinksAll: () => 'drinks:all',
  exactQuery: (hash: string) => `query:exact:${hash}`,
} as const;

export interface ConversationHistoryCache {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  cachedAt: string;
}

export interface ActiveOrderCache {
  orderId: string;
  status: string;
  items: Array<{
    drinkName: string;
    size: string;
    quantity: number;
    price: string;
  }>;
  totalPrice: string;
  cachedAt: string;
}

export interface ConversationContextCache {
  currentIntent: string | null;
  hasActiveOrder: boolean;
  lastDrinkMentioned: string | null;
  cachedAt: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ==========================================
  // Generic Cache Operations
  // ==========================================

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value) as T;
      } else {
        this.logger.debug(`Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Cache GET error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds ?? 'none'}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for ${key}:`, error);
    }
  }

  // ==========================================
  // Conversation History Cache
  // ==========================================

  async getConversationHistory(conversationId: string): Promise<ConversationHistoryCache | null> {
    const key = CACHE_KEYS.conversationHistory(conversationId);
    return this.get<ConversationHistoryCache>(key);
  }

  async setConversationHistory(
    conversationId: string,
    history: ConversationHistoryCache,
  ): Promise<void> {
    const key = CACHE_KEYS.conversationHistory(conversationId);
    await this.set(key, history, CACHE_TTL.CONVERSATION_HISTORY);
  }

  async invalidateConversationHistory(conversationId: string): Promise<void> {
    const key = CACHE_KEYS.conversationHistory(conversationId);
    await this.del(key);
  }

  // ==========================================
  // Active Order Cache
  // ==========================================

  async getActiveOrder(conversationId: string): Promise<ActiveOrderCache | null> {
    const key = CACHE_KEYS.activeOrder(conversationId);
    return this.get<ActiveOrderCache>(key);
  }

  async setActiveOrder(conversationId: string, order: ActiveOrderCache): Promise<void> {
    const key = CACHE_KEYS.activeOrder(conversationId);
    await this.set(key, order, CACHE_TTL.ACTIVE_ORDER);
  }

  async invalidateActiveOrder(conversationId: string): Promise<void> {
    const key = CACHE_KEYS.activeOrder(conversationId);
    await this.del(key);
  }

  // ==========================================
  // Conversation Context Cache
  // ==========================================

  async getConversationContext(conversationId: string): Promise<ConversationContextCache | null> {
    const key = CACHE_KEYS.conversationContext(conversationId);
    return this.get<ConversationContextCache>(key);
  }

  async setConversationContext(
    conversationId: string,
    context: ConversationContextCache,
  ): Promise<void> {
    const key = CACHE_KEYS.conversationContext(conversationId);
    await this.set(key, context, CACHE_TTL.CONVERSATION_CONTEXT);
  }

  // ==========================================
  // Drinks Cache
  // ==========================================

  async getDrinksSearch<T>(queryHash: string): Promise<T | null> {
    const key = CACHE_KEYS.drinksSearch(queryHash);
    return this.get<T>(key);
  }

  async setDrinksSearch<T>(queryHash: string, results: T): Promise<void> {
    const key = CACHE_KEYS.drinksSearch(queryHash);
    await this.set(key, results, CACHE_TTL.DRINKS_SEARCH);
  }

  async getAllDrinks<T>(): Promise<T | null> {
    const key = CACHE_KEYS.drinksAll();
    return this.get<T>(key);
  }

  async setAllDrinks<T>(drinks: T): Promise<void> {
    const key = CACHE_KEYS.drinksAll();
    await this.set(key, drinks, CACHE_TTL.DRINKS_ALL);
  }

  // ==========================================
  // Exact Query Cache
  // ==========================================

  async getExactQuery<T>(queryHash: string): Promise<T | null> {
    const key = CACHE_KEYS.exactQuery(queryHash);
    return this.get<T>(key);
  }

  async setExactQuery<T>(queryHash: string, response: T): Promise<void> {
    const key = CACHE_KEYS.exactQuery(queryHash);
    await this.set(key, response, CACHE_TTL.EXACT_QUERY);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Generate a hash for cache key from a query string
   */
  normalizeAndHash(query: string): string {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

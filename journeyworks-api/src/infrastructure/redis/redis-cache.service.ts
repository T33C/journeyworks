/**
 * Redis Cache Service
 *
 * Provides caching functionality with TTL support.
 * Falls back to in-memory caching via RedisClientService if Redis is unavailable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly defaultTtl: number;
  private readonly keyPrefix = 'jw:cache:';

  constructor(
    private readonly redisClient: RedisClientService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = this.configService.get<number>('redis.cacheTtl') || 3600;
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.keyPrefix + key;

    try {
      const value = await this.redisClient.get(fullKey);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error for ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a cached value
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.keyPrefix + key;
    const ttl = ttlSeconds || this.defaultTtl;

    try {
      await this.redisClient.set(fullKey, JSON.stringify(value), ttl);
    } catch (error) {
      this.logger.warn(`Cache set error for ${key}: ${error.message}`);
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key;

    try {
      await this.redisClient.del(fullKey);
    } catch (error) {
      this.logger.warn(`Cache delete error for ${key}: ${error.message}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const client = this.redisClient.getClient();
    const fullPattern = this.keyPrefix + pattern;

    // Pattern deletion only works with Redis
    if (!client) {
      return 0;
    }

    try {
      const keys = await client.keys(fullPattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      this.logger.warn(
        `Cache delete pattern error for ${pattern}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = this.redisClient.getClient();
    const fullKey = this.keyPrefix + key;

    try {
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.warn(`Cache exists error for ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTtl(key: string): Promise<number> {
    const client = this.redisClient.getClient();
    const fullKey = this.keyPrefix + key;

    try {
      return await client.ttl(fullKey);
    } catch (error) {
      this.logger.warn(`Cache TTL error for ${key}: ${error.message}`);
      return -1;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    const client = this.redisClient.getClient();
    const fullKey = this.keyPrefix + key;

    try {
      return await client.incrby(fullKey, by);
    } catch (error) {
      this.logger.warn(`Cache increment error for ${key}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Create a cache key from components
   */
  createKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}

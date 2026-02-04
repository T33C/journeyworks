/**
 * Redis Client Service
 *
 * Manages the Redis connection using ioredis.
 * Falls back to in-memory cache if Redis is unavailable.
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisClientService.name);
  private client: Redis | null = null;
  private isRedisAvailable = false;
  private inMemoryCache: Map<string, { value: string; expiry?: number }> =
    new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url');
    const password = this.configService.get<string>('redis.password');
    const optional = this.configService.get<boolean>('redis.optional') ?? true;

    this.logger.log(`Connecting to Redis at ${redisUrl}`);

    try {
      this.client = new Redis(redisUrl, {
        password: password || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000); // Exponential backoff
        },
        lazyConnect: true, // Don't connect immediately
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.isRedisAvailable = true;
      });

      this.client.on('error', (error) => {
        this.logger.error(`Redis error: ${error.message}`);
        this.isRedisAvailable = false;
      });

      this.client.on('close', () => {
        this.isRedisAvailable = false;
      });

      // Try to connect
      await this.client.connect();
      await this.client.ping();
      this.isRedisAvailable = true;
      this.logger.log('Redis connection verified');
    } catch (error) {
      this.logger.warn(`Failed to connect to Redis: ${error.message}`);
      this.isRedisAvailable = false;

      if (optional) {
        this.logger.warn('Redis is optional - using in-memory cache fallback');
      } else {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isRedisAvailable) {
      try {
        await this.client.quit();
        this.logger.log('Redis connection closed');
      } catch (error) {
        this.logger.warn(`Error closing Redis connection: ${error.message}`);
      }
    }
  }

  /**
   * Get the Redis client instance (may be null if Redis is unavailable)
   */
  getClient(): Redis | null {
    return this.isRedisAvailable ? this.client : null;
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.isRedisAvailable && this.client?.status === 'ready';
  }

  /**
   * Check if using in-memory fallback
   */
  isUsingFallback(): boolean {
    return !this.isRedisAvailable;
  }

  /**
   * Get a value (works with Redis or in-memory fallback)
   */
  async get(key: string): Promise<string | null> {
    if (this.isRedisAvailable && this.client) {
      return this.client.get(key);
    }

    // In-memory fallback
    const cached = this.inMemoryCache.get(key);
    if (!cached) return null;
    if (cached.expiry && Date.now() > cached.expiry) {
      this.inMemoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  /**
   * Set a value (works with Redis or in-memory fallback)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return;
    }

    // In-memory fallback
    this.inMemoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  /**
   * Delete a value (works with Redis or in-memory fallback)
   */
  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      await this.client.del(key);
      return;
    }

    // In-memory fallback
    this.inMemoryCache.delete(key);
  }

  /**
   * Get Redis health status
   */
  async getHealth(): Promise<{
    status: string;
    mode: 'redis' | 'in-memory';
    latencyMs?: number;
    error?: string;
  }> {
    if (!this.isRedisAvailable) {
      return {
        status: 'degraded',
        mode: 'in-memory',
      };
    }

    try {
      const start = Date.now();
      await this.client!.ping();
      const latencyMs = Date.now() - start;

      return {
        status: 'healthy',
        mode: 'redis',
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mode: 'redis',
        error: error.message,
      };
    }
  }
}

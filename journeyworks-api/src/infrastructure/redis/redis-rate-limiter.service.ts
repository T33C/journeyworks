/**
 * Redis Rate Limiter Service
 *
 * Provides rate limiting functionality using Redis.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 * Used primarily for LLM API call rate limiting.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisClientService } from './redis-client.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

@Injectable()
export class RedisRateLimiterService {
  private readonly logger = new Logger(RedisRateLimiterService.name);
  private readonly keyPrefix = 'jw:ratelimit:';

  // In-memory fallback for rate limiting
  private inMemoryLimits: Map<string, { timestamps: number[] }> = new Map();

  constructor(private readonly redisClient: RedisClientService) {}

  /**
   * Check and consume rate limit
   * Uses sliding window algorithm
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const client = this.redisClient.getClient();

    // Use in-memory fallback if Redis is not available
    if (!client) {
      return this.checkLimitInMemory(identifier, config);
    }

    const key = this.keyPrefix + identifier;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use a transaction for atomic operations
      const multi = client.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now.toString(), `${now}:${Math.random()}`);

      // Set expiry on the key
      multi.pexpire(key, config.windowMs);

      const results = await multi.exec();

      // Get the count (second command result)
      const currentCount = (results?.[1]?.[1] as number) || 0;
      const allowed = currentCount < config.maxRequests;
      const remaining = Math.max(
        0,
        config.maxRequests - currentCount - (allowed ? 1 : 0),
      );

      // Calculate reset time
      const resetAt = new Date(now + config.windowMs);

      if (!allowed) {
        // Get the oldest entry to calculate retry time
        const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTime = oldest.length > 1 ? parseInt(oldest[1], 10) : now;
        const retryAfterMs = oldestTime + config.windowMs - now;

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfterMs: Math.max(0, retryAfterMs),
        };
      }

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    } catch (error) {
      this.logger.error(`Rate limit check error: ${error.message}`);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs),
      };
    }
  }

  /**
   * In-memory rate limit check (fallback when Redis unavailable)
   */
  private checkLimitInMemory(
    identifier: string,
    config: RateLimitConfig,
  ): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = this.inMemoryLimits.get(identifier);
    if (!entry) {
      entry = { timestamps: [] };
      this.inMemoryLimits.set(identifier, entry);
    }

    // Remove old timestamps
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const currentCount = entry.timestamps.length;
    const allowed = currentCount < config.maxRequests;

    if (allowed) {
      entry.timestamps.push(now);
    }

    const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
    const resetAt = new Date(now + config.windowMs);

    if (!allowed && entry.timestamps.length > 0) {
      const oldestTime = entry.timestamps[0];
      const retryAfterMs = oldestTime + config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(0, retryAfterMs),
      };
    }

    return {
      allowed,
      remaining,
      resetAt,
    };
  }

  /**
   * Get current rate limit status without consuming
   */
  async getStatus(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const client = this.redisClient.getClient();
    const now = Date.now();

    // Use in-memory fallback if Redis is not available
    if (!client) {
      const entry = this.inMemoryLimits.get(identifier);
      const windowStart = now - config.windowMs;
      const timestamps =
        entry?.timestamps.filter((ts) => ts > windowStart) || [];
      const remaining = Math.max(0, config.maxRequests - timestamps.length);
      return {
        allowed: remaining > 0,
        remaining,
        resetAt: new Date(now + config.windowMs),
      };
    }

    const key = this.keyPrefix + identifier;
    const windowStart = now - config.windowMs;

    try {
      // Remove old entries and count
      await client.zremrangebyscore(key, 0, windowStart);
      const currentCount = await client.zcard(key);

      const remaining = Math.max(0, config.maxRequests - currentCount);
      const allowed = remaining > 0;

      return {
        allowed,
        remaining,
        resetAt: new Date(now + config.windowMs),
      };
    } catch (error) {
      this.logger.error(`Rate limit status error: ${error.message}`);
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs),
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const client = this.redisClient.getClient();

    // Use in-memory fallback if Redis is not available
    if (!client) {
      this.inMemoryLimits.delete(identifier);
      return;
    }

    const key = this.keyPrefix + identifier;

    try {
      await client.del(key);
    } catch (error) {
      this.logger.error(`Rate limit reset error: ${error.message}`);
    }
  }

  /**
   * Create a rate limiter for LLM API calls
   * Default: 60 requests per minute
   */
  createLLMRateLimiter(requestsPerMinute: number = 60): RateLimitConfig {
    return {
      maxRequests: requestsPerMinute,
      windowMs: 60 * 1000, // 1 minute
    };
  }
}

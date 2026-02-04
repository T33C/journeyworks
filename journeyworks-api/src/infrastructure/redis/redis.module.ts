/**
 * Redis Module
 *
 * Provides Redis client for caching and rate limiting.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';
import { RedisCacheService } from './redis-cache.service';
import { RedisRateLimiterService } from './redis-rate-limiter.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisClientService, RedisCacheService, RedisRateLimiterService],
  exports: [RedisClientService, RedisCacheService, RedisRateLimiterService],
})
export class RedisModule {}

/* eslint-disable @typescript-eslint/no-explicit-any */

import { RedisRateLimiterService } from './redis-rate-limiter.service';

describe('RedisRateLimiterService', () => {
  let service: RedisRateLimiterService;
  let redisClientMock: { getClient: jest.Mock };

  beforeEach(() => {
    redisClientMock = {
      getClient: jest.fn(),
    };

    service = new RedisRateLimiterService(redisClientMock as any);
  });

  it('checkLimit uses in-memory fallback and blocks when limit reached', async () => {
    redisClientMock.getClient.mockReturnValue(null);
    const config = { maxRequests: 1, windowMs: 1000 };

    const first = await service.checkLimit('user-1', config);
    const second = await service.checkLimit('user-1', config);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(0);
    expect(second.retryAfterMs).toBeDefined();
  });

  it('checkLimit uses redis transaction path when client available', async () => {
    const multi = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      pexpire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 2],
        [null, 1],
        [null, 1],
      ]),
    };
    const rawClient = {
      multi: jest.fn().mockReturnValue(multi),
      zrange: jest.fn(),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    const result = await service.checkLimit('acct-1', {
      maxRequests: 5,
      windowMs: 60000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(rawClient.multi).toHaveBeenCalled();
  });

  it('checkLimit returns blocked with retryAfter when redis count exceeds max', async () => {
    const oldestScore = `${Date.now() - 500}`;
    const multi = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      pexpire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 5],
        [null, 1],
        [null, 1],
      ]),
    };
    const rawClient = {
      multi: jest.fn().mockReturnValue(multi),
      zrange: jest.fn().mockResolvedValue(['member', oldestScore]),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    const result = await service.checkLimit('acct-2', {
      maxRequests: 5,
      windowMs: 10000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    expect(rawClient.zrange).toHaveBeenCalled();
  });

  it('checkLimit fails open on redis errors', async () => {
    const multi = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      pexpire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('redis err')),
    };
    redisClientMock.getClient.mockReturnValue({
      multi: jest.fn().mockReturnValue(multi),
      zrange: jest.fn(),
    });

    const result = await service.checkLimit('acct-3', {
      maxRequests: 10,
      windowMs: 1000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it('getStatus uses in-memory fallback when redis unavailable', async () => {
    redisClientMock.getClient.mockReturnValue(null);
    (service as any).inMemoryLimits.set('u1', {
      timestamps: [Date.now() - 100, Date.now() - 200],
    });

    const status = await service.getStatus('u1', {
      maxRequests: 5,
      windowMs: 10000,
    });

    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(3);
  });

  it('getStatus uses redis and handles errors by failing open', async () => {
    const rawClient = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(4),
      del: jest.fn(),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    const ok = await service.getStatus('u2', {
      maxRequests: 5,
      windowMs: 1000,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.remaining).toBe(1);

    rawClient.zcard.mockRejectedValue(new Error('status fail'));
    const fallback = await service.getStatus('u2', {
      maxRequests: 5,
      windowMs: 1000,
    });
    expect(fallback.allowed).toBe(true);
    expect(fallback.remaining).toBe(5);
  });

  it('reset clears fallback entry or redis key', async () => {
    redisClientMock.getClient.mockReturnValue(null);
    (service as any).inMemoryLimits.set('u3', { timestamps: [Date.now()] });

    await service.reset('u3');
    expect((service as any).inMemoryLimits.has('u3')).toBe(false);

    const rawClient = {
      del: jest.fn().mockResolvedValue(1),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    await service.reset('u4');
    expect(rawClient.del).toHaveBeenCalledWith('jw:ratelimit:u4');
  });

  it('createLLMRateLimiter uses default and custom values', () => {
    expect(service.createLLMRateLimiter()).toEqual({
      maxRequests: 60,
      windowMs: 60000,
    });
    expect(service.createLLMRateLimiter(120)).toEqual({
      maxRequests: 120,
      windowMs: 60000,
    });
  });
});

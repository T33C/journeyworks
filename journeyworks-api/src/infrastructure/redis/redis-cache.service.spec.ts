/* eslint-disable @typescript-eslint/no-explicit-any */

import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let redisClientMock: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    getClient: jest.Mock;
  };
  let configServiceMock: { get: jest.Mock };

  beforeEach(() => {
    redisClientMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getClient: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue(120),
    };

    service = new RedisCacheService(
      redisClientMock as any,
      configServiceMock as any,
    );
  });

  it('get returns parsed JSON value from prefixed key', async () => {
    redisClientMock.get.mockResolvedValue('{"ok":true}');

    const result = await service.get<{ ok: boolean }>('user:1');

    expect(redisClientMock.get).toHaveBeenCalledWith('jw:cache:user:1');
    expect(result).toEqual({ ok: true });
  });

  it('get returns null on cache miss or parsing error', async () => {
    redisClientMock.get.mockResolvedValue(null);
    await expect(service.get('miss')).resolves.toBeNull();

    redisClientMock.get.mockResolvedValue('not-json');
    await expect(service.get('bad')).resolves.toBeNull();
  });

  it('set writes stringified payload with default TTL', async () => {
    await service.set('k1', { v: 1 });

    expect(redisClientMock.set).toHaveBeenCalledWith(
      'jw:cache:k1',
      JSON.stringify({ v: 1 }),
      120,
    );
  });

  it('set uses explicit TTL when provided', async () => {
    await service.set('k2', { v: 2 }, 9);

    expect(redisClientMock.set).toHaveBeenCalledWith(
      'jw:cache:k2',
      JSON.stringify({ v: 2 }),
      9,
    );
  });

  it('delete removes prefixed key and swallows errors', async () => {
    await service.delete('k3');
    expect(redisClientMock.del).toHaveBeenCalledWith('jw:cache:k3');

    redisClientMock.del.mockRejectedValue(new Error('fail'));
    await expect(service.delete('k3')).resolves.toBeUndefined();
  });

  it('deletePattern returns zero when redis client unavailable', async () => {
    redisClientMock.getClient.mockReturnValue(null);

    const count = await service.deletePattern('research:*');

    expect(count).toBe(0);
  });

  it('deletePattern deletes matching keys and returns deleted count', async () => {
    const rawClient = {
      keys: jest.fn().mockResolvedValue(['jw:cache:a', 'jw:cache:b']),
      del: jest.fn().mockResolvedValue(2),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    const count = await service.deletePattern('a*');

    expect(rawClient.keys).toHaveBeenCalledWith('jw:cache:a*');
    expect(rawClient.del).toHaveBeenCalledWith('jw:cache:a', 'jw:cache:b');
    expect(count).toBe(2);
  });

  it('getOrSet returns cached value and skips factory when present', async () => {
    redisClientMock.get.mockResolvedValue('{"n":7}');
    const factory = jest.fn().mockResolvedValue({ n: 8 });

    const value = await service.getOrSet('n', factory);

    expect(value).toEqual({ n: 7 });
    expect(factory).not.toHaveBeenCalled();
  });

  it('getOrSet evaluates factory and caches value when missing', async () => {
    redisClientMock.get.mockResolvedValue(null);
    const factory = jest.fn().mockResolvedValue({ n: 8 });

    const value = await service.getOrSet('n2', factory, 55);

    expect(value).toEqual({ n: 8 });
    expect(redisClientMock.set).toHaveBeenCalledWith(
      'jw:cache:n2',
      JSON.stringify({ n: 8 }),
      55,
    );
  });

  it('exists/getTtl/increment handle success and failure paths', async () => {
    const rawClient = {
      exists: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(99),
      incrby: jest.fn().mockResolvedValue(5),
    };
    redisClientMock.getClient.mockReturnValue(rawClient);

    await expect(service.exists('counter')).resolves.toBe(true);
    await expect(service.getTtl('counter')).resolves.toBe(99);
    await expect(service.increment('counter', 5)).resolves.toBe(5);

    redisClientMock.getClient.mockReturnValue({
      exists: jest.fn().mockRejectedValue(new Error('e1')),
      ttl: jest.fn().mockRejectedValue(new Error('e2')),
      incrby: jest.fn().mockRejectedValue(new Error('e3')),
    });

    await expect(service.exists('counter')).resolves.toBe(false);
    await expect(service.getTtl('counter')).resolves.toBe(-1);
    await expect(service.increment('counter')).resolves.toBe(0);
  });

  it('createKey joins key parts with colons', () => {
    expect(service.createKey('a', 1, 'b')).toBe('a:1:b');
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */

import { RedisClientService } from './redis-client.service';

const mockConnect = jest.fn();
const mockPing = jest.fn();
const mockQuit = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockSetex = jest.fn();
const mockDel = jest.fn();
const mockOn = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    quit: mockQuit,
    get: mockGet,
    set: mockSet,
    setex: mockSetex,
    del: mockDel,
    on: mockOn,
    status: 'ready',
  })),
}));

describe('RedisClientService', () => {
  let service: RedisClientService;
  let configServiceMock: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'redis.url') return 'redis://localhost:6379';
        if (key === 'redis.password') return 'secret';
        if (key === 'redis.optional') return true;
        return undefined;
      }),
    };

    mockConnect.mockResolvedValue(undefined);
    mockPing.mockResolvedValue('PONG');
    mockQuit.mockResolvedValue('OK');
    mockOn.mockImplementation(() => undefined);

    service = new RedisClientService(configServiceMock as any);
  });

  it('onModuleInit connects successfully and marks redis available', async () => {
    await service.onModuleInit();

    expect(service.isConnected()).toBe(true);
    expect(service.isUsingFallback()).toBe(false);
    expect(service.getClient()).toBeTruthy();
  });

  it('onModuleInit falls back to in-memory when optional and connection fails', async () => {
    mockConnect.mockRejectedValue(new Error('connect failed'));

    await service.onModuleInit();

    expect(service.isConnected()).toBe(false);
    expect(service.isUsingFallback()).toBe(true);
    expect(service.getClient()).toBeNull();
  });

  it('onModuleInit throws when non-optional and connection fails', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'redis.url') return 'redis://localhost:6379';
      if (key === 'redis.optional') return false;
      return undefined;
    });
    mockConnect.mockRejectedValue(new Error('hard fail'));

    await expect(service.onModuleInit()).rejects.toThrow('hard fail');
  });

  it('onModuleDestroy quits client when available', async () => {
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalled();
  });

  it('onModuleDestroy swallows quit errors', async () => {
    await service.onModuleInit();
    mockQuit.mockRejectedValue(new Error('quit failed'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('uses in-memory fallback for get/set/del when redis unavailable', async () => {
    mockConnect.mockRejectedValue(new Error('down'));
    await service.onModuleInit();

    await service.set('k1', 'v1');
    await expect(service.get('k1')).resolves.toBe('v1');

    await service.del('k1');
    await expect(service.get('k1')).resolves.toBeNull();
  });

  it('expires in-memory values when ttl has passed', async () => {
    (service as any).isRedisAvailable = false;
    (service as any).inMemoryCache.set('exp', {
      value: 'v',
      expiry: Date.now() - 1,
    });

    const value = await service.get('exp');

    expect(value).toBeNull();
  });

  it('uses redis client operations for get/set/setex/del when available', async () => {
    await service.onModuleInit();

    mockGet.mockResolvedValue('value1');
    await expect(service.get('rk')).resolves.toBe('value1');

    await service.set('rk', 'v2');
    await service.set('rk', 'v3', 30);
    await service.del('rk');

    expect(mockSet).toHaveBeenCalledWith('rk', 'v2');
    expect(mockSetex).toHaveBeenCalledWith('rk', 30, 'v3');
    expect(mockDel).toHaveBeenCalledWith('rk');
  });

  it('getHealth reports degraded in fallback mode', async () => {
    mockConnect.mockRejectedValue(new Error('down'));
    await service.onModuleInit();

    const health = await service.getHealth();

    expect(health).toEqual({ status: 'degraded', mode: 'in-memory' });
  });

  it('getHealth reports healthy with latency when redis ping succeeds', async () => {
    await service.onModuleInit();
    mockPing.mockResolvedValue('PONG');

    const health = await service.getHealth();

    expect(health.status).toBe('healthy');
    expect(health.mode).toBe('redis');
    expect(typeof health.latencyMs).toBe('number');
  });

  it('getHealth reports unhealthy when redis ping throws', async () => {
    await service.onModuleInit();
    mockPing.mockRejectedValue(new Error('ping fail'));

    const health = await service.getHealth();

    expect(health).toEqual(
      expect.objectContaining({
        status: 'unhealthy',
        mode: 'redis',
        error: 'ping fail',
      }),
    );
  });
});

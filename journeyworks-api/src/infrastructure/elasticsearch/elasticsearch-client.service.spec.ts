/* eslint-disable @typescript-eslint/no-explicit-any */

import { ElasticsearchClientService } from './elasticsearch-client.service';

const mockClose = jest.fn();
const mockInfo = jest.fn();

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    info: mockInfo,
    close: mockClose,
  })),
}));

describe('ElasticsearchClientService', () => {
  let service: ElasticsearchClientService;
  let configServiceMock: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'elasticsearch.url') return 'http://localhost:9200';
        if (key === 'elasticsearch.username') return 'elastic';
        if (key === 'elasticsearch.password') return 'secret';
        if (key === 'elasticsearch.optional') return true;
        if (key === 'elasticsearch.indices')
          return { communications: 'journeyworks_communications' };
        return undefined;
      }),
    };

    service = new ElasticsearchClientService(configServiceMock as any);
  });

  it('onModuleInit connects successfully and marks availability', async () => {
    mockInfo.mockResolvedValue({ cluster_name: 'jw-cluster' });

    await service.onModuleInit();

    expect(service.isElasticsearchAvailable()).toBe(true);
    expect(service.getClient()).toBeTruthy();
    expect(service.getHealth()).toEqual({
      available: true,
      mode: 'connected',
    });
  });

  it('onModuleInit falls back when optional and connection fails', async () => {
    mockInfo.mockRejectedValue(new Error('connection refused'));

    await service.onModuleInit();

    expect(service.isElasticsearchAvailable()).toBe(false);
    expect(service.getClient()).toBeNull();
    expect(service.getHealth().mode).toBe('unavailable');
  });

  it('onModuleInit throws when non-optional and connection fails', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'elasticsearch.url') return 'http://localhost:9200';
      if (key === 'elasticsearch.optional') return false;
      return undefined;
    });
    mockInfo.mockRejectedValue(new Error('hard fail'));

    await expect(service.onModuleInit()).rejects.toThrow('hard fail');
  });

  it('getClientOrThrow throws when unavailable', () => {
    expect(() => service.getClientOrThrow()).toThrow(
      'Elasticsearch is not available',
    );
  });

  it('getIndexName resolves configured index key and falls back to key', () => {
    expect(service.getIndexName('communications')).toBe(
      'journeyworks_communications',
    );
    expect(service.getIndexName('unknown_index')).toBe('unknown_index');
  });

  it('onModuleDestroy closes client when initialized', async () => {
    mockInfo.mockResolvedValue({ cluster_name: 'jw' });
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(mockClose).toHaveBeenCalled();
  });
});

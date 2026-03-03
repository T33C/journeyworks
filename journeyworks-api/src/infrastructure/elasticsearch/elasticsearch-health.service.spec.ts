/* eslint-disable @typescript-eslint/no-explicit-any */

import { ElasticsearchHealthService } from './elasticsearch-health.service';

describe('ElasticsearchHealthService', () => {
  let service: ElasticsearchHealthService;
  let esClientMock: { getClient: jest.Mock };
  let configServiceMock: { get: jest.Mock };

  beforeEach(() => {
    esClientMock = {
      getClient: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({
        communications: 'journeyworks_communications',
        events: 'journeyworks_events',
      }),
    };

    service = new ElasticsearchHealthService(
      esClientMock as any,
      configServiceMock as any,
    );
  });

  it('getHealth returns cluster + index status with mapped health level', async () => {
    const client = {
      cluster: {
        health: jest.fn().mockResolvedValue({
          status: 'yellow',
          cluster_name: 'jw',
          number_of_nodes: 2,
        }),
      },
      indices: {
        exists: jest
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false),
      },
      count: jest.fn().mockResolvedValue({ count: 42 }),
    };
    esClientMock.getClient.mockReturnValue(client);

    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.clusterName).toBe('jw');
    expect(result.numberOfNodes).toBe(2);
    expect(result.indices).toEqual({
      communications: { exists: true, docCount: 42 },
      events: { exists: false, docCount: 0 },
    });
  });

  it('getHealth returns unhealthy on thrown error', async () => {
    esClientMock.getClient.mockReturnValue({
      cluster: { health: jest.fn().mockRejectedValue(new Error('down')) },
    });

    const result = await service.getHealth();

    expect(result.status).toBe('unhealthy');
    expect(result.error).toBe('down');
  });

  it('initializeIndices iterates configured indices', async () => {
    const spy = jest
      .spyOn(service, 'createIndexIfNotExists')
      .mockResolvedValue(false);

    await service.initializeIndices();

    expect(spy).toHaveBeenCalledWith(
      'journeyworks_communications',
      'communications',
    );
    expect(spy).toHaveBeenCalledWith('journeyworks_events', 'events');
  });

  it('createIndexIfNotExists creates index with mapping when key is known', async () => {
    const client = {
      indices: {
        exists: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({ acknowledged: true }),
      },
    };
    esClientMock.getClient.mockReturnValue(client);

    const created = await service.createIndexIfNotExists(
      'journeyworks_communications',
      'communications',
    );

    expect(created).toBe(true);
    expect(client.indices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'journeyworks_communications',
        body: expect.any(Object),
      }),
    );
  });

  it('createIndexIfNotExists creates index without mapping for unknown key', async () => {
    const client = {
      indices: {
        exists: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({ acknowledged: true }),
      },
    };
    esClientMock.getClient.mockReturnValue(client);

    const created = await service.createIndexIfNotExists(
      'custom-index',
      'unknown_key',
    );

    expect(created).toBe(true);
    expect(client.indices.create).toHaveBeenCalledWith({
      index: 'custom-index',
    });
  });

  it('createIndexIfNotExists returns false when index already exists', async () => {
    const client = {
      indices: {
        exists: jest.fn().mockResolvedValue(true),
        create: jest.fn(),
      },
    };
    esClientMock.getClient.mockReturnValue(client);

    const created = await service.createIndexIfNotExists(
      'already-there',
      'events',
    );

    expect(created).toBe(false);
    expect(client.indices.create).not.toHaveBeenCalled();
  });

  it('deleteIndex removes existing index and ignores missing index', async () => {
    const client = {
      indices: {
        exists: jest
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false),
        delete: jest.fn().mockResolvedValue({ acknowledged: true }),
        refresh: jest.fn().mockResolvedValue({}),
      },
    };
    esClientMock.getClient.mockReturnValue(client);

    await service.deleteIndex('to-delete');
    await service.deleteIndex('not-found');

    expect(client.indices.delete).toHaveBeenCalledTimes(1);
    expect(client.indices.delete).toHaveBeenCalledWith({ index: 'to-delete' });
  });

  it('refreshIndex delegates to ES client', async () => {
    const client = {
      indices: {
        refresh: jest.fn().mockResolvedValue({}),
      },
    };
    esClientMock.getClient.mockReturnValue(client);

    await service.refreshIndex('idx-1');

    expect(client.indices.refresh).toHaveBeenCalledWith({ index: 'idx-1' });
  });
});

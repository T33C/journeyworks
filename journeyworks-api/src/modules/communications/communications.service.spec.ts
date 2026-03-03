/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { CommunicationsService } from './communications.service';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('CommunicationsService', () => {
  let service: CommunicationsService;
  let repositoryMock: {
    bulkIndex: jest.Mock;
    updateById: jest.Mock;
    findById: jest.Mock;
    searchCommunications: jest.Mock;
  };
  let cacheMock: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    repositoryMock = {
      bulkIndex: jest.fn(),
      updateById: jest.fn(),
      findById: jest.fn(),
      searchCommunications: jest.fn(),
    };

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    service = new CommunicationsService(
      repositoryMock as any,
      {} as any,
      {} as any,
      cacheMock as any,
    );
  });

  it('createBulk maps topics and returns repository counts', async () => {
    repositoryMock.bulkIndex.mockResolvedValue({ created: 2, failed: 0 });

    const result = await service.createBulk([
      {
        channel: 'email',
        direction: 'inbound',
        customerId: 'cust-1',
        content: 'help me',
        topics: ['CDD Reviews'],
      },
      {
        channel: 'phone',
        direction: 'outbound',
        customerId: 'cust-2',
        content: 'follow up',
        topics: ['Wait Times'],
      },
    ] as any);

    expect(repositoryMock.bulkIndex).toHaveBeenCalled();
    const docs = repositoryMock.bulkIndex.mock.calls[0][0];
    expect(docs).toHaveLength(2);
    expect(docs[0].topics).toEqual(['CDD Reviews']);
    expect(docs[1].topics).toEqual(['Wait Times']);
    expect(docs[0].status).toBe('open');
    expect(result).toEqual({ created: 2, failed: 0 });
  });

  it('assignTo updates metadata and invalidates cache', async () => {
    cacheMock.get.mockResolvedValue(undefined);

    repositoryMock.findById
      .mockResolvedValueOnce({
        id: 'comm-1',
        channel: 'email',
        direction: 'inbound',
        customerId: 'cust-1',
        content: 'hello',
        timestamp: '2026-01-01T00:00:00.000Z',
        status: 'open',
        metadata: { existing: true },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'comm-1',
        channel: 'email',
        direction: 'inbound',
        customerId: 'cust-1',
        content: 'hello',
        timestamp: '2026-01-01T00:00:00.000Z',
        status: 'open',
        metadata: { existing: true, assignedTo: 'user-7' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

    const result = await service.assignTo('comm-1', 'user-7');

    expect(repositoryMock.updateById).toHaveBeenCalledWith(
      'comm-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          existing: true,
          assignedTo: 'user-7',
        }),
      }),
    );
    expect(cacheMock.delete).toHaveBeenCalledWith('comm:comm-1');
    expect(result.id).toBe('comm-1');
  });

  it('search uses timestamp desc default sort and maps hasMore', async () => {
    repositoryMock.searchCommunications.mockResolvedValue({
      hits: [
        {
          source: {
            id: 'c1',
            channel: 'email',
            direction: 'inbound',
            customerId: 'cust-1',
            content: 'x',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'open',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          score: 1.2,
          highlight: { content: ['<mark>x</mark>'] },
        },
      ],
      total: 25,
    });

    const result = await service.search({ query: 'x' } as any);

    expect(repositoryMock.searchCommunications).toHaveBeenCalledWith(
      'x',
      expect.any(Object),
      { from: 0, size: 20, sort: [{ timestamp: 'desc' }] },
    );
    expect(result.total).toBe(25);
    expect(result.hasMore).toBe(true);
    expect(result.items[0].score).toBe(1.2);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CommunicationsController } from './communications.controller';

describe('CommunicationsController', () => {
  let controller: CommunicationsController;
  let serviceMock: {
    create: jest.Mock;
    createBulk: jest.Mock;
    search: jest.Mock;
    semanticSearch: jest.Mock;
    getAggregations: jest.Mock;
    getRecent: jest.Mock;
    getStats: jest.Mock;
    getByCustomer: jest.Mock;
    getByCase: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    assignTo: jest.Mock;
    delete: jest.Mock;
    analyzeContent: jest.Mock;
    generateEmbedding: jest.Mock;
    bulkGenerateEmbeddings: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      create: jest.fn(),
      createBulk: jest.fn(),
      search: jest.fn(),
      semanticSearch: jest.fn(),
      getAggregations: jest.fn(),
      getRecent: jest.fn(),
      getStats: jest.fn(),
      getByCustomer: jest.fn(),
      getByCase: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      assignTo: jest.fn(),
      delete: jest.fn(),
      analyzeContent: jest.fn(),
      generateEmbedding: jest.fn(),
      bulkGenerateEmbeddings: jest.fn(),
    };

    controller = new CommunicationsController(serviceMock as any);
  });

  it('delegates create and returns service response', async () => {
    const dto = { customerId: 'cust-1', content: 'hi' } as any;
    serviceMock.create.mockResolvedValue({ id: 'c1' });

    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'c1' });
  });

  it('applies default limit=20 for getRecent when undefined', async () => {
    serviceMock.getRecent.mockResolvedValue({ items: [] });

    await controller.getRecent(undefined, 'email', 'negative');

    expect(serviceMock.getRecent).toHaveBeenCalledWith(20, 'email', 'negative');
  });

  it('passes explicit limit through for getRecent', async () => {
    serviceMock.getRecent.mockResolvedValue({ items: [] });

    await controller.getRecent(5, 'phone', 'neutral');

    expect(serviceMock.getRecent).toHaveBeenCalledWith(5, 'phone', 'neutral');
  });

  it('maps status update payload to service call', async () => {
    serviceMock.updateStatus.mockResolvedValue({
      id: 'c1',
      status: 'resolved',
    });

    await controller.updateStatus('c1', {
      status: 'resolved',
      note: 'done',
    } as any);

    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      'c1',
      'resolved',
      'done',
    );
  });

  it('maps assign payload to assignTo service call', async () => {
    serviceMock.assignTo.mockResolvedValue({ id: 'c1' });

    await controller.assignTo('c1', { userId: 'user-1' } as any);

    expect(serviceMock.assignTo).toHaveBeenCalledWith('c1', 'user-1');
  });

  it('generateEmbedding returns success true after service call', async () => {
    serviceMock.generateEmbedding.mockResolvedValue(undefined);

    const result = await controller.generateEmbedding('c1');

    expect(serviceMock.generateEmbedding).toHaveBeenCalledWith('c1');
    expect(result).toEqual({ success: true });
  });

  it('bulkGenerateEmbeddings forwards ids and limit', async () => {
    serviceMock.bulkGenerateEmbeddings.mockResolvedValue({ processed: 2 });

    const result = await controller.bulkGenerateEmbeddings({
      ids: ['a', 'b'],
      limit: 10,
    });

    expect(serviceMock.bulkGenerateEmbeddings).toHaveBeenCalledWith(
      ['a', 'b'],
      10,
    );
    expect(result).toEqual({ processed: 2 });
  });
});

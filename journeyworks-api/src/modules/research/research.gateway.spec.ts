/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { ResearchGateway } from './research.gateway';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('ResearchGateway', () => {
  let gateway: ResearchGateway;
  let agentExecutorMock: { executeStreaming: jest.Mock };
  let researchServiceMock: {
    getConversation: jest.Mock;
    addConversationTurn: jest.Mock;
    getCachedFollowUpResponse: jest.Mock;
    cacheFollowUpResponse: jest.Mock;
    formatAnalysisContext: jest.Mock;
    getFollowUpContextSignature: jest.Mock;
    getFollowUpCacheKeys: jest.Mock;
  };

  const createClient = (id = 'socket-1') => ({
    id,
    emit: jest.fn(),
  });

  beforeEach(() => {
    agentExecutorMock = {
      executeStreaming: jest.fn(),
    };

    researchServiceMock = {
      getConversation: jest.fn().mockResolvedValue([]),
      addConversationTurn: jest.fn().mockResolvedValue(undefined),
      getCachedFollowUpResponse: jest.fn().mockResolvedValue(null),
      cacheFollowUpResponse: jest.fn().mockResolvedValue(undefined),
      formatAnalysisContext: jest
        .fn()
        .mockImplementation((ctx: any) => `Product: ${ctx.product}`),
      getFollowUpContextSignature: jest
        .fn()
        .mockReturnValue('{"product":"credit-card"}'),
      getFollowUpCacheKeys: jest.fn().mockReturnValue({
        conversationKey: 'research:followup:sess:query:::',
        sharedKey: 'research:followup:shared:query:::',
      }),
    };

    gateway = new ResearchGateway(
      agentExecutorMock as any,
      researchServiceMock as any,
    );
  });

  it('handleConnection emits connected event', () => {
    const client = createClient('sock-a');

    gateway.handleConnection(client as any);

    expect(client.emit).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({
        type: 'connected',
        sessionId: 'sock-a',
      }),
    );
  });

  it('handleDisconnect aborts active session and removes tracking', () => {
    const client = createClient('sock-b');
    (gateway as any).activeResearch.set('sock-b', { aborted: false });

    gateway.handleDisconnect(client as any);

    expect((gateway as any).activeResearch.has('sock-b')).toBe(false);
  });

  it('handleCancel marks active session as aborted', () => {
    const client = createClient('sock-c');
    const session = { aborted: false };
    (gateway as any).activeResearch.set('sock-c', session);

    gateway.handleCancel(client as any);

    expect(session.aborted).toBe(true);
  });

  it('handleResearch validates empty query and emits validation error', async () => {
    const client = createClient('sock-d');

    await gateway.handleResearch(
      { query: '   ', sessionId: 'sess-1' } as any,
      client as any,
    );

    expect(client.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Query is required',
      }),
    );
    expect(agentExecutorMock.executeStreaming).not.toHaveBeenCalled();
  });

  it('handleResearch executes streaming, emits events, and stores conversation turn', async () => {
    const client = createClient('sock-e');
    agentExecutorMock.executeStreaming.mockImplementation(
      async (
        _request: any,
        _sessionId: string,
        onEvent: (event: any) => void,
      ) => {
        onEvent({ type: 'thinking', step: 1 });
        return { answer: 'Final answer' };
      },
    );

    await gateway.handleResearch(
      {
        query: 'What changed?',
        sessionId: 'sess-2',
        customerId: 'cust-1',
        maxIterations: 4,
        context: {
          product: 'credit-card',
          channel: 'email',
          timeWindow: { start: '2026-01-01', end: '2026-01-31' },
        },
      } as any,
      client as any,
    );

    expect(researchServiceMock.getConversation).toHaveBeenCalledWith('sess-2');
    expect(researchServiceMock.getCachedFollowUpResponse).toHaveBeenCalledWith(
      'sess-2',
      'What changed?',
      expect.objectContaining({
        customerId: 'cust-1',
        maxIterations: 4,
      }),
    );
    expect(agentExecutorMock.executeStreaming).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'What changed?',
        customerId: 'cust-1',
        maxIterations: 4,
      }),
      'sess-2',
      expect.any(Function),
    );

    const sentRequest = agentExecutorMock.executeStreaming.mock.calls[0][0];
    expect(sentRequest.context).toContain('Product: credit-card');

    expect(client.emit).toHaveBeenCalledWith(
      'thinking',
      expect.objectContaining({ type: 'thinking', step: 1 }),
    );
    expect(researchServiceMock.cacheFollowUpResponse).toHaveBeenCalledWith(
      'sess-2',
      'What changed?',
      { answer: 'Final answer' },
      expect.objectContaining({
        customerId: 'cust-1',
        maxIterations: 4,
      }),
    );
    expect(researchServiceMock.addConversationTurn).toHaveBeenCalledWith(
      'sess-2',
      'What changed?',
      { answer: 'Final answer' },
    );
    expect((gateway as any).activeResearch.has('sock-e')).toBe(false);
  });

  it('handleResearch emits execution error when streaming fails', async () => {
    const client = createClient('sock-f');
    agentExecutorMock.executeStreaming.mockRejectedValue(new Error('boom'));

    await gateway.handleResearch(
      { query: 'Q?', sessionId: 'sess-3' } as any,
      client as any,
    );

    expect(client.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        code: 'EXECUTION_ERROR',
        message: 'boom',
      }),
    );
    expect((gateway as any).activeResearch.has('sock-f')).toBe(false);
  });

  it('handleResearch emits cached complete response and skips streaming', async () => {
    const client = createClient('sock-g');
    researchServiceMock.getCachedFollowUpResponse.mockResolvedValue({
      answer: 'From cache',
      confidence: 0.9,
      sources: [],
      reasoning: [],
      actions: [],
      stats: { totalTime: 1, iterations: 0, toolCalls: 0 },
    });

    await gateway.handleResearch(
      { query: 'Repeat?', sessionId: 'sess-cache' } as any,
      client as any,
    );

    expect(agentExecutorMock.executeStreaming).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({
        type: 'complete',
        sessionId: 'sess-cache',
        response: expect.objectContaining({ answer: 'From cache' }),
      }),
    );
    expect(researchServiceMock.addConversationTurn).toHaveBeenCalledWith(
      'sess-cache',
      'Repeat?',
      expect.objectContaining({ answer: 'From cache' }),
    );
  });

  it('uses research service formatter for context string generation', async () => {
    const client = createClient('sock-h');
    agentExecutorMock.executeStreaming.mockResolvedValue({ answer: 'ok' });

    await gateway.handleResearch(
      {
        query: 'context test',
        sessionId: 'sess-ctx',
        context: { product: 'cards' },
      } as any,
      client as any,
    );

    expect(researchServiceMock.formatAnalysisContext).toHaveBeenCalledWith({
      product: 'cards',
    });
  });
});

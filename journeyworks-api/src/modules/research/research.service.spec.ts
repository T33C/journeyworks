/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { ResearchService } from './research.service';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('ResearchService', () => {
  let service: ResearchService;
  let agentExecutorMock: { execute: jest.Mock };
  let agentToolsMock: { getTools: jest.Mock };
  let cacheMock: { get: jest.Mock; set: jest.Mock; delete: jest.Mock };
  let llmClientMock: {
    getProviderStatus: jest.Mock;
    parallelPrompt: jest.Mock;
    prompt: jest.Mock;
  };
  let insightDataMock: { getInsightData: jest.Mock };
  let analysisClientMock: {
    isAvailable: jest.Mock;
    generateDataCard: jest.Mock;
  };
  let ragServiceMock: { query: jest.Mock };

  beforeEach(() => {
    agentExecutorMock = {
      execute: jest.fn(),
    };

    agentToolsMock = {
      getTools: jest.fn(),
    };

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    llmClientMock = {
      getProviderStatus: jest
        .fn()
        .mockReturnValue({ anthropic: false, openai: false }),
      parallelPrompt: jest.fn(),
      prompt: jest.fn(),
    };

    insightDataMock = {
      getInsightData: jest.fn().mockResolvedValue({
        communications: [],
        socialMentions: [],
        timeSeries: [],
        resolutionJourney: [],
        eventCorrelations: [],
        summary: {
          totalCommunications: 0,
          totalSocialMentions: 0,
          avgSentiment: 0,
          avgNps: 0,
          promoterPct: 0,
          passivePct: 0,
          detractorPct: 0,
          topThemes: [],
          topProducts: [],
        },
      }),
    };

    analysisClientMock = {
      isAvailable: jest.fn().mockReturnValue(false),
      generateDataCard: jest.fn(),
    };

    ragServiceMock = {
      query: jest.fn(),
    };

    service = new ResearchService(
      agentExecutorMock as any,
      agentToolsMock as any,
      cacheMock as any,
      llmClientMock as any,
      insightDataMock as any,
      analysisClientMock as any,
      ragServiceMock as any,
    );
  });

  it('returns available tools as name/description pairs', () => {
    agentToolsMock.getTools.mockReturnValue([
      { name: 'search_knowledge_base', description: 'Search docs' },
      { name: 'detect_issues', description: 'Detect recurring issues' },
    ]);

    const tools = service.getAvailableTools();

    expect(tools).toEqual([
      { name: 'search_knowledge_base', description: 'Search docs' },
      { name: 'detect_issues', description: 'Detect recurring issues' },
    ]);
  });

  it('quickQuestion routes to research with maxIterations=3', async () => {
    agentExecutorMock.execute.mockResolvedValue({
      answer: 'Quick answer',
      confidence: 0.8,
      sources: [],
      reasoning: [],
      actions: [],
      stats: { totalTime: 10, iterations: 1, toolCalls: 1 },
    });

    const result = await service.quickQuestion('What happened?', 'cust_99');

    expect(agentExecutorMock.execute).toHaveBeenCalledWith({
      query: 'What happened?',
      customerId: 'cust_99',
      maxIterations: 3,
    });
    expect(result.answer).toBe('Quick answer');
    expect(result.confidence).toBe(0.8);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('researchWithContext persists trimmed conversation history', async () => {
    const existingHistory = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index + 1}`,
      timestamp: new Date(2026, 0, 1, 0, index).toISOString(),
    }));

    cacheMock.get
      .mockResolvedValueOnce(existingHistory)
      .mockResolvedValueOnce(null);

    agentExecutorMock.execute.mockResolvedValue({
      answer: 'Contextual answer',
      confidence: 0.9,
      sources: [],
      reasoning: [],
      actions: [],
      stats: { totalTime: 10, iterations: 1, toolCalls: 1 },
    });

    await service.researchWithContext('conv-1', 'new question');

    expect(agentExecutorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'new question',
        conversationHistory: existingHistory,
      }),
    );

    expect(cacheMock.set).toHaveBeenCalled();
    const conversationSetCall = cacheMock.set.mock.calls.find(
      ([cacheKey]) => cacheKey === 'research:conversation:conv-1',
    );
    expect(conversationSetCall).toBeDefined();
    const [, savedHistory, ttl] = conversationSetCall!;
    expect(ttl).toBe(3600);
    expect(savedHistory).toHaveLength(20);
    expect(savedHistory[0].content).toBe('turn-3');
    expect(savedHistory[19].content).toBe('Contextual answer');
  });

  it('researchWithContext returns cached follow-up response when available', async () => {
    const cachedResponse = {
      answer: 'Cached follow-up answer',
      confidence: 0.95,
      sources: [],
      reasoning: [],
      actions: [],
      stats: { totalTime: 1, iterations: 0, toolCalls: 0 },
    };

    cacheMock.get
      .mockResolvedValueOnce([]) // conversation history
      .mockResolvedValueOnce(cachedResponse); // follow-up response cache

    const result = await service.researchWithContext(
      'conv-cache',
      'repeat question',
    );

    expect(result).toEqual(cachedResponse);
    expect(agentExecutorMock.execute).not.toHaveBeenCalled();
    expect(cacheMock.set).toHaveBeenCalledWith(
      'research:conversation:conv-cache',
      expect.any(Array),
      3600,
    );
  });

  it('researchWithContext falls back to shared follow-up cache across conversations', async () => {
    const cachedResponse = {
      answer: 'Shared cached follow-up answer',
      confidence: 0.91,
      sources: [],
      reasoning: [],
      actions: [],
      stats: { totalTime: 2, iterations: 0, toolCalls: 0 },
    };

    cacheMock.get
      .mockResolvedValueOnce([]) // conversation history
      .mockResolvedValueOnce(null) // conversation-scoped follow-up cache miss
      .mockResolvedValueOnce(cachedResponse); // shared follow-up cache hit

    const result = await service.researchWithContext(
      'conv-new-session',
      'repeat question',
    );

    expect(result).toEqual(cachedResponse);
    expect(agentExecutorMock.execute).not.toHaveBeenCalled();
    expect(cacheMock.set).toHaveBeenCalledWith(
      expect.stringContaining('research:followup:conv-new-session:'),
      cachedResponse,
      3600,
    );
    expect(cacheMock.set).toHaveBeenCalledWith(
      'research:conversation:conv-new-session',
      expect.any(Array),
      3600,
    );
  });

  it('researchCustomer asks each question with customer-scoped maxIterations=5', async () => {
    agentExecutorMock.execute
      .mockResolvedValueOnce({ answer: 'A1' })
      .mockResolvedValueOnce({ answer: 'A2' });

    const result = await service.researchCustomer('cust-77', ['Q1', 'Q2']);

    expect(agentExecutorMock.execute).toHaveBeenNthCalledWith(1, {
      query: 'Q1',
      customerId: 'cust-77',
      maxIterations: 5,
    });
    expect(agentExecutorMock.execute).toHaveBeenNthCalledWith(2, {
      query: 'Q2',
      customerId: 'cust-77',
      maxIterations: 5,
    });
    expect(result).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);
  });

  it('clearConversation deletes cache key with expected prefix', async () => {
    await service.clearConversation('conv-xyz');

    expect(cacheMock.delete).toHaveBeenCalledWith(
      'research:conversation:conv-xyz',
    );
  });

  it('getInsight returns cached insight when available', async () => {
    const cachedInsight = {
      summary: 'cached',
      confidence: 'high',
      keyDrivers: [],
      evidence: [],
      timelineReasoning: '',
      suggestedActions: [],
    };
    cacheMock.get.mockResolvedValue(cachedInsight);

    const result = await service.getInsight({
      context: { product: 'cards' },
      useCache: true,
    } as any);

    expect(result).toEqual(cachedInsight);
    expect(insightDataMock.getInsightData).not.toHaveBeenCalled();
  });

  it('getInsight takes RAG path and caches result when question is RAG-like', async () => {
    cacheMock.get.mockResolvedValue(null);
    const ragInsight = {
      summary: 'rag insight',
      confidence: 'medium',
      keyDrivers: [],
      evidence: [],
      timelineReasoning: 't',
      suggestedActions: [],
      suggestedQuestions: [],
      totalCommunications: 1,
    };
    jest.spyOn(service as any, 'performRagQuery').mockResolvedValue(ragInsight);

    const result = await service.getInsight({
      context: { product: 'cards' },
      question: 'show me examples of payment complaints',
    } as any);

    expect(result.summary).toBe('rag insight');
    expect(cacheMock.set).toHaveBeenCalledWith(
      expect.stringContaining('insight:product:cards'),
      ragInsight,
      3600,
    );
  });

  it('buildContextDescription returns general text when no context provided', () => {
    const description = (service as any).buildContextDescription({});
    expect(description).toBe('General overview - no specific selection');
  });

  it('buildContextDescription includes event and bubble details when present', () => {
    const description = (service as any).buildContextDescription({
      event: {
        id: 'payments-outage-1',
        type: 'outage',
        date: '2026-01-03',
        severity: 'high',
        description: 'Payments outage',
      },
      selectedBubble: {
        id: 'bubble-1',
        date: '2026-01-03',
        themes: ['payment', 'outage'],
        sentiment: -0.8,
        npsScore: -58,
      },
      timeWindow: { start: '2026-01-01', end: '2026-01-07' },
    } as any);

    expect(description).toContain('Selected Event: outage');
    expect(description).toContain('Selected Timeline Bubble: bubble-1');
    expect(description).toContain('Estimated NPS Score: -58');
    expect(description).toContain('Time Window: 2026-01-01 to 2026-01-07');
  });

  it('determineContextType resolves event and topic contexts', () => {
    expect(
      (service as any).determineContextType({
        event: { id: 'payments-outage-main' },
      }),
    ).toBe('payments-outage');

    expect(
      (service as any).determineContextType({
        selectedItems: ['overdraft fees'],
      }),
    ).toBe('topic-overdraft-fees');
  });

  it('buildInsightCacheKey prioritizes event and appends time window', () => {
    const key = (service as any).buildInsightCacheKey({
      event: { id: 'ev-1' },
      timeWindow: { start: '2026-01-01', end: '2026-01-31' },
    });

    expect(key).toBe('insight:event:ev-1:time:2026-01-01-2026-01-31');
  });

  it('question classifiers detect RAG and statistical intents', () => {
    expect(
      (service as any).isRagQuestion('show me examples of complaints'),
    ).toBe(true);
    expect(
      (service as any).isStatisticalQuestion('find anomalies and trends'),
    ).toBe(true);
    expect((service as any).isRagQuestion('high level summary please')).toBe(
      false,
    );
  });

  it('normalizeFollowUpContext reduces timestamp precision to date', () => {
    const normalized = (service as any).normalizeFollowUpContext(
      'Product: cards\nTime Window: 2026-03-03T14:02:00.123Z to 2026-03-03T14:07:59.999Z',
    );

    expect(normalized).toContain(
      'time window: 2026-03-03t14:00z to 2026-03-03t14:00z',
    );
    expect(normalized).not.toContain('t14:02:00.123z');
  });
});

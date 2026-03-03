/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

import { AnalysisService } from './analysis.service';

describe('AnalysisService - focused helpers', () => {
  let service: AnalysisService;
  let communicationsServiceMock: { search: jest.Mock };
  let eventsRepositoryMock: { searchEvents: jest.Mock };
  let esClientMock: { getClient: jest.Mock };
  let surveysServiceMock: { getJourneyStages: jest.Mock };
  let promptTemplateMock: {
    renderNamed: jest.Mock;
    getTemplate: jest.Mock;
  };

  beforeEach(() => {
    communicationsServiceMock = {
      search: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'c1' }, { id: 'c2' }] }),
    };

    promptTemplateMock = {
      renderNamed: jest.fn().mockReturnValue('analysis prompt'),
      getTemplate: jest.fn().mockReturnValue('system analyst'),
    };

    eventsRepositoryMock = {
      searchEvents: jest.fn().mockResolvedValue({ hits: [] }),
    };

    esClientMock = {
      getClient: jest.fn().mockReturnValue(undefined),
    };

    surveysServiceMock = {
      getJourneyStages: jest.fn().mockResolvedValue([]),
    };

    service = new AnalysisService(
      {} as any,
      {} as any,
      promptTemplateMock as any,
      {} as any,
      {} as any,
      communicationsServiceMock as any,
      eventsRepositoryMock as any,
      esClientMock as any,
      surveysServiceMock as any,
    );
  });

  it('normalizeProducts returns undefined for all/no product', () => {
    expect((service as any).normalizeProducts(undefined)).toBeUndefined();
    expect((service as any).normalizeProducts('all')).toBeUndefined();
  });

  it('buildProductFilter returns term for single product and terms for multiple products', () => {
    const single = (service as any).buildProductFilter(
      'aiClassification.product',
      ['credit-card'],
    );
    expect(single).toEqual({
      term: { 'aiClassification.product': 'credit-card' },
    });

    const multiple = (service as any).buildProductFilter(
      'aiClassification.product',
      ['credit-card', 'mortgage'],
    );
    expect(multiple).toEqual({
      terms: { 'aiClassification.product': ['credit-card', 'mortgage'] },
    });
  });

  it('getCommunicationsForAnalysis maps request filters and caps limit to 1000', async () => {
    const request = {
      type: 'sentiment',
      query: 'payment failures',
      targetId: 'cust_123',
      product: 'credit-card',
      channel: 'phone',
      timeRange: { from: '2026-01-01', to: '2026-02-01' },
      options: { limit: 5000 },
    } as any;

    const items = await (service as any).getCommunicationsForAnalysis(request);

    expect(communicationsServiceMock.search).toHaveBeenCalledWith({
      query: 'payment failures',
      customerId: 'cust_123',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      product: 'credit-card',
      channels: ['phone'],
      from: 0,
      size: 1000,
    });
    expect(items).toEqual([{ id: 'c1' }, { id: 'c2' }]);
  });

  it('analyze routes to sentiment branch and sets processingTime', async () => {
    jest.spyOn(service as any, 'analyzeSentiment').mockResolvedValue({
      type: 'sentiment',
      summary: 'ok',
      confidence: 0.8,
      insights: [],
      metrics: {},
      processingTime: 0,
    });

    const result = await service.analyze({ type: 'sentiment' } as any);

    expect(result.type).toBe('sentiment');
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('analyze routes to trends branch and sets processingTime', async () => {
    jest.spyOn(service as any, 'analyzeTrends').mockResolvedValue({
      type: 'trends',
      summary: 'ok',
      confidence: 0.75,
      insights: [],
      metrics: {},
      processingTime: 0,
    });

    const result = await service.analyze({ type: 'trends' } as any);

    expect(result.type).toBe('trends');
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('analyze throws for unknown analysis type', async () => {
    await expect(
      service.analyze({ type: 'unknown-type' } as any),
    ).rejects.toThrow('Unknown analysis type: unknown-type');
  });

  it('analyze routes to issue-detection branch', async () => {
    jest.spyOn(service as any, 'detectIssues').mockResolvedValue({
      type: 'issue-detection',
      summary: 'issues',
      confidence: 0.7,
      insights: [],
      metrics: {},
      processingTime: 0,
    });

    const result = await service.analyze({ type: 'issue-detection' } as any);

    expect(result.type).toBe('issue-detection');
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('assessRisk falls back to heuristic parsing when LLM JSON is invalid', async () => {
    jest
      .spyOn(service as any, 'getCommunicationsForAnalysis')
      .mockResolvedValue([
        {
          content: 'Customer unhappy',
          customerName: 'A',
          sentiment: { label: 'negative', score: -0.8 },
          priority: 'high',
        },
        {
          content: 'Neutral update',
          customerName: 'B',
          sentiment: { label: 'neutral', score: 0 },
          priority: 'normal',
        },
      ]);
    jest
      .spyOn(service as any, 'promptWithTimeout')
      .mockResolvedValue('not-json');

    const result = await (service as any).assessRisk({
      type: 'risk-assessment',
    });

    expect(result.type).toBe('risk-assessment');
    expect(result.summary).toContain('(basic assessment)');
    expect(result.metrics.riskLevel).toBeDefined();
    expect(result.metrics.factors.length).toBeGreaterThan(0);
  });

  it('extractInsights parses JSON payload when present', () => {
    const parsed = (service as any).extractInsights(
      JSON.stringify({
        insights: [
          {
            category: 'Risk',
            text: 'Repeated complaints',
            severity: 'high',
          },
        ],
      }),
    );

    expect(parsed).toEqual([
      {
        category: 'Risk',
        text: 'Repeated complaints',
        severity: 'high',
        evidence: undefined,
        relatedEntities: undefined,
      },
    ]);
  });

  it('extractInsights falls back to line parsing when JSON parse fails', () => {
    const parsed = (service as any).extractInsights(
      '- first issue\n- second issue\n\nplain line',
    );

    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].category).toBe('General');
    expect(parsed[0].severity).toBe('medium');
    expect(parsed[0].parsedFromFallback).toBe(true);
  });

  it('normalizeSeverity returns medium for unknown values', () => {
    expect((service as any).normalizeSeverity('CRITICAL')).toBe('critical');
    expect((service as any).normalizeSeverity('unexpected')).toBe('medium');
  });

  it('generateHealthRecommendations includes declining and risk-factor actions with cap', () => {
    const recommendations = (service as any).generateHealthRecommendations(
      30,
      'declining',
      [
        'High proportion of negative communications',
        'Sentiment trend is declining',
        'extra factor',
      ],
    );

    expect(recommendations.length).toBeLessThanOrEqual(5);
    expect(
      recommendations.some((r: string) =>
        r.includes('Immediate attention required'),
      ),
    ).toBe(true);
    expect(
      recommendations.some((r: string) =>
        r.includes('Investigate recent interactions'),
      ),
    ).toBe(true);
    expect(recommendations.some((r: string) => r.startsWith('Address:'))).toBe(
      true,
    );
  });

  it('generateSentimentRecommendations adds targeted recommendations by distribution', () => {
    const recs = (service as any).generateSentimentRecommendations(
      { positive: 1, neutral: 2, negative: 4, mixed: 3 },
      -0.3,
    );

    expect(recs.length).toBeGreaterThan(0);
    expect(
      recs.some((r: string) => r.includes('negative communications')),
    ).toBe(true);
    expect(
      recs.some((r: string) => r.includes('sentiment monitoring alerts')),
    ).toBe(true);
    expect(
      recs.some((r: string) => r.includes('mixed sentiment communications')),
    ).toBe(true);
  });

  it('getTimelineEvents maps event documents and type aliases', async () => {
    eventsRepositoryMock.searchEvents.mockResolvedValue({
      hits: [
        {
          source: {
            id: 'e-1',
            startDate: '2026-01-03T00:00:00.000Z',
            type: 'policy_change',
            label: 'Fee policy update',
            product: 'credit-card',
            severity: 'high',
            description: 'Updated fee policy',
          },
        },
      ],
    });

    const result = await service.getTimelineEvents({ product: 'cards' });

    expect(eventsRepositoryMock.searchEvents).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ product: 'balance-transfer-card' }),
      { size: 100, sort: [{ startDate: 'asc' }] },
    );
    expect(result[0]).toMatchObject({
      id: 'e-1',
      type: 'announcement',
      label: 'Fee policy update',
      product: 'credit-card',
    });
  });

  it('getTimelineEvents returns empty array on repository error', async () => {
    eventsRepositoryMock.searchEvents.mockRejectedValue(new Error('es error'));

    const result = await service.getTimelineEvents({});

    expect(result).toEqual([]);
  });

  it('getSentimentBubbles returns empty when ES client is unavailable', async () => {
    esClientMock.getClient.mockReturnValue(undefined);

    const result = await service.getSentimentBubbles({});

    expect(result).toEqual([]);
  });

  it('getJourneyStages maps survey aggregation response to journey stages', async () => {
    surveysServiceMock.getJourneyStages.mockResolvedValue([
      {
        stage: 'initial-contact',
        label: 'Initial Contact',
        npsScore: -20,
        totalResponses: 12,
        promoterPct: 10,
        passivePct: 20,
        detractorPct: 70,
      },
      {
        stage: 'triage',
        label: 'Triage',
        npsScore: -10,
        totalResponses: 8,
        promoterPct: 15,
        passivePct: 25,
        detractorPct: 60,
      },
    ]);

    const result = await service.getJourneyStages({ product: 'cards' });

    expect(surveysServiceMock.getJourneyStages).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
      products: expect.arrayContaining(['balance-transfer-card']),
    });
    expect(result[0]).toMatchObject({
      stage: 'initial-contact',
      sentiment: -0.2,
      previousSentiment: 0,
      change: -0.2,
      communications: 12,
    });
    expect(result[1]).toMatchObject({
      stage: 'triage',
      sentiment: -0.1,
      previousSentiment: -0.2,
      change: 0.1,
    });
  });

  it('getJourneyStages returns empty fallback stages on error', async () => {
    surveysServiceMock.getJourneyStages.mockRejectedValue(new Error('fail'));

    const result = await service.getJourneyStages({});

    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      stage: 'initial-contact',
      sentiment: 0,
      npsScore: 0,
    });
  });

  it('getQuadrantItems returns empty when ES client is unavailable', async () => {
    esClientMock.getClient.mockReturnValue(undefined);

    const result = await service.getQuadrantItems({});

    expect(result).toEqual([]);
  });

  it('getQuadrantItems maps buckets to quadrants and labels', async () => {
    esClientMock.getClient.mockReturnValue({
      search: jest.fn().mockResolvedValue({
        aggregations: {
          by_category: {
            buckets: [
              {
                key: 'payment-issue',
                doc_count: 100,
                avg_sentiment: { value: -0.6 },
                top_product: { buckets: [{ key: 'credit-card' }] },
              },
              {
                key: 'service-quality',
                doc_count: 20,
                avg_sentiment: { value: 0.4 },
                top_product: { buckets: [{ key: 'savings-account' }] },
              },
            ],
          },
        },
      }),
    });

    const result = await service.getQuadrantItems({});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      category: 'payment-issue',
      label: 'Payment Issues',
      quadrant: 'critical',
    });
    expect(result[1]).toMatchObject({
      category: 'service-quality',
      label: 'Service Quality',
    });
  });

  it('sentimentToNPS is deterministic for the same key and sentiment', () => {
    const first = (service as any).sentimentToNPS(-0.35, '2026-01-02');
    const second = (service as any).sentimentToNPS(-0.35, '2026-01-02');

    expect(first).toEqual(second);
    expect(first.promoterPct + first.passivePct + first.detractorPct).toBe(100);
    expect(first.isSimulated).toBe(true);
  });

  it('formatCategoryLabel converts kebab-case to title case', () => {
    expect((service as any).formatCategoryLabel('account-access')).toBe(
      'Account Access',
    );
  });
});

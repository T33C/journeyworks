/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { InsightDataService } from './insight-data.service';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('InsightDataService', () => {
  let service: InsightDataService;
  let esClientMock: { getClient: jest.Mock };
  let analysisServiceMock: { getJourneyStages: jest.Mock };

  beforeEach(() => {
    esClientMock = {
      getClient: jest.fn(),
    };

    analysisServiceMock = {
      getJourneyStages: jest.fn().mockResolvedValue([
        {
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.2,
          npsScore: -20,
          communications: 10,
          promoterPct: 20,
        },
      ]),
    };

    service = new InsightDataService(
      esClientMock as any,
      analysisServiceMock as any,
    );
  });

  it('normalizeProduct maps known aliases and preserves unknown values', () => {
    expect((service as any).normalizeProduct('cards')).toBe('credit-card');
    expect((service as any).normalizeProduct('CUSTOM')).toBe('CUSTOM');
    expect((service as any).normalizeProduct(undefined)).toBeUndefined();
  });

  it('extractEventKeywords removes stop words and deduplicates', () => {
    const words = (service as any).extractEventKeywords({
      label: 'Service outage in mobile app',
      description: 'The outage in app app caused payment delays',
      type: 'incident',
    });

    expect(words).toContain('outage');
    expect(words).toContain('mobile');
    expect(words).toContain('incident');
    expect(words.includes('the')).toBe(false);
    expect(words.filter((w: string) => w === 'app')).toHaveLength(1);
  });

  it('getRelevantCommunications returns empty when ES client unavailable', async () => {
    esClientMock.getClient.mockReturnValue(undefined);

    const result = await service.getRelevantCommunications({} as any, 3);

    expect(result).toEqual([]);
  });

  it('getRelevantSocialMentions returns empty when ES search fails', async () => {
    esClientMock.getClient.mockReturnValue({
      search: jest.fn().mockRejectedValue(new Error('es down')),
    });

    const result = await service.getRelevantSocialMentions({} as any, 2);

    expect(result).toEqual([]);
  });

  it('getInsightData uses selected bubble volume as evidence limit when <= 15', async () => {
    const commSpy = jest
      .spyOn(service, 'getRelevantCommunications')
      .mockResolvedValue([] as any);
    jest
      .spyOn(service, 'getRelevantSocialMentions')
      .mockResolvedValue([] as any);
    jest.spyOn(service, 'getTimeSeriesMetrics').mockResolvedValue([] as any);
    jest.spyOn(service, 'getResolutionJourney').mockResolvedValue([] as any);
    jest.spyOn(service, 'getEventCorrelations').mockResolvedValue([] as any);
    jest.spyOn(service as any, 'getSummaryMetrics').mockResolvedValue({
      totalCommunications: 0,
      totalSocialMentions: 0,
      avgSentiment: 0,
      avgNps: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      topThemes: [],
      topProducts: [],
    });

    await service.getInsightData({ selectedBubble: { volume: 12 } } as any);

    expect(commSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBubble: { volume: 12 } }),
      12,
    );
  });

  it('getInsightData falls back to default evidence limit when bubble is large', async () => {
    const commSpy = jest
      .spyOn(service, 'getRelevantCommunications')
      .mockResolvedValue([] as any);
    jest
      .spyOn(service, 'getRelevantSocialMentions')
      .mockResolvedValue([] as any);
    jest.spyOn(service, 'getTimeSeriesMetrics').mockResolvedValue([] as any);
    jest.spyOn(service, 'getResolutionJourney').mockResolvedValue([] as any);
    jest.spyOn(service, 'getEventCorrelations').mockResolvedValue([] as any);
    jest.spyOn(service as any, 'getSummaryMetrics').mockResolvedValue({
      totalCommunications: 0,
      totalSocialMentions: 0,
      avgSentiment: 0,
      avgNps: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      topThemes: [],
      topProducts: [],
    });

    await service.getInsightData({ selectedBubble: { volume: 99 } } as any);

    expect(commSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBubble: { volume: 99 } }),
      10,
    );
  });

  it('getResolutionJourney maps stages from AnalysisService', async () => {
    const result = await service.getResolutionJourney({
      timeWindow: { start: '2026-01-01', end: '2026-01-31' },
      product: 'cards',
    } as any);

    expect(analysisServiceMock.getJourneyStages).toHaveBeenCalledWith({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      product: 'cards',
    });
    expect(result[0]).toMatchObject({
      stage: 'initial-contact',
      avgSentiment: -0.2,
      avgNps: -20,
      communicationCount: 10,
    });
  });

  it('getResolutionJourney returns defaults when AnalysisService fails', async () => {
    analysisServiceMock.getJourneyStages.mockRejectedValue(new Error('boom'));

    const result = await service.getResolutionJourney({} as any);

    expect(result).toHaveLength(5);
    expect(result[0].stage).toBe('initial-contact');
  });

  it('mapCommunicationToEvidence truncates long excerpts and maps channel type', () => {
    const evidence = (service as any).mapCommunicationToEvidence({
      _source: {
        id: 'comm-1',
        channel: 'phone',
        content: 'x'.repeat(250),
        timestamp: '2026-01-01T00:00:00.000Z',
        sentiment: { score: -0.4 },
        aiClassification: { category: 'payment-issue' },
      },
    });

    expect(evidence.id).toBe('comm-1');
    expect(evidence.type).toBe('call');
    expect(evidence.excerpt.endsWith('...')).toBe(true);
    expect(evidence.source).toContain('Call Centre');
  });

  it('mapSocialToEvidence formats platform source with author handle', () => {
    const evidence = (service as any).mapSocialToEvidence({
      _source: {
        id: 'soc-1',
        platform: 'twitter',
        authorHandle: 'user123',
        content: 'hello world',
        timestamp: '2026-01-02T00:00:00.000Z',
        sentiment: { score: 0.2 },
      },
    });

    expect(evidence.type).toBe('social');
    expect(evidence.source).toBe('Twitter/X (@user123)');
  });
});

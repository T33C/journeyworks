/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { BadRequestException } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let analysisServiceMock: {
    analyze: jest.Mock;
    getTimelineEvents: jest.Mock;
    getSentimentBubbles: jest.Mock;
    getJourneyStages: jest.Mock;
    getQuadrantItems: jest.Mock;
  };

  beforeEach(() => {
    analysisServiceMock = {
      analyze: jest.fn(),
      getTimelineEvents: jest.fn(),
      getSentimentBubbles: jest.fn(),
      getJourneyStages: jest.fn(),
      getQuadrantItems: jest.fn(),
    };

    controller = new AnalysisController(analysisServiceMock as any);
  });

  it('maps sentiment trend query params into analysis request', async () => {
    analysisServiceMock.analyze.mockResolvedValue({ type: 'sentiment' });

    await controller.getSentimentTrends(
      '2026-01-01',
      '2026-01-31',
      'phone',
      'cust_1',
    );

    expect(analysisServiceMock.analyze).toHaveBeenCalledWith({
      type: 'sentiment',
      targetId: 'cust_1',
      channel: 'phone',
      timeRange: { from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('throws BadRequestException for invalid date in convenience GET endpoints', async () => {
    await expect(
      controller.getSentimentTrends('01/31/2026', undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates customer id on risk by customer endpoint', async () => {
    await expect(
      controller.getRiskForCustomer('bad id!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aggregates dashboard summary from sentiment and trends analyses', async () => {
    analysisServiceMock.analyze
      .mockResolvedValueOnce({
        type: 'sentiment',
        summary: 'Sentiment summary',
        confidence: 0.8,
        insights: [{ category: 'a', text: 's', severity: 'medium' }],
        metrics: { averageScore: -0.2 },
        visualizations: [{ type: 'line', title: 'Sentiment', data: [] }],
        processingTime: 20,
      })
      .mockResolvedValueOnce({
        type: 'trends',
        summary: 'Trend summary',
        confidence: 0.6,
        insights: [{ category: 'b', text: 't', severity: 'high' }],
        metrics: { totalCommunications: 42 },
        visualizations: [{ type: 'bar', title: 'Volume', data: [] }],
        processingTime: 30,
      });

    const result = await controller.getDashboardSummary();

    expect(result.summary).toContain('Sentiment summary');
    expect(result.summary).toContain('Trend summary');
    expect(result.confidence).toBe(0.6);
    expect(result.insights).toHaveLength(2);
    expect(result.processingTime).toBe(50);
    expect(result.metrics).toEqual({
      sentiment: { averageScore: -0.2 },
      trends: { totalCommunications: 42 },
    });
  });

  it('parses dashboard timeline event date filters to Date', async () => {
    analysisServiceMock.getTimelineEvents.mockResolvedValue([]);

    await controller.getTimelineEvents('2026-02-01', '2026-02-02', 'all');

    expect(analysisServiceMock.getTimelineEvents).toHaveBeenCalledWith({
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-02'),
      product: 'all',
    });
  });
});

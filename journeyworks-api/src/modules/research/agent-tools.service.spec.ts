/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { AgentTools } from './agent-tools.service';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

describe('AgentTools', () => {
  let service: AgentTools;
  let ragServiceMock: any;
  let rrgServiceMock: any;
  let analysisServiceMock: any;
  let communicationsServiceMock: any;
  let esClientMock: any;

  beforeEach(() => {
    ragServiceMock = {
      semanticSearch: jest.fn().mockResolvedValue([]),
      query: jest
        .fn()
        .mockResolvedValue({ answer: 'a', confidence: 0.9, sources: [] }),
      summarizeCustomerCommunications: jest.fn().mockResolvedValue('summary'),
      findSimilar: jest.fn().mockResolvedValue([]),
    };

    rrgServiceMock = {
      query: jest.fn().mockResolvedValue({
        summary: 'ok',
        results: {
          total: 1,
          aggregations: {},
          documents: [{ id: 'd1', summary: 'doc 1', content: 'x' }],
        },
      }),
    };

    analysisServiceMock = {
      analyze: jest.fn().mockResolvedValue({
        summary: 'analysis summary',
        metrics: {
          healthScore: 70,
          trend: 'stable',
          riskFactors: [],
          sentimentBreakdown: {},
          averageScore: 0,
          topTopics: [],
          trendDirection: 'stable',
          dailyAverageVolume: 1,
          dateRange: {},
          customerName: 'A',
          communicationCount: 1,
          firstContact: '2026-01-01',
          lastContact: '2026-01-02',
        },
        insights: [],
        recommendations: [],
        visualizations: [],
      }),
    };

    communicationsServiceMock = {
      getByCustomer: jest.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            customerName: 'Jane',
            timestamp: '2026-01-01',
            channel: 'email',
            sentiment: { label: 'neutral' },
            summary: 's',
            content: 'c',
          },
        ],
      }),
      search: jest.fn().mockResolvedValue({ items: [] }),
    };

    esClientMock = {
      getClient: jest.fn().mockReturnValue({
        search: jest.fn().mockResolvedValue({
          hits: { total: { value: 0 } },
          aggregations: {},
        }),
      }),
    };

    service = new AgentTools(
      ragServiceMock,
      rrgServiceMock,
      analysisServiceMock,
      communicationsServiceMock,
      esClientMock,
    );
  });

  it('registers expected core tools', () => {
    const names = service.getToolNames();
    expect(names).toContain('search_knowledge_base');
    expect(names).toContain('ask_question');
    expect(names).toContain('query_data');
  });

  it('getFilteredTools returns only requested tools', () => {
    const filtered = service.getFilteredTools(['ask_question']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('ask_question');
  });

  it('getToolDescriptions includes defaults and parameter descriptions', () => {
    const descriptions = service.getToolDescriptions(['search_knowledge_base']);
    expect(descriptions).toContain('search_knowledge_base');
    expect(descriptions).toContain('(default: 5)');
    expect(descriptions).toContain('query (string)');
  });

  it('formatToolObservation uses custom formatter when available', () => {
    const out = service.formatToolObservation('search_knowledge_base', [
      {
        content: 'content line',
        metadata: {
          customerId: 'c1',
          customerName: 'Alex',
          channel: 'email',
          timestamp: '2026-01-01T00:00:00.000Z',
          sentiment: 'neutral',
          tags: ['billing'],
        },
      },
    ]);

    expect(out).toContain('Found 1 results');
    expect(out).toContain('[c1, Alex]');
  });

  it('formatToolObservation falls back to truncating long JSON', () => {
    const longPayload = { data: 'x'.repeat(9000) };
    const out = service.formatToolObservation('unknown_tool', longPayload);

    expect(out.endsWith('...')).toBe(true);
    expect(out.length).toBe(8000);
  });

  it('executeTool throws for unknown tool', async () => {
    await expect(service.executeTool('does_not_exist', {})).rejects.toThrow(
      'Unknown tool: does_not_exist',
    );
  });

  it('executeTool validates required fields', async () => {
    await expect(service.executeTool('ask_question', {})).rejects.toThrow(
      'Tool input validation failed: Missing required field: question',
    );
  });

  it('executeTool validates field types against schema', async () => {
    await expect(
      service.executeTool('find_similar', {
        communicationId: 'c-1',
        topK: 'bad-type',
      }),
    ).rejects.toThrow("Invalid type for 'topK': expected number");
  });

  it('executeTool returns extracted sources for array outputs', async () => {
    ragServiceMock.findSimilar.mockResolvedValue([
      {
        score: 0.91,
        document: {
          id: 'c-1',
          content: 'similar content',
          metadata: { customerName: 'Sam', channel: 'email' },
        },
      },
    ]);

    const result = await service.executeTool('find_similar', {
      communicationId: 'origin',
      topK: 1,
    });

    expect(result.output).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      id: 'c-1',
      type: 'communication',
    });
  });

  it('executeTool returns extracted sources for sampleDocuments output', async () => {
    rrgServiceMock.query.mockResolvedValue({
      summary: 'query summary',
      results: {
        total: 1,
        aggregations: { by_channel: [{ key: 'email', doc_count: 1 }] },
        documents: [
          { id: 'doc-7', summary: 'document summary', content: 'body' },
        ],
      },
    });

    const result = await service.executeTool('query_data', {
      query: 'count by channel',
      execute: true,
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      id: 'doc-7',
      title: 'document summary',
    });
  });

  it('normalizeProduct returns undefined for empty and preserves unknown terms', () => {
    expect((service as any).normalizeProduct(undefined)).toBeUndefined();
    expect((service as any).normalizeProduct('non-existent-product')).toBe(
      'non-existent-product',
    );
  });
});

/**
 * Communications Repository
 *
 * Elasticsearch repository for communication documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
  AggregationResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';
import { ModelServiceClient } from '../../infrastructure/model-service';

export interface CommunicationDocument {
  id: string;
  channel: string;
  direction: string;
  customerId: string;
  customerName?: string;
  caseId?: string;
  subject?: string;
  content: string;
  summary?: string;
  timestamp: string;
  status?: string;
  priority?: string;
  sentiment?: {
    label: string;
    score: number;
    confidence: number;
    emotionalTones?: string[];
  };
  intent?: {
    primary: string;
    secondary?: string[];
    confidence: number;
  };
  entities?: Array<{
    type: string;
    value: string;
    confidence?: number;
  }>;
  tags?: string[];
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  embedding?: number[];
  sparseEmbedding?: {
    indices: number[];
    values: number[];
  };
  metadata?: Record<string, unknown>;
  aiClassification?: {
    category: string;
    confidence: number;
    product: string;
    issueType: string;
    urgency: string;
    rootCause: string;
    suggestedAction: string;
    regulatoryFlags?: string[];
  };
  messages?: Array<{
    id: string;
    timestamp: string;
    sender: string;
    channel: string;
    content: string;
    sentiment?: number;
  }>;
  threadId?: string;
  relatedEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationSearchFilters {
  channels?: string[];
  direction?: string;
  sentiments?: string[];
  statuses?: string[];
  priorities?: string[];
  customerId?: string;
  caseId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  product?: string; // Filter by product (from aiClassification.product)
}

@Injectable()
export class CommunicationsRepository extends BaseElasticsearchRepository<CommunicationDocument> {
  protected readonly logger = new Logger(CommunicationsRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
    private readonly modelService: ModelServiceClient,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.communications') ||
      'communications';
  }

  /**
   * Search communications with filters
   */
  async searchCommunications(
    query?: string,
    filters?: CommunicationSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<CommunicationDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    // Text query
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['content^2', 'subject^1.5', 'summary', 'customerName'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Filters
    if (filters?.channels?.length) {
      filter.push({ terms: { channel: filters.channels } });
    }

    if (filters?.direction) {
      filter.push({ term: { direction: filters.direction } });
    }

    if (filters?.sentiments?.length) {
      filter.push({ terms: { 'sentiment.label': filters.sentiments } });
    }

    if (filters?.statuses?.length) {
      filter.push({ terms: { status: filters.statuses } });
    }

    if (filters?.priorities?.length) {
      filter.push({ terms: { priority: filters.priorities } });
    }

    if (filters?.customerId) {
      filter.push({ term: { 'customerId.keyword': filters.customerId } });
    }

    if (filters?.caseId) {
      filter.push({ term: { 'caseId.keyword': filters.caseId } });
    }

    if (filters?.tags?.length) {
      filter.push({ terms: { tags: filters.tags } });
    }

    if (filters?.product) {
      filter.push({ term: { 'aiClassification.product': filters.product } });
    }

    if (filters?.startDate || filters?.endDate) {
      const dateRange: any = {};
      if (filters.startDate) dateRange.gte = filters.startDate;
      if (filters.endDate) dateRange.lte = filters.endDate;
      filter.push({ range: { timestamp: dateRange } });
    }

    const esQuery = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    };

    return this.searchIndex(esQuery, {
      ...options,
      highlight: query
        ? {
            fields: {
              content: {},
              subject: {},
              summary: {},
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          }
        : undefined,
    });
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    queryText: string,
    topK: number = 10,
    filters?: CommunicationSearchFilters,
  ): Promise<SearchResult<CommunicationDocument>> {
    // Generate query embedding
    const queryEmbedding = await this.modelService.embedText(queryText);

    // Build filter
    const filterClauses: any[] = [];

    if (filters?.channels?.length) {
      filterClauses.push({ terms: { channel: filters.channels } });
    }

    if (filters?.customerId) {
      filterClauses.push({
        term: { 'customerId.keyword': filters.customerId },
      });
    }

    if (filters?.startDate || filters?.endDate) {
      const dateRange: any = {};
      if (filters.startDate) dateRange.gte = filters.startDate;
      if (filters.endDate) dateRange.lte = filters.endDate;
      filterClauses.push({ range: { timestamp: dateRange } });
    }

    return this.vectorSearchIndex('embedding', queryEmbedding, {
      k: topK,
      filter:
        filterClauses.length > 0
          ? { bool: { filter: filterClauses } }
          : undefined,
    });
  }

  /**
   * Hybrid search combining text and vector search
   * Uses a simplified signature for ease of use
   */
  async searchHybrid(
    queryText: string,
    topK: number = 10,
    filters?: CommunicationSearchFilters,
    textWeight: number = 0.3,
    vectorWeight: number = 0.7,
  ): Promise<SearchResult<CommunicationDocument>> {
    // Generate query embedding
    const queryEmbedding = await this.modelService.embedText(queryText);

    // Build filter
    const filterClauses: any[] = [];

    if (filters?.channels?.length) {
      filterClauses.push({ terms: { channel: filters.channels } });
    }

    if (filters?.customerId) {
      filterClauses.push({
        term: { 'customerId.keyword': filters.customerId },
      });
    }

    if (filters?.product) {
      filterClauses.push({
        term: { 'aiClassification.product': filters.product },
      });
    }

    if (filters?.startDate || filters?.endDate) {
      const dateRange: any = {};
      if (filters.startDate) dateRange.gte = filters.startDate;
      if (filters.endDate) dateRange.lte = filters.endDate;
      filterClauses.push({ range: { timestamp: dateRange } });
    }

    // Text query for hybrid
    const textQuery = {
      multi_match: {
        query: queryText,
        fields: ['content^2', 'subject^1.5', 'summary'],
        type: 'best_fields',
      },
    };

    return super.hybridSearch<CommunicationDocument>(
      this.indexName,
      textQuery,
      'embedding',
      queryEmbedding,
      {
        k: topK,
        filter:
          filterClauses.length > 0
            ? { bool: { filter: filterClauses } }
            : undefined,
      },
    );
  }

  /**
   * Get communications for a customer
   */
  async getByCustomerId(
    customerId: string,
    options: SearchOptions = {},
  ): Promise<SearchResult<CommunicationDocument>> {
    return this.searchIndex(
      { bool: { filter: [{ term: { 'customerId.keyword': customerId } }] } },
      { ...options, sort: [{ timestamp: 'desc' }] },
    );
  }

  /**
   * Get communications for a case
   */
  async getByCaseId(
    caseId: string,
    options: SearchOptions = {},
  ): Promise<SearchResult<CommunicationDocument>> {
    return this.searchIndex(
      { bool: { filter: [{ term: { 'caseId.keyword': caseId } }] } },
      { ...options, sort: [{ timestamp: 'asc' }] },
    );
  }

  /**
   * Get communication aggregations
   */
  async getAggregations(filters?: CommunicationSearchFilters): Promise<{
    byChannel: Record<string, number>;
    bySentiment: Record<string, number>;
    byDirection: Record<string, number>;
    overTime: Array<{ date: string; count: number }>;
  }> {
    const filterClauses: any[] = [];

    if (filters?.customerId) {
      filterClauses.push({
        term: { 'customerId.keyword': filters.customerId },
      });
    }

    if (filters?.startDate || filters?.endDate) {
      const dateRange: any = {};
      if (filters.startDate) dateRange.gte = filters.startDate;
      if (filters.endDate) dateRange.lte = filters.endDate;
      filterClauses.push({ range: { timestamp: dateRange } });
    }

    const query =
      filterClauses.length > 0
        ? { bool: { filter: filterClauses } }
        : { match_all: {} };

    const results = await this.aggregate(query, {
      byChannel: { terms: { field: 'channel', size: 10 } },
      bySentiment: { terms: { field: 'sentiment.label', size: 10 } },
      byDirection: { terms: { field: 'direction', size: 10 } },
      overTime: {
        date_histogram: {
          field: 'timestamp',
          calendar_interval: 'day',
          format: 'yyyy-MM-dd',
        },
      },
    });

    // Transform results - aggregations are in results.aggregations
    const aggs = results.aggregations || {};
    const byChannel: Record<string, number> = {};
    const bySentiment: Record<string, number> = {};
    const byDirection: Record<string, number> = {};
    const overTime: Array<{ date: string; count: number }> = [];

    if (aggs.byChannel) {
      for (const bucket of (aggs.byChannel as any).buckets || []) {
        byChannel[bucket.key] = bucket.doc_count;
      }
    }

    if (aggs.bySentiment) {
      for (const bucket of (aggs.bySentiment as any).buckets || []) {
        bySentiment[bucket.key] = bucket.doc_count;
      }
    }

    if (aggs.byDirection) {
      for (const bucket of (aggs.byDirection as any).buckets || []) {
        byDirection[bucket.key] = bucket.doc_count;
      }
    }

    if (aggs.overTime) {
      for (const bucket of (aggs.overTime as any).buckets || []) {
        overTime.push({
          date: bucket.key_as_string,
          count: bucket.doc_count,
        });
      }
    }

    return { byChannel, bySentiment, byDirection, overTime };
  }

  /**
   * Search for documents that don't have embeddings
   */
  async searchWithoutEmbeddings(
    limit: number = 1000,
  ): Promise<Array<{ source: CommunicationDocument }>> {
    const results = await this.searchIndex(
      {
        bool: {
          must_not: [{ exists: { field: 'embedding' } }],
        },
      },
      { size: limit },
    );
    return results.hits.map((hit) => ({ source: hit.source }));
  }

  /**
   * Add embedding to a communication
   */
  async addEmbedding(id: string, content: string): Promise<void> {
    const embedding = await this.modelService.embedText(content);
    await this.updateById(id, { embedding } as Partial<CommunicationDocument>);
  }

  /**
   * Bulk add embeddings
   */
  async bulkAddEmbeddings(
    documents: Array<{ id: string; content: string }>,
    batchSize: number = 32,
  ): Promise<void> {
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const contents = batch.map((d) => d.content);
      const embeddings = await this.modelService.embedTextsBatched(
        contents,
        batchSize,
      );

      const operations = batch.map((doc, idx) => ({
        id: doc.id,
        document: {
          embedding: embeddings[idx],
        } as Partial<CommunicationDocument>,
      }));

      // Update in bulk (simplified - could use ES bulk API for better performance)
      await Promise.all(
        operations.map((op) => this.updateById(op.id, op.document)),
      );

      this.logger.log(
        `Added embeddings for ${Math.min(i + batchSize, documents.length)}/${documents.length} documents`,
      );
    }
  }

  /**
   * Delete all documents in the index
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }
}

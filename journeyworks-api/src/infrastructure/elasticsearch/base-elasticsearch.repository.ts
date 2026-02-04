/**
 * Base Elasticsearch Repository
 *
 * Provides common CRUD operations and search functionality for all entities.
 * Extend this class for entity-specific repositories.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import { Client } from '@elastic/elasticsearch';
import {
  SearchRequest,
  SearchResponse,
  BulkResponse,
  GetResponse,
} from '@elastic/elasticsearch/lib/api/types';

export interface SearchOptions {
  from?: number;
  size?: number;
  sort?: Array<Record<string, 'asc' | 'desc'>>;
  source?: string[] | boolean;
  trackTotalHits?: boolean;
}

export interface BulkOperation<T> {
  action: 'index' | 'update' | 'delete';
  id: string;
  document?: T;
}

export interface SearchResult<T> {
  hits: Array<{
    id: string;
    score: number;
    source: T;
    highlight?: Record<string, string[]>;
  }>;
  total: number;
  took: number;
  aggregations?: Record<string, any>;
}

export interface VectorSearchOptions extends SearchOptions {
  k?: number;
  numCandidates?: number;
  filter?: object;
}

export interface AggregationResult {
  buckets?: Array<{
    key: string | number;
    doc_count: number;
    [key: string]: unknown;
  }>;
  value?: number;
  [key: string]: unknown;
}

export class ElasticsearchUnavailableError extends Error {
  constructor() {
    super(
      'Elasticsearch is not available. Please ensure Elasticsearch is running.',
    );
    this.name = 'ElasticsearchUnavailableError';
  }
}

@Injectable()
export class BaseElasticsearchRepository<T = unknown> {
  protected readonly logger = new Logger(BaseElasticsearchRepository.name);
  protected indexName: string = '';

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    @Optional() protected readonly configService?: unknown,
  ) {}

  /**
   * Get the Elasticsearch client or throw if unavailable
   */
  protected getClientOrThrow(): Client {
    const client = this.esClient.getClient();
    if (!client) {
      throw new ElasticsearchUnavailableError();
    }
    return client;
  }

  /**
   * Check if Elasticsearch is available
   */
  isAvailable(): boolean {
    return this.esClient.isElasticsearchAvailable();
  }

  /**
   * Index a single document
   */
  async index<T>(
    indexName: string,
    id: string,
    document: T,
    refresh: boolean = false,
  ): Promise<void> {
    const client = this.getClientOrThrow();

    await client.index({
      index: indexName,
      id,
      document,
      refresh: refresh ? 'true' : 'false',
    });
  }

  /**
   * Get a document by ID
   */
  async get<T>(indexName: string, id: string): Promise<T | null> {
    const client = this.getClientOrThrow();

    try {
      const response: GetResponse<T> = await client.get({
        index: indexName,
        id,
      });

      return response._source || null;
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a document
   */
  async update<T>(
    indexName: string,
    id: string,
    partialDocument: Partial<T>,
    refresh: boolean = false,
  ): Promise<void> {
    const client = this.getClientOrThrow();

    await client.update({
      index: indexName,
      id,
      doc: partialDocument,
      refresh: refresh ? 'true' : 'false',
    });
  }

  /**
   * Delete a document by ID
   */
  async delete(
    indexName: string,
    id: string,
    refresh: boolean = false,
  ): Promise<boolean> {
    const client = this.getClientOrThrow();

    try {
      await client.delete({
        index: indexName,
        id,
        refresh: refresh ? 'true' : 'false',
      });
      return true;
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if a document exists
   */
  async exists(indexName: string, id: string): Promise<boolean> {
    const client = this.getClientOrThrow();
    return client.exists({ index: indexName, id });
  }

  /**
   * Bulk operations
   */
  async bulk<T>(
    indexName: string,
    operations: BulkOperation<T>[],
  ): Promise<BulkResponse> {
    const client = this.getClientOrThrow();

    const body: any[] = [];
    for (const op of operations) {
      switch (op.action) {
        case 'index':
          body.push({ index: { _index: indexName, _id: op.id } });
          body.push(op.document);
          break;
        case 'update':
          body.push({ update: { _index: indexName, _id: op.id } });
          body.push({ doc: op.document });
          break;
        case 'delete':
          body.push({ delete: { _index: indexName, _id: op.id } });
          break;
      }
    }

    return client.bulk({ body, refresh: true });
  }

  /**
   * Search documents
   */
  async search<T>(
    indexName: string,
    query: object,
    options: SearchOptions = {},
  ): Promise<SearchResult<T>> {
    const client = this.getClientOrThrow();

    const searchRequest: SearchRequest = {
      index: indexName,
      query,
      from: options.from || 0,
      size: options.size || 10,
      track_total_hits: options.trackTotalHits ?? true,
    };

    if (options.sort) {
      searchRequest.sort = options.sort;
    }

    if (options.source !== undefined) {
      searchRequest._source = options.source;
    }

    const response: SearchResponse<T> = await client.search(searchRequest);

    return this.transformSearchResponse(response);
  }

  /**
   * Search with aggregations
   */
  async searchWithAggregations<TDoc>(
    indexName: string,
    query: object,
    aggregations: Record<string, unknown>,
    options: SearchOptions = {},
  ): Promise<SearchResult<TDoc>> {
    const client = this.getClientOrThrow();

    const searchRequest: SearchRequest = {
      index: indexName,
      query,
      aggs: aggregations as Record<string, any>,
      from: options.from || 0,
      size: options.size || 0, // Default to 0 for aggregation-only queries
      track_total_hits: options.trackTotalHits ?? true,
    };

    const response: SearchResponse<TDoc> = await client.search(searchRequest);

    return this.transformSearchResponse(response);
  }

  /**
   * Dense vector search (kNN)
   */
  async vectorSearch<T>(
    indexName: string,
    field: string,
    queryVector: number[],
    options: VectorSearchOptions = {},
  ): Promise<SearchResult<T>> {
    const client = this.getClientOrThrow();

    const searchRequest: SearchRequest = {
      index: indexName,
      knn: {
        field,
        query_vector: queryVector,
        k: options.k || 10,
        num_candidates: options.numCandidates || 100,
        filter: options.filter,
      },
      from: options.from || 0,
      size: options.size || 10,
    };

    if (options.source !== undefined) {
      searchRequest._source = options.source;
    }

    const response: SearchResponse<T> = await client.search(searchRequest);

    return this.transformSearchResponse(response);
  }

  /**
   * Hybrid search (combining kNN with BM25)
   */
  async hybridSearch<T>(
    indexName: string,
    textQuery: object,
    vectorField: string,
    queryVector: number[],
    options: VectorSearchOptions = {},
  ): Promise<SearchResult<T>> {
    const client = this.getClientOrThrow();

    const searchRequest: SearchRequest = {
      index: indexName,
      query: textQuery,
      knn: {
        field: vectorField,
        query_vector: queryVector,
        k: options.k || 10,
        num_candidates: options.numCandidates || 100,
        filter: options.filter,
      },
      from: options.from || 0,
      size: options.size || 10,
    };

    if (options.source !== undefined) {
      searchRequest._source = options.source;
    }

    const response: SearchResponse<T> = await client.search(searchRequest);

    return this.transformSearchResponse(response);
  }

  /**
   * Count documents matching a query
   */
  async count(indexName: string, query?: object): Promise<number> {
    const client = this.getClientOrThrow();

    const response = await client.count({
      index: indexName,
      query: query || { match_all: {} },
    });

    return response.count;
  }

  /**
   * Delete by query
   */
  async deleteByQuery(indexName: string, query: object): Promise<number> {
    const client = this.getClientOrThrow();

    const response = await client.deleteByQuery({
      index: indexName,
      query,
      refresh: true,
    });

    return response.deleted || 0;
  }

  /**
   * Transform Elasticsearch response to our format
   */
  protected transformSearchResponse<TDoc>(
    response: SearchResponse<TDoc>,
  ): SearchResult<TDoc> {
    const hits = response.hits.hits.map((hit) => ({
      id: hit._id,
      score: hit._score || 0,
      source: hit._source as TDoc,
      document: hit._source as TDoc, // Alias for backwards compatibility
      highlight: hit.highlight,
    }));

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

    return {
      hits,
      total,
      took: response.took,
      aggregations: response.aggregations as Record<string, unknown>,
    };
  }

  // ==========================================================================
  // Convenience methods that use this.indexName (for subclasses)
  // ==========================================================================

  /**
   * Create/index a document using this.indexName
   */
  async create(
    id: string,
    document: T,
    refresh: boolean = true,
  ): Promise<void> {
    await this.index(this.indexName, id, document, refresh);
  }

  /**
   * Find a document by ID using this.indexName
   */
  async findById(id: string): Promise<T | null> {
    return this.get<T>(this.indexName, id);
  }

  /**
   * Update a document using this.indexName
   */
  async updateById(
    id: string,
    partialDocument: Partial<T>,
    refresh: boolean = true,
  ): Promise<void> {
    await this.update(this.indexName, id, partialDocument, refresh);
  }

  /**
   * Delete a document by ID using this.indexName
   */
  async deleteById(id: string, refresh: boolean = true): Promise<boolean> {
    return this.delete(this.indexName, id, refresh);
  }

  /**
   * Bulk index documents using this.indexName
   */
  async bulkIndex(
    documents: Array<{ id: string } & T>,
  ): Promise<{ created: number; failed: number }> {
    const operations: BulkOperation<T>[] = documents.map((doc) => ({
      action: 'index' as const,
      id: doc.id,
      document: doc,
    }));

    const result = await this.bulk(this.indexName, operations);
    const failed = result.errors
      ? result.items.filter((i) => i.index?.error).length
      : 0;

    return {
      created: documents.length - failed,
      failed,
    };
  }

  /**
   * Search using this.indexName with extended options
   */
  async searchIndex(
    query: object,
    options: SearchOptions & { highlight?: object } = {},
  ): Promise<SearchResult<T>> {
    const client = this.getClientOrThrow();

    const searchRequest: SearchRequest = {
      index: this.indexName,
      query,
      from: options.from || 0,
      size: options.size || 10,
      track_total_hits: options.trackTotalHits ?? true,
    };

    if (options.sort) {
      searchRequest.sort = options.sort;
    }

    if (options.source !== undefined) {
      searchRequest._source = options.source;
    }

    if ((options as any).highlight) {
      searchRequest.highlight = (options as any).highlight;
    }

    const response: SearchResponse<T> = await client.search(searchRequest);

    return this.transformSearchResponse(response);
  }

  /**
   * Vector search using this.indexName
   */
  async vectorSearchIndex(
    field: string,
    queryVector: number[],
    options: VectorSearchOptions = {},
  ): Promise<SearchResult<T>> {
    return this.vectorSearch<T>(this.indexName, field, queryVector, options);
  }

  /**
   * Aggregate using this.indexName
   */
  async aggregate(
    query: object,
    aggregations: Record<string, unknown>,
  ): Promise<SearchResult<T>> {
    return this.searchWithAggregations<T>(this.indexName, query, aggregations, {
      size: 0,
    });
  }
}

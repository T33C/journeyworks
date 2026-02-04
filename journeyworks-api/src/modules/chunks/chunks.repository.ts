/**
 * Chunks Repository
 *
 * Elasticsearch repository for RAG chunk documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

export interface ChunkMetadata {
  channel?: string;
  timestamp?: string;
  customerId?: string;
  product?: string;
  category?: string;
  sentiment?: number;
  npsScore?: number;
}

export interface ChunkDocument {
  chunkId: string;
  communicationId: string;
  content: string;
  context?: string;
  position: number;
  chunkType: 'paragraph' | 'sentence' | 'section';
  tokenCount: number;
  overlap?: number;
  denseEmbedding?: number[];
  sparseEmbedding?: Record<string, number>;
  metadata: ChunkMetadata;
  createdAt: string;
}

export interface ChunkSearchFilters {
  customerId?: string;
  channel?: string;
  product?: string;
  category?: string;
  minSentiment?: number;
  maxSentiment?: number;
  minNpsScore?: number;
  maxNpsScore?: number;
}

@Injectable()
export class ChunksRepository extends BaseElasticsearchRepository<ChunkDocument> {
  protected readonly logger = new Logger(ChunksRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.chunks') ||
      'chunks';
  }

  /**
   * Search chunks with filters (text search)
   */
  async searchChunks(
    query?: string,
    filters?: ChunkSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<ChunkDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        match: {
          content: {
            query,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    if (filters?.customerId) {
      filter.push({ term: { 'metadata.customerId': filters.customerId } });
    }

    if (filters?.channel) {
      filter.push({ term: { 'metadata.channel': filters.channel } });
    }

    if (filters?.product) {
      filter.push({ term: { 'metadata.product': filters.product } });
    }

    if (filters?.category) {
      filter.push({ term: { 'metadata.category': filters.category } });
    }

    if (
      filters?.minSentiment !== undefined ||
      filters?.maxSentiment !== undefined
    ) {
      const range: any = {};
      if (filters.minSentiment !== undefined) range.gte = filters.minSentiment;
      if (filters.maxSentiment !== undefined) range.lte = filters.maxSentiment;
      filter.push({ range: { 'metadata.sentiment': range } });
    }

    if (
      filters?.minNpsScore !== undefined ||
      filters?.maxNpsScore !== undefined
    ) {
      const range: any = {};
      if (filters.minNpsScore !== undefined) range.gte = filters.minNpsScore;
      if (filters.maxNpsScore !== undefined) range.lte = filters.maxNpsScore;
      filter.push({ range: { 'metadata.npsScore': range } });
    }

    const esQuery =
      must.length > 0 || filter.length > 0
        ? {
            bool: {
              ...(must.length > 0 ? { must } : {}),
              ...(filter.length > 0 ? { filter } : {}),
            },
          }
        : { match_all: {} };

    return this.search(this.indexName, esQuery, options);
  }

  /**
   * Find chunks by communication ID
   */
  async findByCommunicationId(
    communicationId: string,
  ): Promise<ChunkDocument[]> {
    const result = await this.search(this.indexName, {
      term: { communicationId },
    });
    return result.hits.map((h) => h.source as ChunkDocument);
  }

  /**
   * Find chunks by customer ID
   */
  async findByCustomerId(customerId: string): Promise<ChunkDocument[]> {
    const result = await this.searchChunks(undefined, { customerId });
    return result.hits.map((h) => h.source as ChunkDocument);
  }

  /**
   * Semantic search using dense vector (placeholder - needs embedding)
   */
  async semanticSearch(
    embedding: number[],
    filters?: ChunkSearchFilters,
    k: number = 10,
  ): Promise<SearchResult<ChunkDocument>> {
    const filter: any[] = [];

    if (filters?.customerId) {
      filter.push({ term: { 'metadata.customerId': filters.customerId } });
    }
    if (filters?.channel) {
      filter.push({ term: { 'metadata.channel': filters.channel } });
    }
    if (filters?.product) {
      filter.push({ term: { 'metadata.product': filters.product } });
    }

    // Note: KNN search in Elasticsearch requires a different query format
    // This is a simplified implementation - full KNN would need proper setup
    const esQuery =
      filter.length > 0 ? { bool: { filter } } : { match_all: {} };
    return this.search(this.indexName, esQuery, { size: k });
  }

  /**
   * Delete all chunks
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }

  /**
   * Bulk create chunks
   */
  async bulkCreate(
    chunks: ChunkDocument[],
  ): Promise<{ created: number; failed: number }> {
    // Map chunkId to id for bulkIndex
    const chunksWithId = chunks.map((c) => ({ ...c, id: c.chunkId }));
    const results = await this.bulkIndex(chunksWithId);
    return { created: results.created, failed: results.failed };
  }
}

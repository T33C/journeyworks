/**
 * Social Mentions Repository
 *
 * Elasticsearch repository for social media mention documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

export interface SocialMentionDocument {
  id: string;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'reddit' | 'trustpilot';
  author: string;
  authorHandle: string;
  content: string;
  timestamp: string;
  sentiment: {
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
  };
  engagement: {
    likes: number;
    shares: number;
    comments: number;
  };
  url: string;
  mentionedProducts?: string[];
  tags?: string[];
  requiresResponse: boolean;
  responded: boolean;
  linkedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMentionSearchFilters {
  platform?: string;
  sentimentLabel?: string;
  requiresResponse?: boolean;
  responded?: boolean;
}

@Injectable()
export class SocialMentionsRepository extends BaseElasticsearchRepository<SocialMentionDocument> {
  protected readonly logger = new Logger(SocialMentionsRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.social') ||
      'social';
  }

  /**
   * Search social mentions with filters
   */
  async searchMentions(
    query?: string,
    filters?: SocialMentionSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<SocialMentionDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['content^2', 'author', 'authorHandle'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters?.platform) {
      filter.push({ term: { platform: filters.platform } });
    }

    if (filters?.sentimentLabel) {
      filter.push({ term: { 'sentiment.label': filters.sentimentLabel } });
    }

    if (filters?.requiresResponse !== undefined) {
      filter.push({ term: { requiresResponse: filters.requiresResponse } });
    }

    if (filters?.responded !== undefined) {
      filter.push({ term: { responded: filters.responded } });
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
   * Get mentions requiring response
   */
  async findRequiringResponse(): Promise<SocialMentionDocument[]> {
    const result = await this.search(this.indexName, {
      bool: {
        must: [
          { term: { requiresResponse: true } },
          { term: { responded: false } },
        ],
      },
    });
    return result.hits.map((h) => h.source as SocialMentionDocument);
  }

  /**
   * Get mentions by platform
   */
  async findByPlatform(platform: string): Promise<SocialMentionDocument[]> {
    const result = await this.search(this.indexName, {
      term: { platform },
    });
    return result.hits.map((h) => h.source as SocialMentionDocument);
  }

  /**
   * Delete all social mentions
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }

  /**
   * Bulk create social mentions
   */
  async bulkCreate(
    mentions: SocialMentionDocument[],
  ): Promise<{ created: number; failed: number }> {
    const results = await this.bulkIndex(mentions);
    return { created: results.created, failed: results.failed };
  }
}

/**
 * Events Repository
 *
 * Elasticsearch repository for timeline event documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

export interface EventDocument {
  id: string;
  type: 'outage' | 'launch' | 'policy_change' | 'incident' | 'promotion';
  label: string;
  description: string;
  startDate: string;
  endDate?: string;
  product?: string;
  channels?: string[];
  affectedRegions?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact?: {
    customersAffected?: number;
    communicationIncrease?: number;
    sentimentImpact?: number;
  };
  status: 'planned' | 'active' | 'resolved' | 'cancelled';
  correlatedCommunications?: number;
  sentimentDuringEvent?: number;
  source: 'manual' | 'automated' | 'external';
  createdAt: string;
  updatedAt: string;
}

export interface EventSearchFilters {
  type?: string;
  status?: string;
  severity?: string;
  product?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

@Injectable()
export class EventsRepository extends BaseElasticsearchRepository<EventDocument> {
  protected readonly logger = new Logger(EventsRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.events') ||
      'events';
  }

  /**
   * Search events with filters
   */
  async searchEvents(
    query?: string,
    filters?: EventSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<EventDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['label^2', 'description', 'product'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters?.type) {
      filter.push({ term: { type: filters.type } });
    }

    if (filters?.status) {
      filter.push({ term: { status: filters.status } });
    }

    if (filters?.severity) {
      filter.push({ term: { severity: filters.severity } });
    }

    if (filters?.product) {
      filter.push({ term: { product: filters.product } });
    }

    if (filters?.startDateFrom || filters?.startDateTo) {
      const range: any = {};
      if (filters.startDateFrom) range.gte = filters.startDateFrom;
      if (filters.startDateTo) range.lte = filters.startDateTo;
      filter.push({ range: { startDate: range } });
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
   * Find active events
   */
  async findActiveEvents(): Promise<EventDocument[]> {
    const result = await this.searchEvents(undefined, { status: 'active' });
    return result.hits.map((h) => h.source as EventDocument);
  }

  /**
   * Find events by date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<EventDocument[]> {
    const result = await this.searchEvents(undefined, {
      startDateFrom: startDate,
      startDateTo: endDate,
    });
    return result.hits.map((h) => h.source as EventDocument);
  }

  /**
   * Find events by product
   */
  async findByProduct(product: string): Promise<EventDocument[]> {
    const result = await this.searchEvents(undefined, { product });
    return result.hits.map((h) => h.source as EventDocument);
  }

  /**
   * Delete all events
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }

  /**
   * Bulk create events
   */
  async bulkCreate(
    events: EventDocument[],
  ): Promise<{ created: number; failed: number }> {
    const results = await this.bulkIndex(events);
    return { created: results.created, failed: results.failed };
  }
}

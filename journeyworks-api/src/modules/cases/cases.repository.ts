/**
 * Cases Repository
 *
 * Elasticsearch repository for case documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

export interface CaseDocument {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  product: string; // Product derived from linked communications
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
  communicationIds?: string[];
  tags?: string[];
  resolution?: string;
  metadata?: Record<string, unknown>;
}

export interface CaseSearchFilters {
  status?: string;
  priority?: string;
  category?: string;
  customerId?: string;
  assignedTo?: string;
}

@Injectable()
export class CasesRepository extends BaseElasticsearchRepository<CaseDocument> {
  protected readonly logger = new Logger(CasesRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.cases') || 'cases';
  }

  /**
   * Search cases with filters
   */
  async searchCases(
    query?: string,
    filters?: CaseSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<CaseDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^2', 'description', 'resolution', 'customerName'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters?.status) {
      filter.push({ term: { status: filters.status } });
    }

    if (filters?.priority) {
      filter.push({ term: { priority: filters.priority } });
    }

    if (filters?.category) {
      filter.push({ term: { category: filters.category } });
    }

    if (filters?.customerId) {
      filter.push({ term: { customerId: filters.customerId } });
    }

    if (filters?.assignedTo) {
      filter.push({ term: { assignedTo: filters.assignedTo } });
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
   * Get cases by customer
   */
  async findByCustomerId(customerId: string): Promise<CaseDocument[]> {
    const result = await this.search(this.indexName, {
      term: { customerId },
    });
    return result.hits.map((h) => h.source as CaseDocument);
  }

  /**
   * Get open cases
   */
  async findOpenCases(): Promise<CaseDocument[]> {
    const result = await this.search(this.indexName, {
      bool: {
        must_not: [{ terms: { status: ['resolved', 'closed'] } }],
      },
    });
    return result.hits.map((h) => h.source as CaseDocument);
  }

  /**
   * Delete all cases
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }

  /**
   * Bulk create cases
   */
  async bulkCreate(
    cases: CaseDocument[],
  ): Promise<{ created: number; failed: number }> {
    const results = await this.bulkIndex(cases);
    return { created: results.created, failed: results.failed };
  }
}

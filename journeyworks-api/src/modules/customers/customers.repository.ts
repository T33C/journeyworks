/**
 * Customers Repository
 *
 * Elasticsearch repository for customer documents.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

export interface CustomerDocument {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tier?: string;
  relationshipManager?: string;
  accountType?: string;
  portfolioValue?: number;
  riskProfile?: string;
  region?: string;
  joinedDate?: string;
  lastContactDate?: string;
  communicationPreference?: string;
  metrics?: {
    totalCommunications?: number;
    openCases?: number;
    avgSentiment?: number;
    lastSentiment?: number;
    npsScore?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSearchFilters {
  tier?: string;
  region?: string;
  riskProfile?: string;
  relationshipManager?: string;
}

@Injectable()
export class CustomersRepository extends BaseElasticsearchRepository<CustomerDocument> {
  protected readonly logger = new Logger(CustomersRepository.name);
  protected readonly indexName: string;

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.customers') ||
      'customers';
  }

  /**
   * Search customers with filters
   */
  async searchCustomers(
    query?: string,
    filters?: CustomerSearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<CustomerDocument>> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^2', 'email', 'company', 'relationshipManager'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters?.tier) {
      filter.push({ term: { tier: filters.tier } });
    }

    if (filters?.region) {
      filter.push({ term: { region: filters.region } });
    }

    if (filters?.riskProfile) {
      filter.push({ term: { riskProfile: filters.riskProfile } });
    }

    if (filters?.relationshipManager) {
      filter.push({
        term: { 'relationshipManager.keyword': filters.relationshipManager },
      });
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
   * Get customers by tier
   */
  async findByTier(tier: string): Promise<CustomerDocument[]> {
    const result = await this.search(this.indexName, {
      term: { tier },
    });
    return result.hits.map((h) => h.source as CustomerDocument);
  }

  /**
   * Get customers by region
   */
  async findByRegion(region: string): Promise<CustomerDocument[]> {
    const result = await this.search(this.indexName, {
      term: { region },
    });
    return result.hits.map((h) => h.source as CustomerDocument);
  }

  /**
   * Update a customer by ID
   */
  async updateCustomer(
    id: string,
    document: Partial<CustomerDocument>,
  ): Promise<void> {
    await this.update<CustomerDocument>(this.indexName, id, document);
  }

  /**
   * Delete a customer by ID
   */
  async deleteCustomer(id: string): Promise<boolean> {
    return this.delete(this.indexName, id);
  }

  /**
   * Delete all customers
   */
  async deleteAll(): Promise<number> {
    return this.deleteByQuery(this.indexName, {
      match_all: {},
    });
  }

  /**
   * Bulk create customers
   */
  async bulkCreate(
    customers: CustomerDocument[],
  ): Promise<{ created: number; failed: number }> {
    const results = await this.bulkIndex(customers);
    return { created: results.created, failed: results.failed };
  }
}

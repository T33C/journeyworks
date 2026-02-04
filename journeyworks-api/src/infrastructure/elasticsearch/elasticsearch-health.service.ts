/**
 * Elasticsearch Health Service
 *
 * Provides health check and index management functionality.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import { ConfigService } from '@nestjs/config';
import { INDEX_MAPPINGS } from './indices/index-registry';

export interface ElasticsearchHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  clusterName?: string;
  clusterStatus?: string;
  numberOfNodes?: number;
  indices?: Record<string, { exists: boolean; docCount: number }>;
  error?: string;
}

@Injectable()
export class ElasticsearchHealthService {
  private readonly logger = new Logger(ElasticsearchHealthService.name);

  constructor(
    private readonly esClient: ElasticsearchClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check Elasticsearch cluster health
   */
  async getHealth(): Promise<ElasticsearchHealthStatus> {
    try {
      const client = this.esClient.getClient();

      // Get cluster health
      const health = await client.cluster.health();

      // Get index info
      const indices = this.configService.get<Record<string, string>>(
        'elasticsearch.indices',
      );
      const indexStatus: Record<string, { exists: boolean; docCount: number }> =
        {};

      for (const [key, indexName] of Object.entries(indices)) {
        try {
          const exists = await client.indices.exists({ index: indexName });
          if (exists) {
            const count = await client.count({ index: indexName });
            indexStatus[key] = { exists: true, docCount: count.count };
          } else {
            indexStatus[key] = { exists: false, docCount: 0 };
          }
        } catch (e) {
          indexStatus[key] = { exists: false, docCount: 0 };
        }
      }

      return {
        status:
          health.status === 'red'
            ? 'unhealthy'
            : health.status === 'yellow'
              ? 'degraded'
              : 'healthy',
        clusterName: health.cluster_name,
        clusterStatus: health.status,
        numberOfNodes: health.number_of_nodes,
        indices: indexStatus,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Initialize all required indices
   */
  async initializeIndices(): Promise<void> {
    const client = this.esClient.getClient();
    const indices = this.configService.get<Record<string, string>>(
      'elasticsearch.indices',
    );

    for (const [key, indexName] of Object.entries(indices)) {
      await this.createIndexIfNotExists(indexName, key);
    }
  }

  /**
   * Create an index if it doesn't exist
   */
  async createIndexIfNotExists(
    indexName: string,
    mappingKey: string,
  ): Promise<boolean> {
    const client = this.esClient.getClient();

    try {
      const exists = await client.indices.exists({ index: indexName });

      if (!exists) {
        const mapping = INDEX_MAPPINGS[mappingKey];

        if (mapping) {
          await client.indices.create({
            index: indexName,
            body: mapping,
          });
          this.logger.log(`Created index: ${indexName}`);
        } else {
          this.logger.warn(`No mapping found for index key: ${mappingKey}`);
          await client.indices.create({ index: indexName });
        }
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to create index ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Delete an index (use with caution!)
   */
  async deleteIndex(indexName: string): Promise<void> {
    const client = this.esClient.getClient();

    try {
      const exists = await client.indices.exists({ index: indexName });

      if (exists) {
        await client.indices.delete({ index: indexName });
        this.logger.log(`Deleted index: ${indexName}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete index ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Refresh an index to make documents searchable immediately
   */
  async refreshIndex(indexName: string): Promise<void> {
    const client = this.esClient.getClient();
    await client.indices.refresh({ index: indexName });
  }
}

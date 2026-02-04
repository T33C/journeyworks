/**
 * Index Management Service
 *
 * Provides methods for creating, deleting, and managing Elasticsearch indices.
 * Uses the index definitions from the indices/ folder as the golden source.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  INDEX_REGISTRY,
  getAllIndexNames,
  getIndexConfig,
  IndexDefinition,
} from './indices';

export interface IndexOperationResult {
  index: string;
  success: boolean;
  message: string;
  error?: string;
}

export interface IndexStatus {
  name: string;
  exists: boolean;
  docCount?: number;
  sizeBytes?: number;
  health?: string;
  version?: string;
}

@Injectable()
export class IndexManagementService {
  private readonly logger = new Logger(IndexManagementService.name);

  constructor(private readonly esClient: ElasticsearchClientService) {}

  /**
   * Create a single index if it doesn't exist
   */
  async createIndex(
    name: string,
    force = false,
  ): Promise<IndexOperationResult> {
    const client = this.esClient.getClient();
    if (!client) {
      return {
        index: name,
        success: false,
        message: 'Elasticsearch not available',
      };
    }

    const config = getIndexConfig(name);
    if (!config) {
      return { index: name, success: false, message: `Unknown index: ${name}` };
    }

    try {
      const exists = await client.indices.exists({ index: name });

      if (exists) {
        if (force) {
          await client.indices.delete({ index: name });
          this.logger.log(`Deleted existing index: ${name}`);
        } else {
          return {
            index: name,
            success: true,
            message: 'Index already exists',
          };
        }
      }

      await client.indices.create({
        index: name,
        settings: config.settings as any,
        mappings: config.mappings as any,
      });

      this.logger.log(`Created index: ${name}`);
      return {
        index: name,
        success: true,
        message: 'Index created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create index ${name}: ${error.message}`);
      return {
        index: name,
        success: false,
        message: 'Failed to create index',
        error: error.message,
      };
    }
  }

  /**
   * Create all registered indices
   */
  async createAllIndices(force = false): Promise<IndexOperationResult[]> {
    const results: IndexOperationResult[] = [];
    const indexNames = getAllIndexNames();

    for (const name of indexNames) {
      const result = await this.createIndex(name, force);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete a single index
   */
  async deleteIndex(name: string): Promise<IndexOperationResult> {
    const client = this.esClient.getClient();
    if (!client) {
      return {
        index: name,
        success: false,
        message: 'Elasticsearch not available',
      };
    }

    try {
      const exists = await client.indices.exists({ index: name });
      if (!exists) {
        return { index: name, success: true, message: 'Index does not exist' };
      }

      await client.indices.delete({ index: name });
      this.logger.log(`Deleted index: ${name}`);
      return {
        index: name,
        success: true,
        message: 'Index deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete index ${name}: ${error.message}`);
      return {
        index: name,
        success: false,
        message: 'Failed to delete index',
        error: error.message,
      };
    }
  }

  /**
   * Delete all registered indices
   */
  async deleteAllIndices(): Promise<IndexOperationResult[]> {
    const results: IndexOperationResult[] = [];
    const indexNames = getAllIndexNames();

    for (const name of indexNames) {
      const result = await this.deleteIndex(name);
      results.push(result);
    }

    return results;
  }

  /**
   * Get status of a single index
   */
  async getIndexStatus(name: string): Promise<IndexStatus> {
    const client = this.esClient.getClient();
    if (!client) {
      return { name, exists: false };
    }

    try {
      const exists = await client.indices.exists({ index: name });
      if (!exists) {
        return { name, exists: false };
      }

      const stats = await client.indices.stats({ index: name });
      const indexStats = stats.indices?.[name];
      const definition = INDEX_REGISTRY[name];

      return {
        name,
        exists: true,
        docCount: indexStats?.primaries?.docs?.count ?? 0,
        sizeBytes: indexStats?.primaries?.store?.size_in_bytes ?? 0,
        health: 'green', // Simplified for PoC
        version: definition?.version,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get status for index ${name}: ${error.message}`,
      );
      return { name, exists: false };
    }
  }

  /**
   * Get status of all registered indices
   */
  async getAllIndicesStatus(): Promise<IndexStatus[]> {
    const indexNames = getAllIndexNames();
    const statuses: IndexStatus[] = [];

    for (const name of indexNames) {
      const status = await this.getIndexStatus(name);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Ensure all indices exist, creating missing ones
   */
  async ensureIndices(): Promise<IndexOperationResult[]> {
    const results: IndexOperationResult[] = [];
    const indexNames = getAllIndexNames();

    for (const name of indexNames) {
      const client = this.esClient.getClient();
      if (!client) {
        results.push({
          index: name,
          success: false,
          message: 'Elasticsearch not available',
        });
        continue;
      }

      const exists = await client.indices.exists({ index: name });
      if (!exists) {
        const result = await this.createIndex(name);
        results.push(result);
      } else {
        results.push({
          index: name,
          success: true,
          message: 'Index already exists',
        });
      }
    }

    return results;
  }

  /**
   * Get index definition for display/documentation
   */
  getIndexDefinition(name: string): IndexDefinition | undefined {
    return INDEX_REGISTRY[name];
  }

  /**
   * Get all index definitions
   */
  getAllIndexDefinitions(): Record<string, IndexDefinition> {
    return INDEX_REGISTRY;
  }
}

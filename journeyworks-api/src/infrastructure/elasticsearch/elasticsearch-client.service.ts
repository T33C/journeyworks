/**
 * Elasticsearch Client Service
 *
 * Manages the Elasticsearch client connection and provides access to the client.
 * Elasticsearch is optional - the API will start without it but related features
 * will return appropriate error messages.
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchClientService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ElasticsearchClientService.name);
  private client: Client | null = null;
  private isAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('elasticsearch.url');
    const username = this.configService.get<string>('elasticsearch.username');
    const password = this.configService.get<string>('elasticsearch.password');
    const optional =
      this.configService.get<boolean>('elasticsearch.optional') ?? true;

    this.logger.log(`Connecting to Elasticsearch at ${url}`);

    const clientConfig: any = {
      node: url,
      maxRetries: 3,
      requestTimeout: 10000,
      sniffOnStart: false,
    };

    // Add authentication if credentials are provided
    if (username && password) {
      clientConfig.auth = { username, password };
    }

    this.client = new Client(clientConfig);

    // Test connection
    try {
      const info = await this.client.info();
      this.logger.log(
        `Connected to Elasticsearch cluster: ${info.cluster_name}`,
      );
      this.isAvailable = true;
    } catch (error) {
      this.logger.error(`Failed to connect to Elasticsearch: ${error.message}`);
      if (optional) {
        this.logger.warn(
          'Elasticsearch is optional - API will start but search features will be unavailable',
        );
        this.client = null;
        this.isAvailable = false;
      } else {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.logger.log('Elasticsearch connection closed');
    }
  }

  /**
   * Check if Elasticsearch is available
   */
  isElasticsearchAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get the Elasticsearch client instance
   * Returns null if Elasticsearch is not available
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get the Elasticsearch client instance, throwing if unavailable
   */
  getClientOrThrow(): Client {
    if (!this.client || !this.isAvailable) {
      throw new Error(
        'Elasticsearch is not available. Please ensure Elasticsearch is running.',
      );
    }
    return this.client;
  }

  /**
   * Get index name with optional prefix
   */
  getIndexName(indexKey: string): string {
    const indices = this.configService.get<Record<string, string>>(
      'elasticsearch.indices',
    );
    return indices?.[indexKey] || indexKey;
  }

  /**
   * Get health status
   */
  getHealth(): { available: boolean; mode: 'connected' | 'unavailable' } {
    return {
      available: this.isAvailable,
      mode: this.isAvailable ? 'connected' : 'unavailable',
    };
  }
}

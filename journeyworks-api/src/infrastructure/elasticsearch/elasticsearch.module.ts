/**
 * Elasticsearch Module
 *
 * Provides Elasticsearch client and repository services for the application.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import { ElasticsearchHealthService } from './elasticsearch-health.service';
import { BaseElasticsearchRepository } from './base-elasticsearch.repository';
import { IndexManagementService } from './index-management.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ElasticsearchClientService,
    ElasticsearchHealthService,
    BaseElasticsearchRepository,
    IndexManagementService,
  ],
  exports: [
    ElasticsearchClientService,
    ElasticsearchHealthService,
    BaseElasticsearchRepository,
    IndexManagementService,
  ],
})
export class ElasticsearchModule {}

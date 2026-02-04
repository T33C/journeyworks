/**
 * Chunks Module
 */

import { Module } from '@nestjs/common';
import { ChunksService } from './chunks.service';
import { ChunksRepository } from './chunks.repository';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';

@Module({
  imports: [ElasticsearchModule],
  providers: [ChunksService, ChunksRepository],
  exports: [ChunksService, ChunksRepository],
})
export class ChunksModule {}

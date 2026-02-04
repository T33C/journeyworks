/**
 * RRG Module
 *
 * Implements Retrieval-Refined Generation for natural language to DSL conversion.
 * Converts user queries in natural language to Elasticsearch DSL queries.
 */

import { Module } from '@nestjs/common';
import { RrgService } from './rrg.service';
import { RrgController } from './rrg.controller';
import { QueryBuilder } from './query-builder.service';
import { CommunicationsModule } from '../communications';

@Module({
  imports: [CommunicationsModule],
  controllers: [RrgController],
  providers: [RrgService, QueryBuilder],
  exports: [RrgService],
})
export class RrgModule {}

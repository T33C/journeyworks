/**
 * Research Module
 *
 * Implements a ReAct agent for intelligent research across customer communications.
 * Provides LLM-powered insights using real data from Elasticsearch.
 */

import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { AgentExecutor } from './agent-executor.service';
import { AgentTools } from './agent-tools.service';
import { InsightDataService } from './insight-data.service';
import { RagModule } from '../rag';
import { RrgModule } from '../rrg';
import { AnalysisModule } from '../analysis';
import { CommunicationsModule } from '../communications';
import { LlmModule } from '../../infrastructure/llm';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';

@Module({
  imports: [
    RagModule,
    RrgModule,
    AnalysisModule,
    CommunicationsModule,
    LlmModule,
    ElasticsearchModule,
  ],
  controllers: [ResearchController],
  providers: [ResearchService, AgentExecutor, AgentTools, InsightDataService],
  exports: [ResearchService],
})
export class ResearchModule {}

/**
 * Analysis Module
 *
 * Provides LLM-powered analysis capabilities and data card generation.
 */

import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { CommunicationsModule } from '../communications';
import { EventsModule } from '../events/events.module';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';
import { SurveysModule } from '../surveys';

@Module({
  imports: [
    CommunicationsModule,
    EventsModule,
    ElasticsearchModule,
    SurveysModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}

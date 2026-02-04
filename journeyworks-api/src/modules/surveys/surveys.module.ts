/**
 * Surveys Module
 *
 * Module for NPS survey data management and aggregation.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';
import { SurveysRepository } from './surveys.repository';
import { SurveysService } from './surveys.service';

@Module({
  imports: [ConfigModule, ElasticsearchModule],
  providers: [SurveysRepository, SurveysService],
  exports: [SurveysService, SurveysRepository],
})
export class SurveysModule {}

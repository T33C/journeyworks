/**
 * Surveys Service
 *
 * Business logic for NPS survey operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  SurveysRepository,
  SurveyDocument,
  SurveySearchFilters,
  JourneyStageAggregation,
} from './surveys.repository';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(private readonly surveysRepository: SurveysRepository) {}

  /**
   * Initialize the surveys index
   */
  async initializeIndex(): Promise<void> {
    await this.surveysRepository.createIndex();
  }

  /**
   * Index a single survey
   */
  async indexSurvey(survey: SurveyDocument): Promise<void> {
    await this.surveysRepository.create(survey.id, survey);
  }

  /**
   * Bulk index surveys
   */
  async bulkIndexSurveys(surveys: SurveyDocument[]): Promise<void> {
    await this.surveysRepository.bulkIndex(
      surveys as Array<{ id: string } & SurveyDocument>,
    );
  }

  /**
   * Get journey stage aggregations for the waterfall chart
   */
  async getJourneyStages(
    filters?: SurveySearchFilters,
  ): Promise<JourneyStageAggregation[]> {
    return this.surveysRepository.aggregateByJourneyStage(filters);
  }

  /**
   * Get overall NPS metrics
   */
  async getOverallNps(filters?: SurveySearchFilters) {
    return this.surveysRepository.getOverallNps(filters);
  }

  /**
   * Search surveys with filters
   */
  async searchSurveys(
    filters?: SurveySearchFilters,
    options?: { from?: number; size?: number },
  ) {
    return this.surveysRepository.searchSurveys(filters, options);
  }

  /**
   * Delete all surveys (for reseeding)
   */
  async deleteAll(): Promise<void> {
    try {
      await this.surveysRepository.deleteAllSurveys();
      this.logger.log('Deleted all surveys');
    } catch (error) {
      this.logger.warn(`Failed to delete surveys: ${error.message}`);
    }
  }
}

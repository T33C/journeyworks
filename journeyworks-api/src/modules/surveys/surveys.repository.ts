/**
 * Surveys Repository
 *
 * Elasticsearch repository for NPS survey documents.
 * Surveys are tied to cases and track customer sentiment at each journey stage.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseElasticsearchRepository,
  SearchOptions,
  SearchResult,
} from '../../infrastructure/elasticsearch';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';

/**
 * Journey stages in the complaint resolution process
 */
export type JourneyStage =
  | 'initial-contact'
  | 'triage'
  | 'investigation'
  | 'resolution'
  | 'post-resolution';

/**
 * NPS categories based on score
 */
export type NpsCategory = 'promoter' | 'passive' | 'detractor';

/**
 * NPS Survey document stored in Elasticsearch
 */
export interface SurveyDocument {
  id: string;
  customerId: string;
  caseId: string;
  communicationId?: string; // The interaction that triggered this survey (optional)

  // Survey details
  journeyStage: JourneyStage;
  score: number; // 0-10 NPS scale
  npsCategory: NpsCategory; // Derived from score
  responded: boolean; // Whether customer actually responded (for response rate modeling)

  // Context
  channel: string; // email, phone, chat, etc.
  product: string; // mortgage, cards, loans, etc.

  // Timing
  surveyDate: string; // ISO date
  caseCreatedAt: string; // For time-based correlation

  // Optional verbatim feedback
  verbatim?: string;

  // Metadata for analysis
  eventCorrelation?: string; // ID of any event happening around this time
  metadata?: Record<string, unknown>;
}

/**
 * Filters for survey queries
 */
export interface SurveySearchFilters {
  customerId?: string;
  caseId?: string;
  journeyStage?: JourneyStage;
  npsCategory?: NpsCategory;
  channel?: string;
  product?: string;
  startDate?: Date;
  endDate?: Date;
  responded?: boolean;
}

/**
 * Aggregated journey stage data
 */
export interface JourneyStageAggregation {
  stage: JourneyStage;
  label: string;
  totalResponses: number;
  avgScore: number;
  npsScore: number; // Promoter% - Detractor%
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

@Injectable()
export class SurveysRepository extends BaseElasticsearchRepository<SurveyDocument> {
  protected readonly logger = new Logger(SurveysRepository.name);
  protected readonly indexName: string;

  // Stage order and labels for consistent display
  private readonly stageOrder: Record<
    JourneyStage,
    { order: number; label: string }
  > = {
    'initial-contact': { order: 0, label: 'Initial Contact' },
    triage: { order: 1, label: 'Triage' },
    investigation: { order: 2, label: 'Investigation' },
    resolution: { order: 3, label: 'Resolution' },
    'post-resolution': { order: 4, label: 'Post-Resolution' },
  };

  constructor(
    protected readonly esClient: ElasticsearchClientService,
    protected readonly configService: ConfigService,
  ) {
    super(esClient, configService);
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.surveys') ||
      'journeyworks_nps_surveys';
  }

  /**
   * Create the index with proper mappings
   */
  async createIndex(): Promise<void> {
    const client = this.esClient.getClient();
    if (!client) {
      this.logger.warn('ES client not available');
      return;
    }

    const exists = await client.indices.exists({ index: this.indexName });
    if (exists) {
      this.logger.log(`Index ${this.indexName} already exists`);
      return;
    }

    await client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            customerId: { type: 'keyword' },
            caseId: { type: 'keyword' },
            communicationId: { type: 'keyword' },
            journeyStage: { type: 'keyword' },
            score: { type: 'integer' },
            npsCategory: { type: 'keyword' },
            responded: { type: 'boolean' },
            channel: { type: 'keyword' },
            product: { type: 'keyword' },
            surveyDate: { type: 'date' },
            caseCreatedAt: { type: 'date' },
            verbatim: { type: 'text', analyzer: 'english' },
            eventCorrelation: { type: 'keyword' },
            metadata: { type: 'object', enabled: false },
          },
        },
      },
    });

    this.logger.log(`Created index ${this.indexName}`);
  }

  /**
   * Search surveys with filters
   */
  async searchSurveys(
    filters?: SurveySearchFilters,
    options: SearchOptions = {},
  ): Promise<SearchResult<SurveyDocument>> {
    const filter: any[] = [];

    if (filters?.customerId) {
      filter.push({ term: { customerId: filters.customerId } });
    }

    if (filters?.caseId) {
      filter.push({ term: { caseId: filters.caseId } });
    }

    if (filters?.journeyStage) {
      filter.push({ term: { journeyStage: filters.journeyStage } });
    }

    if (filters?.npsCategory) {
      filter.push({ term: { npsCategory: filters.npsCategory } });
    }

    if (filters?.channel) {
      filter.push({ term: { channel: filters.channel } });
    }

    if (filters?.product) {
      filter.push({ term: { product: filters.product } });
    }

    if (filters?.responded !== undefined) {
      filter.push({ term: { responded: filters.responded } });
    }

    if (filters?.startDate || filters?.endDate) {
      const range: any = {};
      if (filters.startDate) range.gte = filters.startDate.toISOString();
      if (filters.endDate) range.lte = filters.endDate.toISOString();
      filter.push({ range: { surveyDate: range } });
    }

    const query = filter.length > 0 ? { bool: { filter } } : { match_all: {} };

    return this.search(this.indexName, query, options);
  }

  /**
   * Aggregate surveys by journey stage for waterfall chart
   * Returns NPS metrics for each stage
   */
  async aggregateByJourneyStage(
    filters?: SurveySearchFilters,
  ): Promise<JourneyStageAggregation[]> {
    const client = this.esClient.getClient();
    if (!client) {
      this.logger.warn('ES client not available for aggregation');
      return [];
    }

    // Build filter query - only include responded surveys
    const filterClauses: any[] = [{ term: { responded: true } }];

    if (filters?.startDate || filters?.endDate) {
      const range: any = {};
      if (filters.startDate) range.gte = filters.startDate.toISOString();
      if (filters.endDate) range.lte = filters.endDate.toISOString();
      filterClauses.push({ range: { surveyDate: range } });
    }

    if (filters?.product) {
      filterClauses.push({ term: { product: filters.product } });
    }

    if (filters?.channel) {
      filterClauses.push({ term: { channel: filters.channel } });
    }

    if (filters?.caseId) {
      filterClauses.push({ term: { caseId: filters.caseId } });
    }

    try {
      const response = await client.search({
        index: this.indexName,
        body: {
          size: 0,
          query: { bool: { filter: filterClauses } },
          aggs: {
            by_stage: {
              terms: { field: 'journeyStage', size: 10 },
              aggs: {
                avg_score: { avg: { field: 'score' } },
                by_category: {
                  terms: { field: 'npsCategory', size: 3 },
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations as any)?.by_stage?.buckets || [];

      // Map buckets to stage aggregations
      const stageMap = new Map<JourneyStage, JourneyStageAggregation>();

      for (const bucket of buckets) {
        const stage = bucket.key as JourneyStage;
        const stageInfo = this.stageOrder[stage];
        if (!stageInfo) continue;

        const totalResponses = bucket.doc_count;
        const avgScore = bucket.avg_score?.value || 0;

        // Count by category
        const categoryBuckets = bucket.by_category?.buckets || [];
        let promoters = 0;
        let passives = 0;
        let detractors = 0;

        for (const cat of categoryBuckets) {
          if (cat.key === 'promoter') promoters = cat.doc_count;
          else if (cat.key === 'passive') passives = cat.doc_count;
          else if (cat.key === 'detractor') detractors = cat.doc_count;
        }

        const promoterPct =
          totalResponses > 0 ? (promoters / totalResponses) * 100 : 0;
        const passivePct =
          totalResponses > 0 ? (passives / totalResponses) * 100 : 0;
        const detractorPct =
          totalResponses > 0 ? (detractors / totalResponses) * 100 : 0;
        const npsScore = Math.round(promoterPct - detractorPct);

        stageMap.set(stage, {
          stage,
          label: stageInfo.label,
          totalResponses,
          avgScore: Math.round(avgScore * 10) / 10,
          npsScore,
          promoterPct: Math.round(promoterPct),
          passivePct: Math.round(passivePct),
          detractorPct: Math.round(detractorPct),
        });
      }

      // Return stages in order, filling in missing ones with zeros
      const result: JourneyStageAggregation[] = [];
      const stages: JourneyStage[] = [
        'initial-contact',
        'triage',
        'investigation',
        'resolution',
        'post-resolution',
      ];

      for (const stage of stages) {
        const data = stageMap.get(stage);
        if (data) {
          result.push(data);
        } else {
          // No data for this stage - return empty
          result.push({
            stage,
            label: this.stageOrder[stage].label,
            totalResponses: 0,
            avgScore: 0,
            npsScore: 0,
            promoterPct: 0,
            passivePct: 0,
            detractorPct: 0,
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to aggregate surveys: ${error.message}`);
      return [];
    }
  }

  /**
   * Get overall NPS summary for a time period
   */
  async getOverallNps(filters?: SurveySearchFilters): Promise<{
    npsScore: number;
    totalResponses: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
    responseRate: number;
  }> {
    const client = this.esClient.getClient();
    if (!client) {
      return {
        npsScore: 0,
        totalResponses: 0,
        promoterPct: 0,
        passivePct: 0,
        detractorPct: 0,
        responseRate: 0,
      };
    }

    const filterClauses: any[] = [];

    if (filters?.startDate || filters?.endDate) {
      const range: any = {};
      if (filters.startDate) range.gte = filters.startDate.toISOString();
      if (filters.endDate) range.lte = filters.endDate.toISOString();
      filterClauses.push({ range: { surveyDate: range } });
    }

    if (filters?.product) {
      filterClauses.push({ term: { product: filters.product } });
    }

    if (filters?.channel) {
      filterClauses.push({ term: { channel: filters.channel } });
    }

    try {
      const response = await client.search({
        index: this.indexName,
        body: {
          size: 0,
          query:
            filterClauses.length > 0
              ? { bool: { filter: filterClauses } }
              : { match_all: {} },
          aggs: {
            total_sent: { value_count: { field: 'id' } },
            responded: {
              filter: { term: { responded: true } },
              aggs: {
                by_category: { terms: { field: 'npsCategory', size: 3 } },
              },
            },
          },
        },
      });

      const aggs = response.aggregations as any;
      const totalSent = aggs?.total_sent?.value || 0;
      const respondedAgg = aggs?.responded;
      const totalResponded = respondedAgg?.doc_count || 0;

      let promoters = 0;
      let passives = 0;
      let detractors = 0;

      const categoryBuckets = respondedAgg?.by_category?.buckets || [];
      for (const cat of categoryBuckets) {
        if (cat.key === 'promoter') promoters = cat.doc_count;
        else if (cat.key === 'passive') passives = cat.doc_count;
        else if (cat.key === 'detractor') detractors = cat.doc_count;
      }

      const promoterPct =
        totalResponded > 0 ? (promoters / totalResponded) * 100 : 0;
      const passivePct =
        totalResponded > 0 ? (passives / totalResponded) * 100 : 0;
      const detractorPct =
        totalResponded > 0 ? (detractors / totalResponded) * 100 : 0;
      const npsScore = Math.round(promoterPct - detractorPct);
      const responseRate =
        totalSent > 0 ? (totalResponded / totalSent) * 100 : 0;

      return {
        npsScore,
        totalResponses: totalResponded,
        promoterPct: Math.round(promoterPct),
        passivePct: Math.round(passivePct),
        detractorPct: Math.round(detractorPct),
        responseRate: Math.round(responseRate),
      };
    } catch (error) {
      this.logger.error(`Failed to get overall NPS: ${error.message}`);
      return {
        npsScore: 0,
        totalResponses: 0,
        promoterPct: 0,
        passivePct: 0,
        detractorPct: 0,
        responseRate: 0,
      };
    }
  }

  /**
   * Delete all surveys (for reseeding)
   */
  async deleteAllSurveys(): Promise<number> {
    return this.deleteByQuery(this.indexName, { match_all: {} });
  }
}

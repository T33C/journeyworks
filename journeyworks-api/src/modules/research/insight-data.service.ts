/**
 * Insight Data Service
 *
 * Retrieves real data from Elasticsearch for LLM-powered insight generation.
 * Provides methods to fetch relevant communications, social mentions, events,
 * and aggregated metrics based on the analysis context.
 */

import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';
import { AnalysisContext, InsightEvidence } from './research.types';
import { AnalysisService } from '../analysis/analysis.service';

export interface TimeSeriesDataPoint {
  date: string;
  sentimentAvg: number;
  npsAvg: number;
  volume: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

export interface ResolutionJourneyStage {
  stage: string;
  label: string;
  avgSentiment: number;
  avgNps: number;
  communicationCount: number;
  avgResolutionDays: number;
  promoterConversionRate: number;
}

export interface EventCorrelation {
  eventId: string;
  eventType: string;
  eventLabel: string;
  eventDate: string;
  severity: string;
  beforeMetrics: {
    avgSentiment: number;
    avgNps: number;
    volume: number;
  };
  duringMetrics: {
    avgSentiment: number;
    avgNps: number;
    volume: number;
  };
  afterMetrics: {
    avgSentiment: number;
    avgNps: number;
    volume: number;
  };
  sentimentDelta: number;
  npsDelta: number;
}

export interface AggregatedInsightData {
  communications: InsightEvidence[];
  socialMentions: InsightEvidence[];
  timeSeries: TimeSeriesDataPoint[];
  resolutionJourney: ResolutionJourneyStage[];
  eventCorrelations: EventCorrelation[];
  summary: {
    totalCommunications: number;
    totalSocialMentions: number;
    avgSentiment: number;
    avgNps: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
    topThemes: Array<{ theme: string; count: number }>;
    topProducts: Array<{ product: string; count: number }>;
  };
}

// Map UI product names to Elasticsearch product names
const PRODUCT_NAME_MAP: Record<string, string> = {
  cards: 'credit-card',
  payments: 'online-banking',
  loans: 'personal-loan',
  savings: 'savings-account',
  current: 'current-account',
  mortgage: 'mortgage',
  insurance: 'insurance',
  mobile: 'mobile-app',
  app: 'mobile-app',
};

@Injectable()
export class InsightDataService {
  private readonly logger = new Logger(InsightDataService.name);

  /**
   * Normalize product name from UI to ES format
   */
  private normalizeProduct(product: string | undefined): string | undefined {
    if (!product) return undefined;
    const normalized = product.toLowerCase();
    return PRODUCT_NAME_MAP[normalized] || product;
  }

  constructor(
    private readonly esClient: ElasticsearchClientService,
    @Inject(forwardRef(() => AnalysisService))
    private readonly analysisService: AnalysisService,
  ) {}

  /**
   * Get all aggregated data needed for insight generation
   */
  async getInsightData(
    context: AnalysisContext,
  ): Promise<AggregatedInsightData> {
    // Use bubble volume as limit if available and small, otherwise default to 10
    const evidenceLimit =
      context.selectedBubble?.volume && context.selectedBubble.volume <= 15
        ? context.selectedBubble.volume
        : 10;

    const [
      communications,
      socialMentions,
      timeSeries,
      resolutionJourney,
      eventCorrelations,
      summary,
    ] = await Promise.all([
      this.getRelevantCommunications(context, evidenceLimit),
      this.getRelevantSocialMentions(context, 5),
      this.getTimeSeriesMetrics(context),
      this.getResolutionJourney(context),
      this.getEventCorrelations(context),
      this.getSummaryMetrics(context),
    ]);

    return {
      communications,
      socialMentions,
      timeSeries,
      resolutionJourney,
      eventCorrelations,
      summary,
    };
  }

  /**
   * Get relevant communications based on context
   * Returns actual excerpts with document IDs for drill-down
   */
  async getRelevantCommunications(
    context: AnalysisContext,
    limit: number = 10,
  ): Promise<InsightEvidence[]> {
    const client = this.esClient.getClient();
    if (!client) {
      this.logger.warn('Elasticsearch client not available');
      return [];
    }

    const must: any[] = [];
    const filter: any[] = [];

    // DEBUG: Log incoming context
    this.logger.debug(
      `getRelevantCommunications context: timeWindow=${JSON.stringify(context.timeWindow)}, product=${context.product}, channel=${context.channel}, selectedBubble=${!!context.selectedBubble}, event=${JSON.stringify(context.event)}`,
    );

    // Build query based on context
    if (context.timeWindow) {
      filter.push({
        range: {
          timestamp: {
            gte: context.timeWindow.start,
            lte: context.timeWindow.end,
          },
        },
      });
    }

    // For bubble clicks: DON'T filter by product/channel because bubble volume
    // represents ALL communications for that day (product/channel are just the top ones)
    // Only apply product/channel filters for non-bubble contexts (events, quadrants, etc.)
    if (!context.selectedBubble) {
      if (context.product) {
        const normalizedProduct = this.normalizeProduct(context.product);
        this.logger.debug(
          `Product mapping: "${context.product}" -> "${normalizedProduct}"`,
        );
        if (normalizedProduct) {
          filter.push({
            term: { 'aiClassification.product.keyword': normalizedProduct },
          });
        }
      }

      if (context.channel) {
        this.logger.debug(`Channel filter: "${context.channel}"`);
        filter.push({
          term: { 'channel.keyword': context.channel },
        });
      }
    } else {
      this.logger.debug(
        'Bubble selected - skipping product/channel filters to match bubble volume',
      );
    }

    // Note: We intentionally do NOT filter by themes/categories here
    // The bubble volume counts ALL communications for the day, so evidence should match
    // Themes are used for display/context but not for filtering evidence

    if (context.event) {
      // Get communications around the event date (±3 days)
      const eventDate = new Date(context.event.date);
      const isValidDate = !isNaN(eventDate.getTime());
      this.logger.debug(
        `Event date parsing: input="${context.event.date}", parsed=${isValidDate ? eventDate.toISOString() : 'Invalid'}, valid=${isValidDate}`,
      );
      if (isValidDate) {
        const startDate = new Date(eventDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(eventDate);
        endDate.setDate(endDate.getDate() + 7);

        this.logger.debug(
          `Event date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
        );
        filter.push({
          range: {
            timestamp: {
              gte: startDate.toISOString(),
              lte: endDate.toISOString(),
            },
          },
        });
      }

      // If event has product info, filter by it
      if (context.event.product) {
        const normalizedProduct = this.normalizeProduct(context.event.product);
        this.logger.debug(
          `Event product mapping: "${context.event.product}" -> "${normalizedProduct}"`,
        );
        if (normalizedProduct) {
          filter.push({
            term: { 'aiClassification.product.keyword': normalizedProduct },
          });
        }
      }
    }

    // Prioritize negative sentiment for insight relevance
    const query: any = {
      bool: {
        must: must.length ? must : [{ match_all: {} }],
        filter,
        should: [
          { range: { 'sentiment.score': { lte: -0.3 } } }, // Boost negative
        ],
      },
    };

    // DEBUG: Log the actual query
    this.logger.debug(`ES Query: ${JSON.stringify(query)}`);

    try {
      const response = await client.search({
        index: 'journeyworks_communications',
        body: {
          query,
          size: limit,
          sort: [
            { _score: { order: 'desc' } },
            { 'sentiment.score': { order: 'asc' } }, // Most negative first
            { timestamp: { order: 'desc' } },
          ] as any,
          _source: [
            'id',
            'channel',
            'content',
            'subject',
            'timestamp',
            'sentiment',
            'aiClassification',
            'customerId',
          ],
        },
      });

      const hits = response.hits?.hits || [];
      this.logger.debug(
        `ES Response: found ${hits.length} communications (total: ${(response.hits as any)?.total?.value || 0})`,
      );
      return hits.map((hit: any) => this.mapCommunicationToEvidence(hit));
    } catch (error) {
      this.logger.error(`Failed to get communications: ${error.message}`);
      return [];
    }
  }

  /**
   * Get relevant social mentions based on context
   */
  async getRelevantSocialMentions(
    context: AnalysisContext,
    limit: number = 5,
  ): Promise<InsightEvidence[]> {
    const client = this.esClient.getClient();
    if (!client) {
      return [];
    }

    const filter: any[] = [];

    if (context.timeWindow) {
      filter.push({
        range: {
          timestamp: {
            gte: context.timeWindow.start,
            lte: context.timeWindow.end,
          },
        },
      });
    }

    if (context.event) {
      const eventDate = new Date(context.event.date);
      if (!isNaN(eventDate.getTime())) {
        const startDate = new Date(eventDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(eventDate);
        endDate.setDate(endDate.getDate() + 7);

        filter.push({
          range: {
            timestamp: {
              gte: startDate.toISOString(),
              lte: endDate.toISOString(),
            },
          },
        });
      }
    }

    try {
      const response = await client.search({
        index: 'journeyworks_social',
        body: {
          query: {
            bool: {
              filter,
              should: [
                { range: { 'sentiment.score': { lte: -0.3 } } },
                { range: { 'engagement.shares': { gte: 10 } } }, // High engagement
              ],
            },
          },
          size: limit,
          sort: [
            { 'engagement.shares': 'desc' },
            { 'sentiment.score': 'asc' },
            { timestamp: 'desc' },
          ],
          _source: [
            'id',
            'platform',
            'content',
            'timestamp',
            'sentiment',
            'engagement',
            'authorHandle',
          ],
        },
      });

      const hits = response.hits?.hits || [];
      return hits.map((hit: any) => this.mapSocialToEvidence(hit));
    } catch (error) {
      this.logger.error(`Failed to get social mentions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get time series metrics for trend analysis
   */
  async getTimeSeriesMetrics(
    context: AnalysisContext,
  ): Promise<TimeSeriesDataPoint[]> {
    const client = this.esClient.getClient();
    if (!client) {
      return [];
    }

    const filter: any[] = [];

    // Default to last 30 days if no time window specified
    const endDate = context.timeWindow?.end || new Date().toISOString();
    const startDate =
      context.timeWindow?.start ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    filter.push({
      range: {
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    if (context.product) {
      const normalizedProduct = this.normalizeProduct(context.product);
      if (normalizedProduct) {
        filter.push({
          term: { 'aiClassification.product.keyword': normalizedProduct },
        });
      }
    }

    try {
      const response = await client.search({
        index: 'journeyworks_communications',
        body: {
          query: { bool: { filter } },
          size: 0,
          aggs: {
            daily: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: 'day',
              },
              aggs: {
                avg_sentiment: { avg: { field: 'sentiment.score' } },
                nps_distribution: {
                  range: {
                    field: 'sentiment.score',
                    ranges: [
                      { key: 'detractor', to: -0.3 },
                      { key: 'passive', from: -0.3, to: 0.3 },
                      { key: 'promoter', from: 0.3 },
                    ],
                  },
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations as any)?.daily?.buckets || [];
      return buckets.map((bucket: any) => {
        const total = bucket.doc_count || 1;
        const nps = bucket.nps_distribution?.buckets || {};
        const detractorCount =
          nps.find?.((b: any) => b.key === 'detractor')?.doc_count || 0;
        const passiveCount =
          nps.find?.((b: any) => b.key === 'passive')?.doc_count || 0;
        const promoterCount =
          nps.find?.((b: any) => b.key === 'promoter')?.doc_count || 0;

        return {
          date: bucket.key_as_string,
          sentimentAvg: bucket.avg_sentiment?.value || 0,
          npsAvg: this.calculateNpsFromDistribution(
            promoterCount,
            passiveCount,
            detractorCount,
          ),
          volume: total,
          promoterPct: (promoterCount / total) * 100,
          passivePct: (passiveCount / total) * 100,
          detractorPct: (detractorCount / total) * 100,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get time series: ${error.message}`);
      return [];
    }
  }

  /**
   * Get resolution journey metrics (most important for CX improvement analysis)
   * Uses the same journey stages as the chart for consistency
   */
  async getResolutionJourney(
    context: AnalysisContext,
  ): Promise<ResolutionJourneyStage[]> {
    try {
      // Use AnalysisService to get the same journey data as the chart
      // This ensures insights match what's displayed in the UI
      const filter: { startDate?: Date; endDate?: Date; product?: string } = {};

      if (context.timeWindow) {
        // Convert string dates to Date objects
        filter.startDate = new Date(context.timeWindow.start);
        filter.endDate = new Date(context.timeWindow.end);
      }
      if (context.product) {
        filter.product = context.product;
      }

      const journeyStages = await this.analysisService.getJourneyStages(filter);

      // Convert JourneyStage[] to ResolutionJourneyStage[]
      return journeyStages.map((stage) => ({
        stage: stage.stage,
        label: stage.label,
        avgSentiment: stage.sentiment,
        avgNps: stage.npsScore,
        communicationCount: stage.communications,
        avgResolutionDays: stage.stage === 'resolution' ? 5 : 0,
        promoterConversionRate: stage.promoterPct,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get resolution journey from AnalysisService: ${error.message}`,
      );
      return this.getDefaultResolutionJourney();
    }
  }

  /**
   * Legacy method - kept for reference but no longer used
   * The old approach tried to query ES for sentimentJourney data that doesn't exist
   */
  private async getLegacyResolutionJourney(
    context: AnalysisContext,
  ): Promise<ResolutionJourneyStage[]> {
    const client = this.esClient.getClient();
    if (!client) {
      return this.getDefaultResolutionJourney();
    }

    try {
      // Query cases with sentiment journey data
      const response = await client.search({
        index: 'journeyworks_cases',
        body: {
          query: {
            bool: {
              filter: [
                { exists: { field: 'sentimentJourney' } },
                ...(context.product
                  ? [
                      {
                        term: {
                          product: this.normalizeProduct(context.product),
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
          size: 100,
          _source: [
            'id',
            'status',
            'sentimentJourney',
            'createdAt',
            'resolvedAt',
          ],
        },
      });

      const hits = response.hits?.hits || [];
      if (hits.length === 0) {
        return this.getDefaultResolutionJourney();
      }

      // Aggregate by journey stage
      const stageData = new Map<
        string,
        {
          sentiments: number[];
          npses: number[];
          counts: number[];
          resolutionDays: number[];
        }
      >();

      const stages = [
        'initial-contact',
        'triage',
        'investigation',
        'resolution',
        'post-resolution',
      ];
      stages.forEach((stage) => {
        stageData.set(stage, {
          sentiments: [],
          npses: [],
          counts: [],
          resolutionDays: [],
        });
      });

      for (const hit of hits) {
        const doc = hit._source as any;
        const journey = doc.sentimentJourney || [];

        for (const entry of journey) {
          const data = stageData.get(entry.stage);
          if (data) {
            data.sentiments.push(entry.sentiment || 0);
            data.npses.push(this.sentimentToNps(entry.sentiment || 0));
            data.counts.push(entry.communicationCount || 1);
          }
        }

        // Calculate resolution time
        if (doc.resolvedAt && doc.createdAt) {
          const resolutionDays =
            (new Date(doc.resolvedAt).getTime() -
              new Date(doc.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          stageData.get('resolution')?.resolutionDays.push(resolutionDays);
        }
      }

      return stages.map((stage) => {
        const data = stageData.get(stage)!;
        const avgSentiment = this.average(data.sentiments);
        const avgNps = this.average(data.npses);

        return {
          stage,
          label: this.formatStageLabel(stage),
          avgSentiment,
          avgNps,
          communicationCount: data.counts.reduce((a, b) => a + b, 0),
          avgResolutionDays: this.average(data.resolutionDays),
          promoterConversionRate: this.calculatePromoterConversion(
            data.sentiments,
          ),
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get resolution journey: ${error.message}`);
      return this.getDefaultResolutionJourney();
    }
  }

  /**
   * Get event correlations for before/after analysis
   */
  async getEventCorrelations(
    context: AnalysisContext,
  ): Promise<EventCorrelation[]> {
    const client = this.esClient.getClient();
    if (!client) {
      return [];
    }

    // If a specific event is selected, analyze that one
    if (context.event) {
      return [
        await this.analyzeEventCorrelation(
          context.event.id,
          context.event.date,
        ),
      ];
    }

    // Otherwise get recent significant events
    try {
      const response = await client.search({
        index: 'journeyworks_events',
        body: {
          query: {
            bool: {
              filter: [
                { terms: { severity: ['high', 'critical'] } },
                {
                  range: {
                    startDate: {
                      gte: new Date(
                        Date.now() - 90 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                    },
                  },
                },
              ],
            },
          },
          size: 5,
          sort: [{ startDate: 'desc' }],
        },
      });

      const hits = response.hits?.hits || [];
      const correlations = await Promise.all(
        hits.map((hit: any) =>
          this.analyzeEventCorrelation(hit._source.id, hit._source.startDate),
        ),
      );

      return correlations.filter((c) => c !== null) as EventCorrelation[];
    } catch (error) {
      this.logger.error(`Failed to get event correlations: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze correlation for a specific event
   */
  private async analyzeEventCorrelation(
    eventId: string,
    eventDate: string,
  ): Promise<EventCorrelation> {
    const client = this.esClient.getClient();

    // Get event details
    let eventDoc: any = null;
    try {
      const eventResponse = await client!.get({
        index: 'journeyworks_events',
        id: eventId,
      });
      eventDoc = eventResponse._source;
    } catch {
      // Event not found, use minimal info
      eventDoc = { id: eventId, type: 'unknown', label: eventId };
    }

    const date = new Date(eventDate);
    if (isNaN(date.getTime())) {
      // Return empty correlation if date is invalid
      return {
        eventId,
        eventType: eventDoc?.type || 'unknown',
        eventLabel: eventDoc?.label || eventId,
        eventDate,
        severity: eventDoc?.severity || 'medium',
        beforeMetrics: { avgSentiment: 0, avgNps: 0, volume: 0 },
        duringMetrics: { avgSentiment: 0, avgNps: 0, volume: 0 },
        afterMetrics: { avgSentiment: 0, avgNps: 0, volume: 0 },
        sentimentDelta: 0,
        npsDelta: 0,
      };
    }

    const beforeStart = new Date(date);
    beforeStart.setDate(beforeStart.getDate() - 7);
    const beforeEnd = new Date(date);
    beforeEnd.setDate(beforeEnd.getDate() - 1);

    const duringStart = new Date(date);
    const duringEnd = new Date(date);
    duringEnd.setDate(duringEnd.getDate() + 3);

    const afterStart = new Date(duringEnd);
    afterStart.setDate(afterStart.getDate() + 1);
    const afterEnd = new Date(afterStart);
    afterEnd.setDate(afterEnd.getDate() + 7);

    const [beforeMetrics, duringMetrics, afterMetrics] = await Promise.all([
      this.getMetricsForPeriod(
        beforeStart.toISOString(),
        beforeEnd.toISOString(),
      ),
      this.getMetricsForPeriod(
        duringStart.toISOString(),
        duringEnd.toISOString(),
      ),
      this.getMetricsForPeriod(
        afterStart.toISOString(),
        afterEnd.toISOString(),
      ),
    ]);

    return {
      eventId,
      eventType: eventDoc?.type || 'unknown',
      eventLabel: eventDoc?.label || eventId,
      eventDate,
      severity: eventDoc?.severity || 'medium',
      beforeMetrics,
      duringMetrics,
      afterMetrics,
      sentimentDelta: afterMetrics.avgSentiment - beforeMetrics.avgSentiment,
      npsDelta: afterMetrics.avgNps - beforeMetrics.avgNps,
    };
  }

  /**
   * Get metrics for a specific time period
   */
  private async getMetricsForPeriod(
    startDate: string,
    endDate: string,
  ): Promise<{ avgSentiment: number; avgNps: number; volume: number }> {
    const client = this.esClient.getClient();
    if (!client) {
      return { avgSentiment: 0, avgNps: 0, volume: 0 };
    }

    try {
      const response = await client.search({
        index: 'journeyworks_communications',
        body: {
          query: {
            range: { timestamp: { gte: startDate, lte: endDate } },
          },
          size: 0,
          aggs: {
            avg_sentiment: { avg: { field: 'sentiment.score' } },
          },
        },
      });

      const total = (response.hits as any)?.total?.value || 0;
      const avgSentiment =
        (response.aggregations as any)?.avg_sentiment?.value || 0;

      return {
        avgSentiment,
        avgNps: this.sentimentToNps(avgSentiment),
        volume: total,
      };
    } catch (error) {
      this.logger.error(`Failed to get period metrics: ${error.message}`);
      return { avgSentiment: 0, avgNps: 0, volume: 0 };
    }
  }

  /**
   * Get summary metrics for the context
   */
  private async getSummaryMetrics(
    context: AnalysisContext,
  ): Promise<AggregatedInsightData['summary']> {
    const client = this.esClient.getClient();
    if (!client) {
      return this.getDefaultSummary();
    }

    const filter: any[] = [];

    if (context.timeWindow) {
      filter.push({
        range: {
          timestamp: {
            gte: context.timeWindow.start,
            lte: context.timeWindow.end,
          },
        },
      });
    }

    if (context.product) {
      const normalizedProduct = this.normalizeProduct(context.product);
      if (normalizedProduct) {
        filter.push({
          term: { 'aiClassification.product.keyword': normalizedProduct },
        });
      }
    }

    try {
      const response = await client.search({
        index: 'journeyworks_communications',
        body: {
          query: {
            bool: { filter: filter.length ? filter : [{ match_all: {} }] },
          },
          size: 0,
          aggs: {
            avg_sentiment: { avg: { field: 'sentiment.score' } },
            sentiment_distribution: {
              range: {
                field: 'sentiment.score',
                ranges: [
                  { key: 'detractor', to: -0.3 },
                  { key: 'passive', from: -0.3, to: 0.3 },
                  { key: 'promoter', from: 0.3 },
                ],
              },
            },
            top_categories: {
              terms: { field: 'aiClassification.category.keyword', size: 5 },
            },
            top_products: {
              terms: { field: 'aiClassification.product.keyword', size: 5 },
            },
          },
        },
      });

      const total = (response.hits as any)?.total?.value || 0;
      const aggs = response.aggregations as any;
      const avgSentiment = aggs?.avg_sentiment?.value || 0;

      const distBuckets = aggs?.sentiment_distribution?.buckets || [];
      const detractorCount =
        distBuckets.find((b: any) => b.key === 'detractor')?.doc_count || 0;
      const passiveCount =
        distBuckets.find((b: any) => b.key === 'passive')?.doc_count || 0;
      const promoterCount =
        distBuckets.find((b: any) => b.key === 'promoter')?.doc_count || 0;

      // Get social count
      let socialCount = 0;
      try {
        const socialResponse = await client.count({
          index: 'journeyworks_social',
          body: {
            query: {
              bool: { filter: filter.length ? filter : [{ match_all: {} }] },
            },
          },
        });
        socialCount = socialResponse.count || 0;
      } catch {
        // Ignore social count error
      }

      return {
        totalCommunications: total,
        totalSocialMentions: socialCount,
        avgSentiment,
        avgNps: this.calculateNpsFromDistribution(
          promoterCount,
          passiveCount,
          detractorCount,
        ),
        promoterPct: total > 0 ? (promoterCount / total) * 100 : 0,
        passivePct: total > 0 ? (passiveCount / total) * 100 : 0,
        detractorPct: total > 0 ? (detractorCount / total) * 100 : 0,
        topThemes: (aggs?.top_categories?.buckets || []).map((b: any) => ({
          theme: b.key,
          count: b.doc_count,
        })),
        topProducts: (aggs?.top_products?.buckets || []).map((b: any) => ({
          product: b.key,
          count: b.doc_count,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get summary metrics: ${error.message}`);
      return this.getDefaultSummary();
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private mapCommunicationToEvidence(hit: any): InsightEvidence {
    const source = hit._source;
    const content = source.content || source.subject || '';
    const excerpt =
      content.length > 200 ? content.substring(0, 200) + '...' : content;

    return {
      id: source.id,
      type: this.mapChannelToEvidenceType(source.channel),
      source: this.formatSource(
        source.channel,
        source.aiClassification?.category,
      ),
      timestamp: source.timestamp,
      excerpt,
      sentiment: source.sentiment?.score || 0,
      linkedChartId: source.id, // Use document ID for drill-down
    };
  }

  private mapSocialToEvidence(hit: any): InsightEvidence {
    const source = hit._source;
    const content = source.content || '';
    const excerpt =
      content.length > 200 ? content.substring(0, 200) + '...' : content;

    return {
      id: source.id,
      type: 'social',
      source: this.formatPlatform(source.platform, source.authorHandle),
      timestamp: source.timestamp,
      excerpt,
      sentiment: source.sentiment?.score || 0,
      linkedChartId: source.id,
    };
  }

  private mapChannelToEvidenceType(
    channel: string,
  ): 'complaint' | 'social' | 'call' | 'news' {
    switch (channel) {
      case 'phone':
        return 'call';
      case 'social':
        return 'social';
      default:
        return 'complaint';
    }
  }

  private formatSource(channel: string, category?: string): string {
    const channelNames: Record<string, string> = {
      email: 'Email',
      phone: 'Call Centre',
      chat: 'Live Chat',
      letter: 'Written Correspondence',
      social: 'Social Media',
    };
    const base = channelNames[channel] || channel;
    return category ? `${base} - ${category}` : base;
  }

  private formatPlatform(platform: string, handle?: string): string {
    const platformNames: Record<string, string> = {
      twitter: 'Twitter/X',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      reddit: 'Reddit',
      trustpilot: 'Trustpilot',
    };
    const name = platformNames[platform] || platform;
    return handle ? `${name} (@${handle})` : name;
  }

  private formatStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'initial-contact': 'Initial Contact',
      triage: 'Triage',
      investigation: 'Investigation',
      resolution: 'Resolution',
      'post-resolution': 'Post-Resolution',
    };
    return labels[stage] || stage;
  }

  private sentimentToNps(sentiment: number): number {
    // Map sentiment (-1 to 1) to NPS (-100 to 100)
    return Math.round(sentiment * 100);
  }

  private calculateNpsFromDistribution(
    promoters: number,
    passives: number,
    detractors: number,
  ): number {
    const total = promoters + passives + detractors;
    if (total === 0) return 0;
    return Math.round(((promoters - detractors) / total) * 100);
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private calculatePromoterConversion(sentiments: number[]): number {
    if (sentiments.length < 2) return 0;
    const initialNegative = sentiments.filter((s) => s < -0.3).length;
    const finalPositive = sentiments.filter((s) => s > 0.3).length;
    if (initialNegative === 0) return 0;
    return (finalPositive / initialNegative) * 100;
  }

  private getDefaultResolutionJourney(): ResolutionJourneyStage[] {
    // Default journey shows problematic outcomes to highlight areas for improvement
    // This matches the updated analysis.service journey patterns
    return [
      {
        stage: 'initial-contact',
        label: 'Initial Contact',
        avgSentiment: -0.35,
        avgNps: -32,
        communicationCount: 0,
        avgResolutionDays: 0,
        promoterConversionRate: 0,
      },
      {
        stage: 'triage',
        label: 'Triage',
        avgSentiment: -0.48,
        avgNps: -48,
        communicationCount: 0,
        avgResolutionDays: 0,
        promoterConversionRate: 0,
      },
      {
        stage: 'investigation',
        label: 'Investigation',
        avgSentiment: -0.55,
        avgNps: -55,
        communicationCount: 0,
        avgResolutionDays: 0,
        promoterConversionRate: 0,
      },
      {
        stage: 'resolution',
        label: 'Resolution',
        avgSentiment: -0.42,
        avgNps: -38,
        communicationCount: 0,
        avgResolutionDays: 5,
        promoterConversionRate: 14,
      },
      {
        stage: 'post-resolution',
        label: 'Post-Resolution',
        avgSentiment: -0.28,
        avgNps: -22,
        communicationCount: 0,
        avgResolutionDays: 0,
        promoterConversionRate: 18,
      },
    ];
  }

  private getDefaultSummary(): AggregatedInsightData['summary'] {
    return {
      totalCommunications: 0,
      totalSocialMentions: 0,
      avgSentiment: 0,
      avgNps: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      topThemes: [],
      topProducts: [],
    };
  }
}

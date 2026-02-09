/**
 * Analysis Service
 *
 * Provides LLM-powered analysis capabilities for customer communications.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { AnalysisServiceClient } from '../../infrastructure/analysis-service';
import { RedisCacheService } from '../../infrastructure/redis';
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';
import { CommunicationsService } from '../communications/communications.service';
import { EventsRepository } from '../events/events.repository';
import { SurveysService } from '../surveys/surveys.service';
import {
  AnalysisRequest,
  AnalysisResult,
  AnalysisType,
  CustomerHealthAnalysis,
  RiskAssessment,
  CommunicationPatternAnalysis,
  DataCard,
  Insight,
  TimelineEvent,
  SentimentBubble,
  JourneyStage,
  QuadrantItem,
} from './analysis.types';
import {
  findProductByTerm,
  PRODUCTS_BY_CATEGORY,
  ProductCategory,
} from '../synthetic/data/products';

/**
 * Configuration constants for analysis operations.
 * Centralizes magic numbers for maintainability and clarity.
 */
const ANALYSIS_CONFIG = {
  /** Default number of communications to analyze if not specified */
  DEFAULT_LIMIT: 100,
  /** Maximum allowed limit to prevent resource exhaustion */
  MAX_LIMIT: 1000,
  /** Number of sample communications for LLM sentiment analysis */
  SENTIMENT_SAMPLE_SIZE: 10,
  /** Number of sample communications for LLM topic analysis */
  TOPIC_SAMPLE_SIZE: 5,
  /** Number of high-risk communications to sample for risk assessment */
  RISK_SAMPLE_SIZE: 15,
  /** Number of issue communications to sample for issue detection */
  ISSUE_SAMPLE_SIZE: 10,
  /** Maximum number of topics to display */
  MAX_TOPICS_DISPLAY: 10,
  /** Maximum number of topics to analyze */
  MAX_TOPICS_ANALYZE: 20,
  /** Maximum content length for LLM analysis (characters) */
  MAX_CONTENT_LENGTH: 300,
  /** Shorter content length for summaries */
  SHORT_CONTENT_LENGTH: 200,
  /** Number of recent communications to consider for trend */
  TREND_RECENT_COUNT: 10,
  /** Number of older communications for comparison */
  TREND_COMPARISON_COUNT: 20,
  /** Number of days for recent volume trend calculation */
  TREND_RECENT_DAYS: 7,
  /** Number of days for previous volume trend calculation */
  TREND_PREVIOUS_DAYS: 14,
  /** Maximum recommendations to return */
  MAX_RECOMMENDATIONS: 5,
  /** Maximum insights to extract from plain text fallback */
  MAX_FALLBACK_INSIGHTS: 5,
  /** Threshold for increasing trend detection */
  TREND_INCREASE_THRESHOLD: 1.1,
  /** Threshold for decreasing trend detection */
  TREND_DECREASE_THRESHOLD: 0.9,
  /** Confidence scores for different analysis types */
  CONFIDENCE: {
    SENTIMENT: 0.85,
    TOPICS: 0.8,
    TRENDS: 0.75,
    CUSTOMER_HEALTH: 0.8,
    RISK: 0.75,
    PATTERNS: 0.85,
    ISSUES: 0.7,
    RELATIONSHIP: 0.8,
    DATA_CARD: 0.9,
  },
} as const;

/** Elasticsearch index names */
const ES_INDICES = {
  COMMUNICATIONS: 'journeyworks_communications',
  SOCIAL: 'journeyworks_social',
  NPS_SURVEYS: 'journeyworks_nps_surveys',
} as const;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly analysisClient: AnalysisServiceClient,
    private readonly cache: RedisCacheService,
    private readonly communicationsService: CommunicationsService,
    private readonly eventsRepository: EventsRepository,
    private readonly esClient: ElasticsearchClientService,
    private readonly surveysService: SurveysService,
  ) {}

  /**
   * Normalize product filter from UI to ES slug(s) using the shared product catalogue.
   * Handles both category-level filters (e.g. 'mortgages', 'cards') and
   * individual product slugs (e.g. 'tracker-mortgage').
   * Returns an array of matching product slugs, or undefined for 'all'.
   */
  private normalizeProducts(product: string | undefined): string[] | undefined {
    if (!product || product === 'all') return undefined;

    // Check if it's a product catalogue category (e.g. 'mortgages', 'cards', 'savings')
    const categoryProducts = PRODUCTS_BY_CATEGORY[product as ProductCategory];
    if (categoryProducts && categoryProducts.length > 0) {
      return categoryProducts.map((p) => p.slug);
    }

    // Try to find as individual product term (name, slug, or alias)
    const found = findProductByTerm(product);
    if (found) return [found.slug];

    // Fallback: return as-is (might be a raw slug)
    return [product];
  }

  /**
   * Build an ES filter clause for product field(s).
   * Uses 'term' for single product, 'terms' for multiple (category filter).
   */
  private buildProductFilter(
    field: string,
    products: string[] | undefined,
  ): any | undefined {
    if (!products || products.length === 0) return undefined;
    if (products.length === 1) {
      return { term: { [field]: products[0] } };
    }
    return { terms: { [field]: products } };
  }

  /**
   * Perform analysis based on request type
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();

    this.logger.log(`Performing ${request.type} analysis`);

    let result: AnalysisResult;

    switch (request.type) {
      case 'sentiment':
        result = await this.analyzeSentiment(request);
        break;
      case 'topics':
        result = await this.analyzeTopics(request);
        break;
      case 'trends':
        result = await this.analyzeTrends(request);
        break;
      case 'customer-health':
        result = await this.analyzeCustomerHealth(request);
        break;
      case 'risk-assessment':
        result = await this.assessRisk(request);
        break;
      case 'communication-patterns':
        result = await this.analyzeCommunicationPatterns(request);
        break;
      case 'issue-detection':
        result = await this.detectIssues(request);
        break;
      case 'relationship-summary':
        result = await this.summarizeRelationship(request);
        break;
      case 'data-card':
        result = await this.generateDataCard(request);
        break;
      default:
        throw new Error(`Unknown analysis type: ${request.type}`);
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Analyze sentiment across communications
   */
  private async analyzeSentiment(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'sentiment',
        'No communications found for sentiment analysis.',
      );
    }

    // Aggregate sentiment
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    let totalScore = 0;

    for (const comm of communications) {
      const label = comm.sentiment?.label || 'neutral';
      sentimentCounts[label] = (sentimentCounts[label] || 0) + 1;
      totalScore += comm.sentiment?.score || 0;
    }

    const avgScore = totalScore / communications.length;
    const dominantSentiment = Object.entries(sentimentCounts).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    // Use LLM for deeper analysis
    const sampleComms = communications.slice(
      0,
      ANALYSIS_CONFIG.SENTIMENT_SAMPLE_SIZE,
    );
    const prompt = this.promptTemplate.renderNamed(
      'analysis:sentiment_analysis',
      {
        sentimentBreakdown: JSON.stringify(sentimentCounts),
        averageScore: avgScore.toFixed(2),
        sampleCommunications: JSON.stringify(
          sampleComms.map((c) => ({
            content: c.content.substring(
              0,
              ANALYSIS_CONFIG.SHORT_CONTENT_LENGTH,
            ),
            sentiment: c.sentiment,
            channel: c.channel,
          })),
          null,
          2,
        ),
      },
    );

    let insights: Insight[] = [];
    try {
      const llmAnalysis = await this.promptWithTimeout(
        prompt,
        this.promptTemplate.getTemplate('system:analyst'),
        { rateLimitKey: 'llm:analysis' },
      );
      insights = this.extractInsights(llmAnalysis);
    } catch (error) {
      this.logger.warn(
        `LLM sentiment analysis failed, returning metrics only: ${(error as Error).message}`,
      );
    }

    return {
      type: 'sentiment',
      summary: `Analyzed ${communications.length} communications. Dominant sentiment: ${dominantSentiment} (${((sentimentCounts[dominantSentiment] / communications.length) * 100).toFixed(1)}%)`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.SENTIMENT,
      insights,
      metrics: {
        totalCommunications: communications.length,
        sentimentBreakdown: sentimentCounts,
        averageScore: avgScore,
        dominantSentiment,
      },
      visualizations: [
        {
          type: 'pie',
          title: 'Sentiment Distribution',
          data: Object.entries(sentimentCounts).map(([label, count]) => ({
            label,
            value: count,
          })),
        },
      ],
      recommendations: request.options?.includeRecommendations
        ? this.generateSentimentRecommendations(sentimentCounts, avgScore)
        : undefined,
      processingTime: 0,
    };
  }

  /**
   * Analyze topics in communications
   */
  private async analyzeTopics(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'topics',
        'No communications found for topic analysis.',
      );
    }

    // Aggregate topics
    const topicCounts: Record<string, number> = {};
    for (const comm of communications) {
      for (const topic of comm.topics || []) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    const sortedTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, ANALYSIS_CONFIG.MAX_TOPICS_ANALYZE);

    // Use LLM for topic clustering and analysis
    const prompt = this.promptTemplate.renderNamed('analysis:topic_analysis', {
      topics: JSON.stringify(sortedTopics),
      sampleContent: communications
        .slice(0, ANALYSIS_CONFIG.TOPIC_SAMPLE_SIZE)
        .map((c) => c.content.substring(0, ANALYSIS_CONFIG.MAX_CONTENT_LENGTH))
        .join('\n---\n'),
    });

    let insights: Insight[] = [];
    try {
      const llmAnalysis = await this.promptWithTimeout(
        prompt,
        this.promptTemplate.getTemplate('system:analyst'),
        { rateLimitKey: 'llm:analysis' },
      );
      insights = this.extractInsights(llmAnalysis);
    } catch (error) {
      this.logger.warn(
        `LLM topic analysis failed, returning metrics only: ${(error as Error).message}`,
      );
    }

    return {
      type: 'topics',
      summary: `Identified ${sortedTopics.length} topics across ${communications.length} communications. Top topic: "${sortedTopics[0]?.[0] || 'N/A'}"`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.TOPICS,
      insights,
      metrics: {
        totalCommunications: communications.length,
        topicCounts: Object.fromEntries(sortedTopics),
        topTopics: sortedTopics
          .slice(0, ANALYSIS_CONFIG.MAX_TOPICS_DISPLAY)
          .map(([topic, count]) => ({ topic, count })),
      },
      visualizations: [
        {
          type: 'bar',
          title: 'Top Topics',
          data: sortedTopics
            .slice(0, ANALYSIS_CONFIG.MAX_TOPICS_DISPLAY)
            .map(([topic, count]) => ({
              label: topic,
              value: count,
            })),
        },
      ],
      processingTime: 0,
    };
  }

  /**
   * Analyze trends over time
   */
  private async analyzeTrends(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'trends',
        'No communications found for trend analysis.',
      );
    }

    // Group by date
    const byDate: Record<
      string,
      { count: number; sentiments: Record<string, number> }
    > = {};

    for (const comm of communications) {
      const date = new Date(comm.timestamp).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = {
          count: 0,
          sentiments: { positive: 0, neutral: 0, negative: 0 },
        };
      }
      byDate[date].count++;
      const label = comm.sentiment?.label || 'neutral';
      byDate[date].sentiments[label] =
        (byDate[date].sentiments[label] || 0) + 1;
    }

    const dates = Object.keys(byDate).sort();
    const volumeTrend = dates.map((date) => ({
      date,
      volume: byDate[date].count,
    }));

    // Detect trend direction
    const recentVolume = volumeTrend
      .slice(-ANALYSIS_CONFIG.TREND_RECENT_DAYS)
      .reduce((s, d) => s + d.volume, 0);
    const previousVolume = volumeTrend
      .slice(
        -ANALYSIS_CONFIG.TREND_PREVIOUS_DAYS,
        -ANALYSIS_CONFIG.TREND_RECENT_DAYS,
      )
      .reduce((s, d) => s + d.volume, 0);
    const trendDirection =
      recentVolume > previousVolume * ANALYSIS_CONFIG.TREND_INCREASE_THRESHOLD
        ? 'increasing'
        : recentVolume <
            previousVolume * ANALYSIS_CONFIG.TREND_DECREASE_THRESHOLD
          ? 'decreasing'
          : 'stable';

    return {
      type: 'trends',
      summary: `Communication volume is ${trendDirection}. Analyzed ${communications.length} communications over ${dates.length} days.`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.TRENDS,
      insights: [
        {
          category: 'Volume Trend',
          text: `Communication volume is ${trendDirection} compared to the previous period.`,
          severity: trendDirection === 'increasing' ? 'medium' : 'low',
        },
      ],
      metrics: {
        totalCommunications: communications.length,
        dateRange: { from: dates[0], to: dates[dates.length - 1] },
        trendDirection,
        dailyAverageVolume: communications.length / dates.length,
      },
      visualizations: [
        {
          type: 'line',
          title: 'Communication Volume Over Time',
          data: volumeTrend,
        },
        {
          type: 'line',
          title: 'Sentiment Trend',
          data: dates.map((date) => ({
            date,
            ...byDate[date].sentiments,
          })),
        },
      ],
      processingTime: 0,
    };
  }

  /**
   * Analyze customer health
   */
  private async analyzeCustomerHealth(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    if (!request.targetId) {
      throw new BadRequestException(
        'Customer ID required for customer health analysis',
      );
    }

    const communications = await this.communicationsService.getByCustomer(
      request.targetId,
      0,
      100,
    );

    if (communications.items.length === 0) {
      return this.emptyResult(
        'customer-health',
        'No communications found for this customer.',
      );
    }

    const comms = communications.items;
    const customerName = comms[0].customerName || 'Unknown';

    // Calculate health metrics
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let totalScore = 0;

    for (const comm of comms) {
      const label = comm.sentiment?.label || 'neutral';
      if (label in sentimentCounts) {
        sentimentCounts[label]++;
      }
      totalScore += comm.sentiment?.score || 0;
    }

    const avgScore = totalScore / comms.length;
    const positiveRatio = sentimentCounts.positive / comms.length;
    const negativeRatio = sentimentCounts.negative / comms.length;

    // Calculate health score (0-100)
    let healthScore = 50 + avgScore * 25; // Base on sentiment
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine trend
    const recentComms = comms.slice(0, ANALYSIS_CONFIG.TREND_RECENT_COUNT);
    const olderComms = comms.slice(
      ANALYSIS_CONFIG.TREND_RECENT_COUNT,
      ANALYSIS_CONFIG.TREND_COMPARISON_COUNT,
    );
    const recentAvg =
      recentComms.reduce((s, c) => s + (c.sentiment?.score || 0), 0) /
      recentComms.length;
    const olderAvg =
      olderComms.length > 0
        ? olderComms.reduce((s, c) => s + (c.sentiment?.score || 0), 0) /
          olderComms.length
        : recentAvg;

    const trend =
      recentAvg > olderAvg + 0.1
        ? 'improving'
        : recentAvg < olderAvg - 0.1
          ? 'declining'
          : 'stable';

    // Generate risk factors and positive signals
    const riskFactors: string[] = [];
    const positiveSignals: string[] = [];

    if (negativeRatio > 0.3) {
      riskFactors.push('High proportion of negative communications');
    }
    if (positiveRatio > 0.5) {
      positiveSignals.push('Majority of communications are positive');
    }
    if (trend === 'declining') {
      riskFactors.push('Sentiment trend is declining');
    }
    if (trend === 'improving') {
      positiveSignals.push('Sentiment trend is improving');
    }

    const healthAnalysis: CustomerHealthAnalysis = {
      customerId: request.targetId,
      customerName,
      healthScore,
      trend,
      sentimentBreakdown: sentimentCounts,
      riskFactors,
      positiveSignals,
      recentActivity: {
        communicationCount: comms.length,
        caseCount: 0, // Would come from cases module
        lastContact: comms[0]?.timestamp,
      },
      recommendations: this.generateHealthRecommendations(
        healthScore,
        trend,
        riskFactors,
      ),
    };

    return {
      type: 'customer-health',
      summary: `Customer "${customerName}" has a health score of ${healthScore.toFixed(0)}/100 with ${trend} trend.`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.CUSTOMER_HEALTH,
      insights: [
        {
          category: 'Health Score',
          text: `Health score is ${healthScore >= 70 ? 'good' : healthScore >= 40 ? 'moderate' : 'concerning'} at ${healthScore.toFixed(0)}/100`,
          severity:
            healthScore >= 70 ? 'low' : healthScore >= 40 ? 'medium' : 'high',
        },
        ...riskFactors.map((rf) => ({
          category: 'Risk Factor',
          text: rf,
          severity: 'high' as const,
        })),
      ],
      metrics: healthAnalysis,
      recommendations: healthAnalysis.recommendations,
      processingTime: 0,
    };
  }

  /**
   * Assess risk across communications
   */
  private async assessRisk(request: AnalysisRequest): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'risk-assessment',
        'No communications found for risk assessment.',
      );
    }

    // Use LLM for risk assessment
    const sampleComms = communications
      .filter(
        (c) =>
          c.sentiment?.label === 'negative' ||
          c.priority === 'high' ||
          c.priority === 'urgent',
      )
      .slice(0, ANALYSIS_CONFIG.RISK_SAMPLE_SIZE);

    const prompt = this.promptTemplate.renderNamed('analysis:risk_assessment', {
      totalCommunications: communications.length,
      negativeCommunications: communications.filter(
        (c) => c.sentiment?.label === 'negative',
      ).length,
      highPriorityCommunications: communications.filter(
        (c) => c.priority === 'high' || c.priority === 'urgent',
      ).length,
      sampleHighRiskCommunications: JSON.stringify(
        sampleComms.map((c) => ({
          content: c.content.substring(0, ANALYSIS_CONFIG.MAX_CONTENT_LENGTH),
          sentiment: c.sentiment,
          priority: c.priority,
          customer: c.customerName,
        })),
        null,
        2,
      ),
    });

    const llmAnalysis = await this.promptWithTimeout(
      prompt,
      this.promptTemplate.getTemplate('system:analyst'),
      { rateLimitKey: 'llm:analysis' },
    );

    // Parse LLM response for structured risk assessment
    let riskAssessment: RiskAssessment;
    let parsedFromFallback = false;
    try {
      const braceStart = llmAnalysis.indexOf('{');
      const jsonStr =
        braceStart !== -1
          ? this.extractJsonObject(llmAnalysis, braceStart)
          : null;
      const parsed = jsonStr ? JSON.parse(jsonStr) : JSON.parse(llmAnalysis);
      riskAssessment = {
        riskLevel: parsed.riskLevel || 'medium',
        riskScore: parsed.riskScore || 50,
        factors: parsed.factors || [],
        mitigations: parsed.mitigations || [],
        affectedCustomers: parsed.affectedCustomers,
      };
    } catch (error) {
      // Log and flag fallback for transparency
      this.logger.warn(
        `Failed to parse LLM risk assessment as JSON, using fallback: ${(error as Error).message}`,
      );
      parsedFromFallback = true;
      // Fallback to basic assessment
      const negativeRatio =
        communications.filter((c) => c.sentiment?.label === 'negative').length /
        communications.length;
      riskAssessment = {
        riskLevel:
          negativeRatio > 0.3
            ? 'high'
            : negativeRatio > 0.15
              ? 'medium'
              : 'low',
        riskScore: Math.min(100, negativeRatio * 200),
        factors: [
          {
            factor: 'Negative Sentiment',
            description: `${(negativeRatio * 100).toFixed(1)}% of communications have negative sentiment`,
            impact: negativeRatio > 0.3 ? 'high' : 'medium',
            likelihood: negativeRatio > 0.2 ? 'high' : 'medium',
          },
        ],
        mitigations: [
          'Review negative communications',
          'Implement proactive outreach',
        ],
      };
    }

    return {
      type: 'risk-assessment',
      summary: `Risk level: ${riskAssessment.riskLevel.toUpperCase()} (score: ${riskAssessment.riskScore.toFixed(0)}/100). ${riskAssessment.factors.length} risk factors identified.${parsedFromFallback ? ' (basic assessment)' : ''}`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.RISK,
      insights: riskAssessment.factors.map((f) => ({
        category: 'Risk Factor',
        text: `${f.factor}: ${f.description}`,
        severity: f.impact as any,
      })),
      metrics: riskAssessment,
      recommendations: riskAssessment.mitigations,
      processingTime: 0,
    };
  }

  /**
   * Analyze communication patterns
   */
  private async analyzeCommunicationPatterns(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'communication-patterns',
        'No communications found for pattern analysis.',
      );
    }

    // Channel distribution
    const channelCounts: Record<string, number> = {};
    for (const comm of communications) {
      channelCounts[comm.channel] = (channelCounts[comm.channel] || 0) + 1;
    }

    // Time distribution (hour of day, day of week)
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};

    for (const comm of communications) {
      const date = new Date(comm.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    // Find peak times
    const peakHour = Object.entries(hourCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];
    const peakDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0];

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const patterns: CommunicationPatternAnalysis = {
      timeRange: {
        from: communications[communications.length - 1]?.timestamp || '',
        to: communications[0]?.timestamp || '',
      },
      totalCommunications: communications.length,
      channelDistribution: channelCounts,
      peakTimes: [
        {
          dayOfWeek: dayNames[parseInt(peakDay[0])],
          hourOfDay: parseInt(peakHour[0]),
          volume: parseInt(peakHour[1] as any),
        },
      ],
      responseTime: {
        average: 0, // Would need response tracking
        median: 0,
        percentile95: 0,
      },
      sentimentTrend: [],
      topicTrends: [],
    };

    return {
      type: 'communication-patterns',
      summary: `Analyzed ${communications.length} communications. Peak activity: ${dayNames[parseInt(peakDay[0])]}s at ${peakHour[0]}:00. Primary channel: ${Object.entries(channelCounts).sort(([, a], [, b]) => b - a)[0][0]}.`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.PATTERNS,
      insights: [
        {
          category: 'Peak Activity',
          text: `Highest activity on ${dayNames[parseInt(peakDay[0])]}s around ${peakHour[0]}:00`,
          severity: 'low',
        },
      ],
      metrics: patterns,
      visualizations: [
        {
          type: 'bar',
          title: 'Channel Distribution',
          data: Object.entries(channelCounts).map(([channel, count]) => ({
            label: channel,
            value: count,
          })),
        },
        {
          type: 'heatmap',
          title: 'Activity by Hour',
          data: Object.entries(hourCounts).map(([hour, count]) => ({
            hour: parseInt(hour),
            count,
          })),
        },
      ],
      processingTime: 0,
    };
  }

  /**
   * Detect issues in communications
   */
  private async detectIssues(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'issue-detection',
        'No communications found for issue detection.',
      );
    }

    // Focus on negative and urgent communications
    const problematicComms = communications.filter(
      (c) =>
        c.sentiment?.label === 'negative' ||
        c.priority === 'urgent' ||
        c.priority === 'high',
    );

    const prompt = this.promptTemplate.renderNamed('analysis:issue_detection', {
      totalCommunications: communications.length,
      problematicCount: problematicComms.length,
      samples: JSON.stringify(
        problematicComms
          .slice(0, ANALYSIS_CONFIG.ISSUE_SAMPLE_SIZE)
          .map((c) => ({
            content: c.content.substring(
              0,
              ANALYSIS_CONFIG.MAX_CONTENT_LENGTH + 100,
            ),
            customer: c.customerName,
            sentiment: c.sentiment,
            priority: c.priority,
            timestamp: c.timestamp,
          })),
        null,
        2,
      ),
    });

    let insights: Insight[] = [];
    try {
      const llmAnalysis = await this.promptWithTimeout(
        prompt,
        this.promptTemplate.getTemplate('system:analyst'),
        { rateLimitKey: 'llm:analysis' },
      );
      insights = this.extractInsights(llmAnalysis);
    } catch (error) {
      this.logger.warn(
        `LLM issue detection failed, returning metrics only: ${(error as Error).message}`,
      );
    }

    return {
      type: 'issue-detection',
      summary: `Detected ${insights.filter((i) => i.severity === 'high' || i.severity === 'critical').length} significant issues from ${problematicComms.length} concerning communications.`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.ISSUES,
      insights,
      metrics: {
        totalCommunications: communications.length,
        problematicCount: problematicComms.length,
        issueCount: insights.length,
      },
      recommendations: request.options?.includeRecommendations
        ? insights.slice(0, 3).map((i) => `Address: ${i.text}`)
        : undefined,
      processingTime: 0,
    };
  }

  /**
   * Summarize customer relationship
   */
  private async summarizeRelationship(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    if (!request.targetId) {
      throw new BadRequestException(
        'Customer ID required for relationship summary',
      );
    }

    const communications = await this.communicationsService.getByCustomer(
      request.targetId,
      0,
      50,
    );

    if (communications.items.length === 0) {
      return this.emptyResult(
        'relationship-summary',
        'No communications found for this customer.',
      );
    }

    const comms = communications.items;
    const customerName = comms[0].customerName || 'Unknown';

    const prompt = this.promptTemplate.renderNamed(
      'analysis:relationship_summary',
      {
        customerName,
        communicationCount: comms.length,
        communications: JSON.stringify(
          comms.map((c) => ({
            date: c.timestamp,
            channel: c.channel,
            summary: c.summary || c.content.substring(0, 200),
            sentiment: c.sentiment?.label,
          })),
          null,
          2,
        ),
      },
    );

    let summary: string;
    try {
      summary = await this.promptWithTimeout(
        prompt,
        this.promptTemplate.getTemplate('system:analyst'),
        { rateLimitKey: 'llm:analysis' },
      );
    } catch (error) {
      this.logger.warn(
        `LLM relationship summary failed: ${(error as Error).message}`,
      );
      summary = `Customer "${customerName}" has ${comms.length} communications on record.`;
    }

    return {
      type: 'relationship-summary',
      summary,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.RELATIONSHIP,
      insights: [],
      metrics: {
        customerId: request.targetId,
        customerName,
        communicationCount: comms.length,
        firstContact: comms[comms.length - 1]?.timestamp,
        lastContact: comms[0]?.timestamp,
      },
      processingTime: 0,
    };
  }

  /**
   * Generate data card using analysis service
   */
  private async generateDataCard(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    const communications = await this.getCommunicationsForAnalysis(request);

    if (communications.length === 0) {
      return this.emptyResult(
        'data-card',
        'No data available for data card generation.',
      );
    }

    // Call analysis service for data card
    const serviceDataCard = await this.analysisClient.generateDataCard({
      data: communications as Record<string, unknown>[],
      title: (request.options as any)?.title || 'Communication Analysis',
      generateInsights: true,
    });

    // Convert to local DataCard format
    const dataCard: DataCard = {
      title: serviceDataCard.title,
      description: serviceDataCard.description,
      statistics: {
        totalRecords: serviceDataCard.rowCount,
        fieldCount: serviceDataCard.columnCount,
        completeness: serviceDataCard.dataQuality?.completeness || 0,
      },
      fields: serviceDataCard.columns.map((col) => ({
        name: col.name,
        type: col.inferredType,
        completeness: (1 - col.statistics.missing / col.statistics.count) * 100,
        uniqueCount: col.statistics.unique,
        topValues:
          col.topValues?.map((tv) => ({
            value: tv.value,
            count: tv.count,
          })) || [],
      })),
      quality: {
        score: (serviceDataCard.dataQuality?.completeness || 0) * 100,
        issues:
          serviceDataCard.dataQuality?.issues.map((i) => ({
            field: i.column,
            issue: i.issue,
            severity: i.severity,
          })) || [],
        recommendations: [],
      },
    };

    return {
      type: 'data-card',
      summary:
        serviceDataCard.description ||
        `Generated data card for ${communications.length} records.`,
      confidence: ANALYSIS_CONFIG.CONFIDENCE.DATA_CARD,
      insights: serviceDataCard.insights.map((text) => ({
        category: 'data-quality',
        text,
        severity: 'low' as const,
      })),
      metrics: {
        recordCount: communications.length,
        fieldCount: serviceDataCard.columnCount,
      },
      dataCard,
      processingTime: 0,
    };
  }

  /**
   * Get communications for analysis based on request filters
   */
  private async getCommunicationsForAnalysis(
    request: AnalysisRequest,
  ): Promise<any[]> {
    // Apply limit with cap to prevent resource exhaustion
    const requestedLimit =
      request.options?.limit || ANALYSIS_CONFIG.DEFAULT_LIMIT;
    const limit = Math.min(requestedLimit, ANALYSIS_CONFIG.MAX_LIMIT);

    const results = await this.communicationsService.search({
      query: request.query,
      customerId: request.targetId,
      startDate: request.timeRange?.from,
      endDate: request.timeRange?.to,
      product: request.product,
      from: 0,
      size: limit,
    });

    return results.items;
  }

  /**
   * Create an empty result for when no data is found
   */
  private emptyResult(type: AnalysisType, message: string): AnalysisResult {
    return {
      type,
      summary: message,
      confidence: 0,
      insights: [],
      metrics: {},
      processingTime: 0,
    };
  }

  /**
   * Extract insights from LLM response
   * @returns Insights array with optional parseFailed flag when JSON parsing fails
   */
  private extractInsights(llmResponse: string): Insight[] {
    try {
      // Use brace-matching to extract JSON from potentially prose-wrapped LLM output
      const braceStart = llmResponse.indexOf('{');
      const jsonStr =
        braceStart !== -1
          ? this.extractJsonObject(llmResponse, braceStart)
          : null;
      const parsed = jsonStr ? JSON.parse(jsonStr) : JSON.parse(llmResponse);
      if (Array.isArray(parsed.insights)) {
        return parsed.insights.map((i: any) => ({
          category: i.category || 'General',
          text: i.text || i.insight || i.description,
          severity: this.normalizeSeverity(i.severity || i.importance),
          evidence: i.evidence,
          relatedEntities: i.relatedEntities,
        }));
      }
    } catch (error) {
      // Log parse failure for debugging and monitoring
      this.logger.warn(
        `Failed to parse LLM insights as JSON, falling back to text extraction: ${(error as Error).message}`,
      );
      // Try to extract insights from plain text
      const lines = llmResponse.split('\n').filter((l) => l.trim());
      const fallbackInsights = lines
        .slice(0, ANALYSIS_CONFIG.MAX_FALLBACK_INSIGHTS)
        .map((line) => ({
          category: 'General',
          text: line.replace(/^[-•*]\s*/, ''),
          severity: 'medium' as const,
          // Mark insights as parsed from fallback for transparency
          parsedFromFallback: true,
        }));
      return fallbackInsights;
    }

    return [];
  }

  /**
   * Normalize severity value
   */
  private normalizeSeverity(
    value: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const normalized = (value || 'medium').toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
      return normalized as any;
    }
    return 'medium';
  }

  /**
   * Generate sentiment recommendations
   */
  private generateSentimentRecommendations(
    sentimentCounts: Record<string, number>,
    avgScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (sentimentCounts.negative > sentimentCounts.positive) {
      recommendations.push(
        'Review negative communications to identify common issues',
      );
      recommendations.push(
        'Consider proactive outreach to dissatisfied customers',
      );
    }

    if (avgScore < -0.2) {
      recommendations.push(
        'Implement sentiment monitoring alerts for early issue detection',
      );
    }

    if (
      sentimentCounts.mixed >
      (sentimentCounts.positive + sentimentCounts.negative) * 0.3
    ) {
      recommendations.push(
        'Investigate mixed sentiment communications for underlying concerns',
      );
    }

    return recommendations;
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(
    healthScore: number,
    trend: string,
    riskFactors: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (healthScore < 40) {
      recommendations.push(
        'Immediate attention required - schedule account review',
      );
      recommendations.push('Escalate to account manager for intervention');
    } else if (healthScore < 70) {
      recommendations.push(
        'Schedule regular check-ins to improve relationship',
      );
    }

    if (trend === 'declining') {
      recommendations.push('Investigate recent interactions for issues');
      recommendations.push('Consider proactive outreach to address concerns');
    }

    for (const factor of riskFactors.slice(0, 2)) {
      recommendations.push(`Address: ${factor}`);
    }

    return recommendations.slice(0, ANALYSIS_CONFIG.MAX_RECOMMENDATIONS);
  }

  // ============================================================
  // Dashboard API Methods
  // ============================================================

  /**
   * Get timeline events for dashboard from Elasticsearch
   */
  async getTimelineEvents(filter: {
    startDate?: Date;
    endDate?: Date;
    product?: string;
  }): Promise<TimelineEvent[]> {
    try {
      const normalizedProducts = this.normalizeProducts(filter.product);

      // Query real events from Elasticsearch
      const result = await this.eventsRepository.searchEvents(
        undefined, // no text query
        {
          startDateFrom: filter.startDate?.toISOString(),
          startDateTo: filter.endDate?.toISOString(),
          product: normalizedProducts?.[0], // Events use single product; pass first for partial match
        },
        { size: 100, sort: [{ startDate: 'asc' }] },
      );

      this.logger.debug(
        `Found ${result.hits.length} events from ES (product: ${normalizedProducts?.join(',') || 'all'})`,
      );

      // Map ES event types to TimelineEvent types
      const typeMap: Record<string, TimelineEvent['type']> = {
        outage: 'outage',
        launch: 'launch',
        policy_change: 'announcement',
        incident: 'issue',
        promotion: 'announcement',
      };

      // Map ES documents to TimelineEvent format
      return result.hits.map((hit) => {
        const doc = hit.source;
        return {
          id: doc.id,
          date: doc.startDate,
          type: typeMap[doc.type] || 'issue',
          label: doc.label,
          product: doc.product || 'all',
          severity: doc.severity,
          description: doc.description,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to fetch events from ES: ${error.message}`);
      // Return empty array on error - UI will show no events
      return [];
    }
  }

  /**
   * Get sentiment bubbles for timeline chart from Elasticsearch
   */
  async getSentimentBubbles(filter: {
    startDate?: Date;
    endDate?: Date;
    product?: string;
    channel?: string;
  }): Promise<SentimentBubble[]> {
    try {
      const client = this.esClient.getClient();
      if (!client) {
        this.logger.warn('ES client not available for bubbles');
        return [];
      }

      const normalizedProducts = this.normalizeProducts(filter.product);
      const startDate = filter.startDate || new Date('2024-01-01');
      const endDate = filter.endDate || new Date();

      // Build filters
      const filters: any[] = [
        {
          range: {
            timestamp: {
              gte: startDate.toISOString(),
              lte: endDate.toISOString(),
            },
          },
        },
      ];

      const productFilter = this.buildProductFilter(
        'aiClassification.product.keyword',
        normalizedProducts,
      );
      if (productFilter) {
        filters.push(productFilter);
      }

      if (filter.channel) {
        filters.push({ term: { 'channel.keyword': filter.channel } });
      }

      // Build survey filters before queries so we can fire all in parallel
      const surveyFilters: any[] = [
        {
          range: {
            surveyDate: {
              gte: startDate.toISOString(),
              lte: endDate.toISOString(),
            },
          },
        },
        { term: { responded: true } },
      ];

      const surveyProductFilter = this.buildProductFilter(
        'product',
        normalizedProducts,
      );
      if (surveyProductFilter) {
        surveyFilters.push(surveyProductFilter);
      }

      // Fire all 3 ES queries in parallel
      const [response, socialResponse, surveyResponse] = await Promise.all([
        // Communications aggregation by day
        client.search({
          index: ES_INDICES.COMMUNICATIONS,
          body: {
            size: 0,
            query: { bool: { filter: filters } },
            aggs: {
              by_day: {
                date_histogram: {
                  field: 'timestamp',
                  calendar_interval: 'day',
                },
                aggs: {
                  avg_sentiment: { avg: { field: 'sentiment.score' } },
                  top_categories: {
                    terms: {
                      field: 'aiClassification.category.keyword',
                      size: 5,
                    },
                  },
                  top_product: {
                    terms: {
                      field: 'aiClassification.product.keyword',
                      size: 1,
                    },
                  },
                  channels: { terms: { field: 'channel.keyword', size: 3 } },
                },
              },
            },
          },
        }),
        // Social sentiment by day
        client.search({
          index: ES_INDICES.SOCIAL,
          body: {
            size: 0,
            query: {
              bool: {
                filter: [
                  {
                    range: {
                      timestamp: {
                        gte: startDate.toISOString(),
                        lte: endDate.toISOString(),
                      },
                    },
                  },
                ],
              },
            },
            aggs: {
              by_day: {
                date_histogram: {
                  field: 'timestamp',
                  calendar_interval: 'day',
                },
                aggs: {
                  avg_sentiment: { avg: { field: 'sentiment.score' } },
                },
              },
            },
          },
        }),
        // Survey counts by day and product
        client.search({
          index: ES_INDICES.NPS_SURVEYS,
          body: {
            size: 0,
            query: { bool: { filter: surveyFilters } },
            aggs: {
              by_day: {
                date_histogram: {
                  field: 'surveyDate',
                  calendar_interval: 'day',
                },
                aggs: {
                  by_product: {
                    terms: {
                      field: 'product',
                      size: 20,
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      const buckets = (response.aggregations as any)?.by_day?.buckets || [];
      this.logger.debug(`Found ${buckets.length} daily buckets from ES`);

      // Create a map of social sentiment by date
      const socialBuckets =
        (socialResponse.aggregations as any)?.by_day?.buckets || [];
      const socialByDate: Record<string, number> = {};
      for (const bucket of socialBuckets) {
        const dateKey = bucket.key_as_string.split('T')[0];
        socialByDate[dateKey] = bucket.avg_sentiment?.value ?? 0;
      }

      // Build a map of date+product -> surveyCount
      const surveyBuckets =
        (surveyResponse.aggregations as any)?.by_day?.buckets || [];
      const surveysByDateProduct: Record<string, number> = {};
      for (const dayBucket of surveyBuckets) {
        const dateKey = dayBucket.key_as_string.split('T')[0];
        const productBuckets = dayBucket.by_product?.buckets || [];
        for (const prodBucket of productBuckets) {
          const key = `${dateKey}:${prodBucket.key}`;
          surveysByDateProduct[key] = prodBucket.doc_count;
        }
        // Also store total for the day (for when product='all')
        surveysByDateProduct[`${dateKey}:all`] = dayBucket.doc_count;
      }

      // Map to SentimentBubble format
      return buckets.map((bucket: any, index: number) => {
        const dateStr = bucket.key_as_string;
        const dateKey = dateStr.split('T')[0];
        const sentiment = bucket.avg_sentiment?.value ?? 0;
        const volume = bucket.doc_count;
        const themes =
          bucket.top_categories?.buckets?.map((b: any) => b.key) || [];
        const product =
          bucket.top_product?.buckets?.[0]?.key ||
          (normalizedProducts?.length === 1
            ? normalizedProducts[0]
            : undefined) ||
          'all';
        const channel =
          bucket.channels?.buckets?.[0]?.key || filter.channel || 'mixed';
        const socialSentiment = socialByDate[dateKey] ?? sentiment;

        // Get survey count: try product-specific first, then daily total
        const surveyCount =
          surveysByDateProduct[`${dateKey}:${product}`] ??
          surveysByDateProduct[`${dateKey}:all`] ??
          0;

        const npsData = this.sentimentToNPS(sentiment, dateKey);

        return {
          id: `bubble-${index}`,
          date: dateStr,
          volume,
          surveyCount,
          sentiment,
          socialSentiment,
          themes,
          product,
          channel,
          ...npsData,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to fetch bubbles from ES: ${error.message}`);
      return [];
    }
  }

  /**
   * Get journey stages for waterfall chart from Elasticsearch
   * Maps case status to journey stages with aggregated sentiment
   */
  async getJourneyStages(filter: {
    startDate?: Date;
    endDate?: Date;
    product?: string;
  }): Promise<JourneyStage[]> {
    try {
      // Use the surveys service to get real aggregated data
      // Use normalizeProducts (same as bubbles) so the journey chart scope
      // matches the survey counts shown on the timeline bubbles.
      const normalizedProducts = this.normalizeProducts(filter.product);

      const surveyFilters = {
        startDate: filter.startDate,
        endDate: filter.endDate,
        products: normalizedProducts,
      };

      // Get journey stage aggregations from actual survey data
      // No fallbacks - show exactly what exists for the requested filters
      const stageAggregations =
        await this.surveysService.getJourneyStages(surveyFilters);

      // Convert survey aggregations to JourneyStage format
      // This will show zeros if no data exists for the date range
      const stages: JourneyStage[] = stageAggregations.map((agg, index) => {
        const previousNps =
          index > 0 ? stageAggregations[index - 1].npsScore : 0;
        // Map NPS score (-100 to 100) to sentiment (-1 to 1)
        const sentiment = agg.npsScore / 100;
        const previousSentiment = previousNps / 100;

        return {
          stage: agg.stage,
          label: agg.label,
          sentiment,
          previousSentiment,
          change: sentiment - previousSentiment,
          communications: agg.totalResponses,
          npsScore: agg.npsScore,
          promoterPct: agg.promoterPct,
          passivePct: agg.passivePct,
          detractorPct: agg.detractorPct,
        };
      });

      this.logger.debug(
        `Built ${stages.length} journey stages from survey data`,
      );
      return stages;
    } catch (error) {
      this.logger.error(
        `Failed to fetch journey stages from surveys: ${error.message}`,
      );
      // Only use empty stages on actual error (ES unavailable)
      return this.getEmptyJourneyStages();
    }
  }

  /**
   * Empty journey stages when ES is unavailable
   */
  private getEmptyJourneyStages(): JourneyStage[] {
    const stages: Array<JourneyStage['stage']> = [
      'initial-contact',
      'triage',
      'investigation',
      'resolution',
      'post-resolution',
    ];
    const labels: Record<string, string> = {
      'initial-contact': 'Initial Contact',
      triage: 'Triage',
      investigation: 'Investigation',
      resolution: 'Resolution',
      'post-resolution': 'Post-Resolution',
    };

    return stages.map((stage) => ({
      stage,
      label: labels[stage],
      sentiment: 0,
      previousSentiment: 0,
      change: 0,
      communications: 0,
      npsScore: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
    }));
  }

  /**
   * Get quadrant items for scatter plot from Elasticsearch
   * Aggregates by category with sentiment and volume
   */
  async getQuadrantItems(filter: {
    startDate?: Date;
    endDate?: Date;
    product?: string;
    channel?: string;
  }): Promise<QuadrantItem[]> {
    try {
      const client = this.esClient.getClient();
      if (!client) {
        this.logger.warn('ES client not available for quadrant items');
        return [];
      }

      const normalizedProducts = this.normalizeProducts(filter.product);

      // Build filters
      const filters: any[] = [];
      if (filter.startDate || filter.endDate) {
        const range: any = {};
        if (filter.startDate) range.gte = filter.startDate.toISOString();
        if (filter.endDate) range.lte = filter.endDate.toISOString();
        filters.push({ range: { timestamp: range } });
      }

      const productFilter = this.buildProductFilter(
        'aiClassification.product.keyword',
        normalizedProducts,
      );
      if (productFilter) {
        filters.push(productFilter);
      }

      if (filter.channel) {
        filters.push({ term: { 'channel.keyword': filter.channel } });
      }

      // Aggregate by category
      const response = await client.search({
        index: ES_INDICES.COMMUNICATIONS,
        body: {
          size: 0,
          query: filters.length
            ? { bool: { filter: filters } }
            : { match_all: {} },
          aggs: {
            by_category: {
              terms: { field: 'aiClassification.category.keyword', size: 20 },
              aggs: {
                avg_sentiment: { avg: { field: 'sentiment.score' } },
                top_product: {
                  terms: { field: 'aiClassification.product.keyword', size: 1 },
                },
              },
            },
          },
        },
      });

      const buckets =
        (response.aggregations as any)?.by_category?.buckets || [];
      this.logger.debug(`Found ${buckets.length} categories for quadrant`);

      // Calculate volume thresholds for quadrant assignment
      const volumes = buckets.map((b: any) => b.doc_count);
      const avgVolume =
        volumes.length > 0
          ? volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length
          : 50;

      // Category to readable label mapping
      const categoryLabels: Record<string, string> = {
        'payment-issue': 'Payment Issues',
        'technical-issue': 'Technical Problems',
        'fees-charges': 'Fee Disputes',
        'account-access': 'Account Access',
        'service-quality': 'Service Quality',
        'product-feature': 'Product Features',
        communication: 'Communication',
        fraud: 'Fraud & Security',
      };

      return buckets.map((bucket: any, index: number) => {
        const category = bucket.key;
        const sentiment = bucket.avg_sentiment?.value ?? 0;
        const volume = bucket.doc_count;
        const product =
          bucket.top_product?.buckets?.[0]?.key ||
          (normalizedProducts?.length === 1
            ? normalizedProducts[0]
            : undefined) ||
          'all';

        // Determine quadrant based on sentiment and volume
        let quadrant: 'critical' | 'watch' | 'strength' | 'noise';
        if (sentiment < -0.2) {
          quadrant = volume > avgVolume ? 'critical' : 'watch';
        } else {
          quadrant = volume > avgVolume * 0.5 ? 'strength' : 'noise';
        }

        const npsData = this.sentimentToNPS(sentiment, category);

        return {
          id: `q-${index + 1}`,
          label: categoryLabels[category] || this.formatCategoryLabel(category),
          sentiment,
          volume,
          category,
          product,
          quadrant,
          ...npsData,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch quadrant items from ES: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Format category key to readable label
   */
  private formatCategoryLabel(category: string): string {
    return category
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert sentiment to NPS breakdown using deterministic hash-based variation.
   *
   * @warning DEMO/MOCK DATA: This simulates realistic NPS distribution for
   * demonstration purposes. In production, replace with actual NPS survey data.
   *
   * Uses a simple hash of the seed key for stable-per-key variation so
   * identical API calls return consistent results (cacheable, testable).
   */
  private sentimentToNPS(
    sentiment: number,
    seedKey: string,
  ): {
    npsScore: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
    /** Indicates this is simulated data, not actual NPS survey results */
    isSimulated: true;
  } {
    // Simple string hash → 0..1 deterministic "random" based on seed
    const hash = this.hashSeed(seedKey);
    const r1 = ((hash * 9301 + 49297) % 233280) / 233280; // 0..1
    const r2 = ((hash * 7919 + 10007) % 233280) / 233280; // 0..1

    let detractorPct: number;
    let passivePct: number;
    let promoterPct: number;

    if (sentiment < -0.5) {
      detractorPct = 70 + Math.floor(r1 * 15);
      passivePct = 15 + Math.floor(r2 * 10);
    } else if (sentiment < -0.2) {
      detractorPct = 50 + Math.floor(r1 * 15);
      passivePct = 25 + Math.floor(r2 * 10);
    } else if (sentiment < 0.2) {
      detractorPct = 30 + Math.floor(r1 * 10);
      passivePct = 35 + Math.floor(r2 * 10);
    } else if (sentiment < 0.5) {
      promoterPct = 40 + Math.floor(r1 * 15);
      passivePct = 30 + Math.floor(r2 * 10);
      detractorPct = 100 - promoterPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
        isSimulated: true,
      };
    } else {
      promoterPct = 55 + Math.floor(r1 * 20);
      passivePct = 25 + Math.floor(r2 * 10);
      detractorPct = 100 - promoterPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
        isSimulated: true,
      };
    }

    promoterPct = 100 - detractorPct - passivePct;
    return {
      npsScore: promoterPct - detractorPct,
      promoterPct,
      passivePct,
      detractorPct,
      isSimulated: true,
    };
  }

  /**
   * Simple deterministic hash of a string to a number.
   * Used for stable pseudo-random variation in demo data.
   */
  private hashSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract a JSON object from a string by matching braces,
   * avoiding the greedy-regex problem with multi-object LLM output.
   */
  private extractJsonObject(text: string, startIndex: number): string | null {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
    return null;
  }

  /**
   * Wrap an LLM call with a timeout to prevent indefinite hangs.
   */
  private promptWithTimeout(
    prompt: string,
    systemPrompt?: string,
    options?: { rateLimitKey?: string },
  ): Promise<string> {
    return this.llmClient.promptWithTimeout(prompt, systemPrompt, options);
  }
}

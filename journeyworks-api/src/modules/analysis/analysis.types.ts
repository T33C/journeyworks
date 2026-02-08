/**
 * Analysis Types
 *
 * Type definitions for analysis capabilities.
 */

/**
 * Analysis request
 */
export interface AnalysisRequest {
  /** Type of analysis to perform */
  type: AnalysisType;
  /** Target of the analysis (customer ID, communication ID, etc.) */
  targetId?: string;
  /** Query text for analysis */
  query?: string;
  /** Filter by product slug (e.g., 'advance-account', 'credit-card') */
  product?: string;
  /** Time range for analysis */
  timeRange?: {
    from?: string;
    to?: string;
  };
  /** Additional options */
  options?: AnalysisOptions;
}

/**
 * Types of analysis available
 */
export type AnalysisType =
  | 'sentiment'
  | 'topics'
  | 'trends'
  | 'customer-health'
  | 'risk-assessment'
  | 'communication-patterns'
  | 'issue-detection'
  | 'relationship-summary'
  | 'data-card';

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Include detailed breakdown */
  detailed?: boolean;
  /** Compare with previous period */
  compareWithPrevious?: boolean;
  /** Number of items to analyze */
  limit?: number;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Specific aspects to focus on */
  focusAreas?: string[];
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  /** Type of analysis performed */
  type: AnalysisType;
  /** Analysis summary */
  summary: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Key insights */
  insights: Insight[];
  /** Metrics and data */
  metrics: Record<string, any>;
  /** Visual data (for charts) */
  visualizations?: Visualization[];
  /** Recommendations if requested */
  recommendations?: string[];
  /** Data card if applicable */
  dataCard?: DataCard;
  /** Processing time in ms */
  processingTime: number;
}

/**
 * Individual insight from analysis
 */
export interface Insight {
  /** Insight category */
  category: string;
  /** Insight text */
  text: string;
  /** Severity/importance */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Supporting evidence */
  evidence?: string[];
  /** Related entities */
  relatedEntities?: string[];
}

/**
 * Visualization data
 */
export interface Visualization {
  /** Visualization type */
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'timeline';
  /** Title */
  title: string;
  /** Data for the visualization */
  data: any;
  /** Configuration */
  config?: Record<string, any>;
}

/**
 * Data card (from analysis service)
 */
export interface DataCard {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Statistical summary */
  statistics: {
    totalRecords: number;
    fieldCount: number;
    completeness: number;
  };
  /** Field analyses */
  fields: FieldAnalysis[];
  /** Quality assessment */
  quality: QualityAssessment;
  /** Temporal patterns */
  temporalPatterns?: TemporalPattern[];
}

/**
 * Field-level analysis
 */
export interface FieldAnalysis {
  /** Field name */
  name: string;
  /** Inferred type */
  type: string;
  /** Completeness percentage */
  completeness: number;
  /** Unique value count */
  uniqueCount: number;
  /** Top values (for categorical) */
  topValues?: Array<{ value: any; count: number }>;
  /** Distribution statistics (for numeric) */
  distribution?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
  };
}

/**
 * Data quality assessment
 */
export interface QualityAssessment {
  /** Overall quality score (0-100) */
  score: number;
  /** Quality issues found */
  issues: Array<{
    field: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Temporal pattern analysis
 */
export interface TemporalPattern {
  /** Pattern type */
  type: 'trend' | 'seasonality' | 'anomaly' | 'cyclic';
  /** Pattern description */
  description: string;
  /** Affected fields */
  fields: string[];
  /** Pattern parameters */
  parameters: Record<string, any>;
}

/**
 * Customer health analysis
 */
export interface CustomerHealthAnalysis {
  /** Customer ID */
  customerId: string;
  /** Customer name */
  customerName: string;
  /** Overall health score (0-100) */
  healthScore: number;
  /** Health trend */
  trend: 'improving' | 'stable' | 'declining';
  /** Sentiment breakdown */
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  /** Key risk factors */
  riskFactors: string[];
  /** Positive signals */
  positiveSignals: string[];
  /** Recent activity */
  recentActivity: {
    communicationCount: number;
    caseCount: number;
    lastContact: string;
  };
  /** Recommendations */
  recommendations: string[];
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Risk score (0-100) */
  riskScore: number;
  /** Risk factors */
  factors: Array<{
    factor: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    likelihood: 'low' | 'medium' | 'high';
  }>;
  /** Mitigation recommendations */
  mitigations: string[];
  /** Affected customers */
  affectedCustomers?: string[];
}

/**
 * Communication pattern analysis
 */
export interface CommunicationPatternAnalysis {
  /** Time range analyzed */
  timeRange: { from: string; to: string };
  /** Total communications */
  totalCommunications: number;
  /** Channel distribution */
  channelDistribution: Record<string, number>;
  /** Peak times */
  peakTimes: Array<{
    dayOfWeek: string;
    hourOfDay: number;
    volume: number;
  }>;
  /** Response time analysis */
  responseTime: {
    average: number;
    median: number;
    percentile95: number;
  };
  /** Sentiment over time */
  sentimentTrend: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }>;
  /** Topic trends */
  topicTrends: Array<{
    topic: string;
    trend: 'rising' | 'stable' | 'declining';
    count: number;
  }>;
}

// ============================================================
// Dashboard API Types
// ============================================================

/**
 * Dashboard filter parameters
 */
export interface DashboardFilter {
  startDate?: Date;
  endDate?: Date;
  product?: string;
  channel?: string;
}

/**
 * Timeline event (outages, launches, etc.)
 */
export interface TimelineEvent {
  id: string;
  date: string;
  type: 'outage' | 'launch' | 'issue' | 'resolution' | 'announcement';
  label: string;
  product: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

/**
 * Sentiment bubble for timeline chart
 */
export interface SentimentBubble {
  id: string;
  date: string;
  volume: number; // Communication count
  surveyCount: number; // Survey response count
  sentiment: number;
  socialSentiment: number;
  themes: string[];
  product: string;
  channel: string;
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

/**
 * Journey stage for waterfall chart
 */
export interface JourneyStage {
  stage:
    | 'initial-contact'
    | 'triage'
    | 'investigation'
    | 'resolution'
    | 'post-resolution';
  label: string;
  sentiment: number;
  previousSentiment: number;
  change: number;
  communications: number;
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

/**
 * Quadrant item for scatter plot
 */
export interface QuadrantItem {
  id: string;
  label: string;
  sentiment: number;
  volume: number;
  category: string;
  product: string;
  quadrant: 'critical' | 'watch' | 'strength' | 'noise';
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

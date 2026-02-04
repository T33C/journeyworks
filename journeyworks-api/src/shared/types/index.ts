/**
 * JourneyWorks Shared Types
 *
 * Core type definitions shared between journeyworks-api and journeyworks-ui.
 * These represent the canonical data structures for the platform.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type ProductType =
  | 'credit-card'
  | 'current-account'
  | 'savings-account'
  | 'mortgage'
  | 'personal-loan'
  | 'mobile-app'
  | 'online-banking'
  | 'insurance'
  | 'investments'
  | 'foreign-exchange';

export type CategoryType =
  | 'fraud'
  | 'service-quality'
  | 'fees-charges'
  | 'technical-issue'
  | 'account-access'
  | 'payment-issue'
  | 'communication'
  | 'product-feature'
  | 'data-privacy'
  | 'regulatory';

export type ChannelType =
  | 'email'
  | 'phone'
  | 'chat'
  | 'letter'
  | 'social'
  | 'in-branch';

export type CustomerSegment =
  | 'retail'
  | 'wealth'
  | 'corporate'
  | 'private-banking';

export type SeverityType = 'low' | 'medium' | 'high' | 'critical';

export type UrgencyType = 'low' | 'medium' | 'high' | 'critical';

export type CaseStatus =
  | 'open'
  | 'investigating'
  | 'pending-customer'
  | 'pending-internal'
  | 'resolved'
  | 'escalated'
  | 'closed';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'requires-review';

export type EventType =
  | 'outage'
  | 'launch'
  | 'issue'
  | 'resolution'
  | 'announcement'
  | 'regulatory'
  | 'maintenance';

export type JourneyStage =
  | 'initial-contact'
  | 'triage'
  | 'investigation'
  | 'resolution'
  | 'post-resolution';

export type QuadrantType = 'critical' | 'watch' | 'strength' | 'noise';

export type EmotionType =
  | 'anger'
  | 'frustration'
  | 'satisfaction'
  | 'confusion'
  | 'neutral'
  | 'appreciation';

export type NPSCategory = 'promoter' | 'passive' | 'detractor';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type TrendDirection = 'improving' | 'stable' | 'declining';

// =============================================================================
// CORE ENTITIES
// =============================================================================

/**
 * Customer Communication
 * Represents any form of customer interaction with the bank
 */
export interface Communication {
  id: string;
  externalId: string;

  // Customer info
  customerId: string;
  customerName: string;
  customerSegment: CustomerSegment;

  // Communication metadata
  channel: ChannelType;
  direction: 'inbound' | 'outbound';
  timestamp: Date;

  // Content
  subject?: string;
  content: string;
  contentSummary?: string;

  // Classification (LLM-extracted)
  classification: CommunicationClassification;

  // Sentiment
  sentiment: SentimentAnalysis;

  // Relationships
  threadId?: string;
  parentId?: string;
  caseId?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  processingStatus: ProcessingStatus;
}

/**
 * LLM-generated classification for a communication
 */
export interface CommunicationClassification {
  product: ProductType;
  productConfidence: number;

  category: CategoryType;
  categoryConfidence: number;

  issueType: string;
  issueTypeConfidence: number;

  urgency: UrgencyType;

  regulatoryFlags: RegulatoryFlag[];

  rootCause?: string;
  suggestedAction?: string;

  topics: string[];
  entities: ExtractedEntity[];

  // LLM metadata
  modelUsed: string;
  classifiedAt: Date;
}

export interface RegulatoryFlag {
  type: string;
  description: string;
  severity: SeverityType;
  requiresEscalation: boolean;
}

export interface ExtractedEntity {
  type: 'person' | 'product' | 'date' | 'amount' | 'reference' | 'location';
  value: string;
  confidence: number;
}

/**
 * Sentiment analysis results
 */
export interface SentimentAnalysis {
  overall: number; // -1 to +1
  confidence: number;

  aspects: AspectSentiment[];
  emotions: EmotionScore[];

  npsCategory?: NPSCategory;
  npsPredictedScore?: number;
}

export interface AspectSentiment {
  aspect: string;
  sentiment: number;
  mentions: number;
}

export interface EmotionScore {
  emotion: EmotionType;
  score: number;
}

/**
 * Case/Complaint entity
 */
export interface Case {
  id: string;
  externalId: string;

  // Customer
  customerId: string;
  customerName: string;
  customerSegment: CustomerSegment;

  // Case details
  status: CaseStatus;
  severity: SeverityType;
  priority: number;

  // Classification
  product: ProductType;
  category: CategoryType;
  issueType: string;

  // Content
  summary: string;
  rootCause?: string;
  resolution?: string;

  // Assignment
  assignedTo?: string;
  team?: string;

  // Sentiment journey
  sentimentJourney: JourneySentimentPoint[];
  currentSentiment: number;
  sentimentTrend: TrendDirection;

  // Regulatory
  regulatoryFlags: RegulatoryFlag[];
  isEscalated: boolean;
  escalationReason?: string;

  // Related
  communicationIds: string[];
  relatedCaseIds?: string[];
  relatedEventIds?: string[];

  // Timelines
  createdAt: Date;
  updatedAt: Date;
  targetResolutionDate?: Date;
  resolvedAt?: Date;

  // AI analysis
  aiInsight?: CaseInsight;
}

export interface JourneySentimentPoint {
  stage: JourneyStage;
  sentiment: number;
  timestamp: Date;
  communicationCount: number;
}

export interface CaseInsight {
  summary: string;
  keyDrivers: string[];
  riskFactors: string[];
  suggestedActions: string[];
  confidence: ConfidenceLevel;
  generatedAt: Date;
}

/**
 * Timeline Event (outages, launches, etc.)
 */
export interface TimelineEvent {
  id: string;

  type: EventType;
  label: string;
  description: string;

  startDate: Date;
  endDate?: Date;

  product?: ProductType;
  channels?: ChannelType[];
  affectedRegions?: string[];

  severity: SeverityType;
  estimatedImpact?: EventImpact;

  status: 'active' | 'resolved' | 'monitoring';

  correlatedCommunications?: number;
  sentimentDuringEvent?: number;

  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventImpact {
  customersAffected: number;
  communicationIncrease: number;
  sentimentImpact: number;
}

// =============================================================================
// CONTEXTUAL RAG
// =============================================================================

/**
 * Contextual chunk for Anthropic's contextual RAG approach
 */
export interface ContextualChunk {
  chunkId: string;
  communicationId: string;
  content: string;
  context: string; // LLM-generated context
  position: number;

  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  channel: ChannelType;
  timestamp: Date;
  customerId: string;
  product?: ProductType;
  category?: CategoryType;
}

// =============================================================================
// FILTER & ANALYSIS CONTEXT
// =============================================================================

export interface FilterState {
  dateRange: DateRange;
  products: ProductType[];
  channels: ChannelType[];
  categories?: CategoryType[];
  severities?: SeverityType[];
  customerSegments?: CustomerSegment[];
  showEvents: boolean;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Context emitted when user interacts with charts
 */
export interface AnalysisContext {
  selectionType: 'bubble' | 'stage' | 'quadrant' | 'event' | 'range' | 'none';

  timeWindow?: DateRange;
  activeFilters: FilterState;

  selectedBubble?: SentimentBubble;
  selectedStage?: JourneyStageData;
  selectedQuadrant?: QuadrantType;
  selectedEvent?: TimelineEvent;
  selectedItems?: string[];

  signals: AnalysisSignal[];
}

export interface AnalysisSignal {
  type:
    | 'sentiment_drop'
    | 'volume_spike'
    | 'theme_emergence'
    | 'event_correlation';
  severity: SeverityType;
  description: string;
  affectedPeriod?: DateRange;
}

// =============================================================================
// DASHBOARD & CHART DATA
// =============================================================================

export interface DashboardKPIs {
  totalCommunications: number;
  totalCommunicationsChange: number;

  avgSentiment: number;
  avgSentimentChange: number;

  openCases: number;
  openCasesChange: number;

  escalatedCases: number;
  escalatedCasesChange: number;

  avgResolutionDays: number;
  avgResolutionDaysChange: number;

  npsScore: number;
  npsScoreChange: number;
}

/**
 * Timeline chart bubble data
 */
export interface SentimentBubble {
  id: string;
  date: Date;

  volume: number; // Communication count
  surveyCount: number; // Survey response count
  sentiment: number;
  socialSentiment: number;

  channelBreakdown: Partial<Record<ChannelType, number>>;
  productBreakdown: Partial<Record<ProductType, number>>;

  themes: ThemeSummary[];

  nps: NPSSummary;
}

export interface ThemeSummary {
  theme: string;
  count: number;
  sentiment: number;
  trend: TrendDirection;
}

export interface NPSSummary {
  score: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

/**
 * Journey waterfall stage data
 */
export interface JourneyStageData {
  stage: JourneyStage;
  label: string;

  sentiment: number;
  previousSentiment: number;
  change: number;

  communicationCount: number;
  avgResolutionTime?: number;

  nps: NPSSummary;
}

/**
 * Quadrant chart item
 */
export interface QuadrantItem {
  id: string;
  label: string;

  sentiment: number;
  volume: number;

  category: CategoryType;
  product: ProductType;

  quadrant: QuadrantType;

  topIssues: string[];
  trend: TrendDirection;

  nps: NPSSummary;
}

export interface QuadrantSummary {
  itemCount: number;
  totalVolume: number;
  avgSentiment: number;
  topCategories: CategoryType[];
}

// =============================================================================
// AI RESEARCH PANEL
// =============================================================================

export interface ResearchInsight {
  summary: string;
  confidence: ConfidenceLevel;

  keyDrivers: KeyDriver[];
  rootCauses: string[];

  evidence: EvidenceItem[];

  timelineReasoning: string;
  causalAnalysis?: string;

  suggestedActions: SuggestedAction[];
  suggestedQuestions: string[];

  processingTime: number;
  sourcesUsed: number;
}

export interface KeyDriver {
  driver: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  supportingEvidence: string[];
}

export interface EvidenceItem {
  id: string;
  type: 'communication' | 'social' | 'event' | 'news';
  source: string;
  timestamp: Date;
  excerpt: string;
  sentiment: number;
  relevanceScore: number;
  highlightedTerms?: string[];
}

export interface SuggestedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  expectedImpact: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  context?: AnalysisContext;
  insight?: ResearchInsight;

  isStreaming?: boolean;
}

// =============================================================================
// RAG & RRG
// =============================================================================

export interface RAGRequest {
  query: string;
  filters?: Partial<FilterState>;
  topK?: number;
  useHybrid?: boolean;
  includeContext?: boolean;
}

export interface RAGResponse {
  chunks: RetrievedChunk[];
  query: string;
  searchType: 'dense' | 'sparse' | 'hybrid';
  totalResults: number;
  processingTime: number;
}

export interface RetrievedChunk {
  id: string;
  communicationId: string;
  content: string;
  context?: string;

  denseScore?: number;
  sparseScore?: number;
  combinedScore: number;
  rerankerScore?: number;

  source: ChunkMetadata;
  highlights?: string[];
}

export interface RRGRequest {
  naturalLanguageQuery: string;
  targetDSL: 'elasticsearch' | 'aggregation';
  context?: {
    availableFields: string[];
    indexName: string;
    currentFilters?: FilterState;
  };
}

export interface RRGResponse {
  originalQuery: string;
  dsl: object;
  explanation: string;
  confidence: number;
  suggestedRefinements?: string[];
  isValid: boolean;
  validationErrors?: string[];
}

// =============================================================================
// AGENT TYPES
// =============================================================================

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: 'rag' | 'rrg' | 'analysis' | 'data';
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolExecution {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface AgentState {
  conversationId: string;
  messages: ChatMessage[];
  currentContext: AnalysisContext;
  availableTools: AgentTool[];
  executionHistory: ToolExecution[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface AnalysisRequest {
  filters: FilterState;
  analysisType: 'timeline' | 'journey' | 'quadrant' | 'overview';
  context?: AnalysisContext;
}

export interface TimelineAnalysis {
  bubbles: SentimentBubble[];
  events: TimelineEvent[];
  socialBand: SocialSentimentPoint[];
  summary: TimelineSummary;
}

export interface SocialSentimentPoint {
  date: Date;
  sentiment: number;
  volume: number;
  sources: string[];
}

export interface TimelineSummary {
  avgSentiment: number;
  sentimentTrend: TrendDirection;
  totalVolume: number;
  topThemes: ThemeSummary[];
  significantEvents: TimelineEvent[];
}

export interface JourneyAnalysis {
  stages: JourneyStageData[];
  overallSentimentChange: number;
  criticalDropPoints: JourneyStage[];
}

export interface QuadrantAnalysis {
  items: QuadrantItem[];
  quadrantSummary: Record<QuadrantType, QuadrantSummary>;
}

// =============================================================================
// SYNTHETIC DATA GENERATION
// =============================================================================

export interface SyntheticDataConfig {
  communicationCount: number;
  caseCount: number;
  dateRange: DateRange;

  productDistribution: Partial<Record<ProductType, number>>;
  channelDistribution: Partial<Record<ChannelType, number>>;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };

  includeEvents: boolean;
  eventCount?: number;

  includeSocialMentions: boolean;
  socialMentionCount?: number;
}

export interface SyntheticDataResult {
  communicationsGenerated: number;
  casesGenerated: number;
  eventsGenerated: number;
  socialMentionsGenerated: number;
  processingTime: number;
  status: 'completed' | 'partial' | 'failed';
  errors?: string[];
}

// =============================================================================
// SOCIAL MEDIA TYPES
// =============================================================================

export type SocialPlatform =
  | 'twitter'
  | 'x'
  | 'reddit'
  | 'trustpilot'
  | 'linkedin'
  | 'facebook';

/**
 * Social media mention/post
 */
export interface SocialMention {
  id: string;

  // Platform info
  platform: SocialPlatform;
  postId: string;
  postUrl?: string;

  // Author info (anonymized for privacy)
  authorId: string;
  authorHandle?: string;
  authorFollowerCount?: number;
  isVerified?: boolean;

  // Content
  content: string;
  contentSummary?: string;
  timestamp: Date;

  // Engagement metrics
  engagement: SocialEngagement;

  // Analysis
  sentiment: SentimentAnalysis;
  topics: string[];
  mentions: SocialMentionEntity[];

  // Bank relevance
  relevanceScore: number;
  products?: ProductType[];
  categories?: CategoryType[];

  // Correlation to internal data
  correlatedCommunications?: string[];
  correlatedCases?: string[];
  correlatedEvents?: string[];

  // Processing
  createdAt: Date;
  processedAt?: Date;
  processingStatus: ProcessingStatus;
}

export interface SocialEngagement {
  likes: number;
  shares: number;
  comments: number;
  views?: number;

  // Calculated reach/impact
  estimatedReach?: number;
  viralityScore?: number;
}

export interface SocialMentionEntity {
  type: 'bank' | 'competitor' | 'product' | 'person' | 'hashtag';
  value: string;
  sentiment?: number;
}

/**
 * Aggregated social sentiment for a time period
 */
export interface SocialSentimentAggregate {
  period: DateRange;
  platform?: SocialPlatform;

  // Volume
  mentionCount: number;
  uniqueAuthors: number;
  totalEngagement: number;

  // Sentiment
  avgSentiment: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };

  // Top themes
  topTopics: ThemeSummary[];
  topProducts: Array<{
    product: ProductType;
    count: number;
    sentiment: number;
  }>;

  // Trending
  trendingHashtags: Array<{
    hashtag: string;
    count: number;
    sentiment: number;
  }>;

  // Comparison
  previousPeriodChange?: {
    volumeChange: number;
    sentimentChange: number;
  };
}

// =============================================================================
// DATA QUALITY TYPES (for Data Quality Dashboard)
// =============================================================================

export interface DataQualityMetrics {
  // Classification confidence
  avgClassificationConfidence: number;
  lowConfidenceCount: number;
  lowConfidenceThreshold: number;

  // Coverage
  processedCount: number;
  pendingCount: number;
  failedCount: number;

  // By field
  fieldQuality: Array<{
    field: string;
    populatedPct: number;
    avgConfidence?: number;
  }>;

  // Items requiring review
  itemsRequiringReview: DataQualityIssue[];
}

export interface DataQualityIssue {
  id: string;
  entityType: 'communication' | 'case' | 'social';
  entityId: string;
  issueType: 'low_confidence' | 'missing_field' | 'inconsistent' | 'outlier';
  field?: string;
  currentValue?: unknown;
  confidence?: number;
  description: string;
  suggestedAction?: string;
  createdAt: Date;
}

// =============================================================================
// COMPARATIVE ANALYSIS TYPES
// =============================================================================

export interface ComparativeAnalysisRequest {
  currentPeriod: DateRange;
  comparisonPeriod: DateRange;
  metrics: ComparativeMetric[];
  filters?: Partial<FilterState>;
  groupBy?: 'product' | 'category' | 'channel' | 'segment';
}

export type ComparativeMetric =
  | 'volume'
  | 'sentiment'
  | 'nps'
  | 'resolution_time'
  | 'escalation_rate'
  | 'social_mentions';

export interface ComparativeAnalysisResult {
  currentPeriod: DateRange;
  comparisonPeriod: DateRange;

  // Overall comparison
  overall: ComparativeMetricResult[];

  // Grouped comparison (if groupBy specified)
  byGroup?: Record<string, ComparativeMetricResult[]>;

  // Insights
  significantChanges: SignificantChange[];

  // Generated insight
  aiSummary?: string;
}

export interface ComparativeMetricResult {
  metric: ComparativeMetric;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number;
  trend: TrendDirection;
  isSignificant: boolean; // Statistical significance
}

export interface SignificantChange {
  metric: ComparativeMetric;
  group?: string;
  change: number;
  percentageChange: number;
  direction: 'increase' | 'decrease';
  severity: SeverityType;
  description: string;
  possibleCauses?: string[];
}

// Analysis Platform Data Models

// Timeline Events (outages, launches, etc.)
export interface TimelineEvent {
  id: string;
  date: Date;
  type: 'outage' | 'launch' | 'issue' | 'resolution' | 'announcement';
  label: string;
  product: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

// Sentiment bubbles for timeline chart
export interface SentimentBubble {
  id: string;
  date: Date;
  volume: number; // Communication count
  surveyCount: number; // Survey response count
  sentiment: number;
  socialSentiment: number;
  themes: string[];
  product: string;
  channel: string;
  // NPS fields
  npsScore: number; // Aggregate NPS (-100 to +100)
  promoterPct: number; // % scoring 9-10
  passivePct: number; // % scoring 7-8
  detractorPct: number; // % scoring 0-6
}

// Journey stages for waterfall chart
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
  // NPS fields
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

// Quadrant items for scatter plot
export interface QuadrantItem {
  id: string;
  label: string;
  sentiment: number;
  volume: number;
  category: string;
  product: string;
  quadrant: 'critical' | 'watch' | 'strength' | 'noise';
  // NPS fields
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

// Context object emitted to AI panel
export interface AnalysisContext {
  timeWindow?: { start: Date; end: Date };
  product?: string;
  channel?: string;
  signal?: string;
  event?: TimelineEvent;
  journeyStage?: JourneyStage;
  quadrant?: string;
  selectedItems?: string[];
  selectedBubble?: SentimentBubble; // Full bubble data for contextual insights
}

// AI Research Panel content
export interface ResearchInsight {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  keyDrivers: string[];
  evidence: EvidenceItem[];
  totalCommunications?: number; // Total matching communications (evidence is a sample)
  timelineReasoning: string;
  suggestedActions: string[];
  suggestedQuestions?: string[]; // LLM-generated contextual follow-up questions
  suggestedFollowUp?: {
    question: string;
    answer: string;
  };
}

export interface EvidenceItem {
  id: string;
  type: 'complaint' | 'social' | 'call' | 'news';
  source: string;
  timestamp: Date;
  excerpt: string;
  sentiment: number;
  linkedChartId?: string;
}

// Filter state
export interface FilterState {
  dateRange: string; // '7d', '30d', '90d', 'ytd', 'all'
  dateRangeObj?: { start: Date; end: Date };
  products: string[];
  channels: string[];
  product: string; // single selected product
  channel: string; // single selected channel
  showEvents: boolean;
  surveysOnly: boolean; // Only show bubbles with survey data
}

// Product types
export type ProductType =
  | 'cards'
  | 'loans'
  | 'savings'
  | 'current-account'
  | 'mortgage'
  | 'insurance'
  | 'all';
export type ChannelType = 'complaints' | 'calls' | 'email' | 'social' | 'all';

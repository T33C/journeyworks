/**
 * Research Types
 *
 * Type definitions for the research agent and its operations.
 */

/**
 * Research request from user
 */
export interface ResearchRequest {
  /** The research question or task */
  query: string;
  /** Context or background information */
  context?: string;
  /** Maximum iterations for the agent */
  maxIterations?: number;
  /** Tools to enable/disable */
  enabledTools?: string[];
  /** Conversation history for multi-turn */
  conversationHistory?: ConversationTurn[];
  /** Target customer if focusing on one */
  customerId?: string;
  /** Time range for research */
  timeRange?: {
    from?: string;
    to?: string;
  };
}

/**
 * Conversation turn in history
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Research response from agent
 */
export interface ResearchResponse {
  /** The agent's answer */
  answer: string;
  /** Confidence in the answer */
  confidence: number;
  /** Sources used */
  sources: ResearchSource[];
  /** Charts for data visualization */
  charts?: InsightChart[];
  /** Thought process (reasoning steps) */
  reasoning: ReasoningStep[];
  /** Actions taken */
  actions: AgentAction[];
  /** Follow-up questions suggested */
  followUpQuestions?: string[];
  /** Processing statistics */
  stats: ResearchStats;
}

/**
 * Source referenced in research
 */
export interface ResearchSource {
  /** Source type */
  type: 'communication' | 'analysis' | 'aggregation' | 'external';
  /** Source ID */
  id: string;
  /** Title or description */
  title: string;
  /** Relevance score */
  relevance: number;
  /** Excerpt */
  excerpt?: string;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * A reasoning step in the agent's thought process
 */
export interface ReasoningStep {
  /** Step number */
  step: number;
  /** Thought content */
  thought: string;
  /** Action decided */
  action?: string;
  /** Action input */
  actionInput?: any;
  /** Observation from action */
  observation?: string;
}

/**
 * An action taken by the agent
 */
export interface AgentAction {
  /** Tool used */
  tool: string;
  /** Input to the tool */
  input: any;
  /** Output from the tool */
  output: any;
  /** Duration in ms */
  duration: number;
  /** Whether it succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Statistics about the research process
 */
export interface ResearchStats {
  /** Total processing time */
  totalTime: number;
  /** Number of iterations */
  iterations: number;
  /** Number of tool calls */
  toolCalls: number;
  /** Tokens used (if available) */
  tokensUsed?: number;
  /** Model used */
  model?: string;
}

/**
 * Tool definition for the agent
 */
export interface AgentTool {
  /** Tool name */
  name: string;
  /** Tool description for the agent */
  description: string;
  /** Parameter schema */
  parameters: ToolParameters;
  /** Function to execute the tool */
  execute: (input: any) => Promise<any>;
}

/**
 * Tool parameter schema
 */
export interface ToolParameters {
  type: 'object';
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
    }
  >;
  required?: string[];
}

/**
 * Agent state during execution
 */
export interface AgentState {
  /** Current iteration */
  iteration: number;
  /** Maximum iterations */
  maxIterations: number;
  /** History of steps */
  steps: ReasoningStep[];
  /** Actions taken */
  actions: AgentAction[];
  /** Sources collected */
  sources: ResearchSource[];
  /** Whether the agent is done */
  isDone: boolean;
  /** Final answer if done */
  finalAnswer?: string;
  /** Error if failed */
  error?: string;
}

/**
 * ReAct prompt components
 */
export interface ReActPrompt {
  /** System prompt */
  system: string;
  /** Available tools description */
  tools: string;
  /** Question being answered */
  question: string;
  /** Scratchpad (previous steps) */
  scratchpad: string;
}

// =============================================================================
// Context-Aware Insight Types (for dashboard integration)
// =============================================================================

/**
 * Timeline event data for context
 */
export interface TimelineEventContext {
  id: string;
  date: string;
  type: 'outage' | 'launch' | 'issue' | 'resolution' | 'announcement';
  label: string;
  product: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

/**
 * Sentiment bubble data for context
 */
export interface SentimentBubbleContext {
  id: string;
  date: string;
  volume: number;
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
 * Journey stage data for context
 */
export interface JourneyStageContext {
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
 * Quadrant item data for context
 */
export interface QuadrantItemContext {
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

/**
 * Analysis context from dashboard selections
 */
export interface AnalysisContext {
  /** Selected time window */
  timeWindow?: { start: string; end: string };
  /** Selected product filter */
  product?: string;
  /** Selected channel filter */
  channel?: string;
  /** Selected signal type */
  signal?: string;
  /** Selected timeline event */
  event?: TimelineEventContext;
  /** Selected journey stage */
  journeyStage?: JourneyStageContext;
  /** Selected quadrant */
  quadrant?: string;
  /** Selected quadrant item(s) */
  selectedItems?: string[];
  /** Selected sentiment bubble */
  selectedBubble?: SentimentBubbleContext;
}

/**
 * Evidence item supporting the insight
 */
export interface InsightEvidence {
  id: string;
  type: 'complaint' | 'social' | 'call' | 'news';
  source: string;
  timestamp: string;
  excerpt: string;
  sentiment: number;
  linkedChartId?: string;
}

/**
 * Chart data point for research insight visualization
 */
export interface InsightChartDataPoint {
  label: string;
  value: number;
  color?: string;
  date?: string; // ISO date string for time-series
}

/**
 * Chart configuration for insight visualization
 */
export interface InsightChart {
  type: 'bar' | 'pie' | 'time-series';
  title: string;
  data: InsightChartDataPoint[];
  xLabel?: string;
  yLabel?: string;
}

/**
 * Context-aware research insight response
 */
export interface ResearchInsight {
  /** Main summary of the insight */
  summary: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Key drivers identified */
  keyDrivers: string[];
  /** Evidence supporting the insight */
  evidence: InsightEvidence[];
  /** Total matching communications (evidence is a sample) */
  totalCommunications?: number;
  /** Reasoning about timeline patterns */
  timelineReasoning: string;
  /** Suggested actions to take */
  suggestedActions: string[];
  /** LLM-generated contextual follow-up questions */
  suggestedQuestions?: string[];
  /** Optional follow-up Q&A */
  suggestedFollowUp?: {
    question: string;
    answer: string;
  };
  /** Optional charts for data visualization */
  charts?: InsightChart[];
}

/**
 * Request for context-aware insight
 */
export interface InsightRequest {
  /** Analysis context from dashboard */
  context: AnalysisContext;
  /** Optional specific question */
  question?: string;
  /** Whether to use cached insights */
  useCache?: boolean;
}

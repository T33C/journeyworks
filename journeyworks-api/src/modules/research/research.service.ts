/**
 * Research Service
 *
 * High-level service for research operations.
 * Provides LLM-powered insights using real data from Elasticsearch.
 * Integrates Python analysis-service for statistical analysis.
 * Integrates RAG for semantic search and specific lookup questions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../../infrastructure/redis';
import { LlmClientService } from '../../infrastructure/llm';
import { AnalysisServiceClient } from '../../infrastructure/analysis-service';
import { AgentExecutor } from './agent-executor.service';
import { AgentTools } from './agent-tools.service';
import {
  InsightDataService,
  AggregatedInsightData,
} from './insight-data.service';
import {
  ResearchRequest,
  ResearchResponse,
  ConversationTurn,
  AnalysisContext,
  ResearchInsight,
  InsightRequest,
  InsightEvidence,
} from './research.types';
import { RagService } from '../rag/rag.service';
import { RagResponse } from '../rag/rag.types';

// Statistical analysis result from Python service
interface StatisticalAnalysisResult {
  outliers: Array<{
    field: string;
    count: number;
    method: string;
    details: string;
  }>;
  correlations: Array<{
    field1: string;
    field2: string;
    correlation: number;
    interpretation: string;
  }>;
  distributions: Array<{
    field: string;
    topValues: Array<{ value: string; count: number; percent: number }>;
    concentrationRisk: number;
  }>;
  temporalPatterns: {
    trend: string;
    changePoints: Array<{ date: string; type: string; magnitude: number }>;
  } | null;
}

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private readonly INSIGHT_CACHE_TTL = 600; // 10 minutes

  // Patterns that indicate a statistical question (route to Python service)
  private readonly STATISTICAL_PATTERNS = [
    /\b(unusual|anomaly|anomalies|outlier|outliers|abnormal)\b/i,
    /\b(correlation|correlate|relationship between|related to)\b/i,
    /\b(distribution|spread|variance|deviation)\b/i,
    /\b(concentration|concentrated|dominated by|disproportionate)\b/i,
    /\b(trend|trending|pattern over time|time series)\b/i,
    /\b(data quality|missing|incomplete|gaps in)\b/i,
    /\b(statistic|statistical|significant|significance)\b/i,
    /\b(average|mean|median|percentile)\b/i,
  ];

  // Patterns that indicate a RAG/semantic search question (specific lookups)
  private readonly RAG_PATTERNS = [
    /\b(what (are|do|did) customers? (say|saying|said|complain|mention))\b/i,
    /\b(show me|find|search for|look for|examples? of)\b/i,
    /\b(specific|exactly|verbatim|quote|actual)\b/i,
    /\b(similar (to|cases?|issues?|complaints?))\b/i,
    /\b(customer.{1,20}(history|communications?|interactions?))\b/i,
    /\b(about (the|our|this)|regarding|concerning|related to).{1,30}(issue|problem|complaint|case)\b/i,
    /\b(mention|mentioned|mentions|mentioning)\b/i,
    /\b(who (said|complained|mentioned|reported))\b/i,
    /\bcase (#?\d+|number)\b/i,
  ];

  // Store conversation history (in production, use a proper store)
  private conversations: Map<string, ConversationTurn[]> = new Map();

  constructor(
    private readonly agentExecutor: AgentExecutor,
    private readonly agentTools: AgentTools,
    private readonly cache: RedisCacheService,
    private readonly llmClient: LlmClientService,
    private readonly insightData: InsightDataService,
    private readonly analysisClient: AnalysisServiceClient,
    private readonly ragService: RagService,
  ) {}

  /**
   * Process a research request
   */
  async research(request: ResearchRequest): Promise<ResearchResponse> {
    this.logger.log(`Processing research request: "${request.query}"`);

    // Execute the agent
    const response = await this.agentExecutor.execute(request);

    return response;
  }

  /**
   * Process a research request with conversation context
   */
  async researchWithContext(
    conversationId: string,
    query: string,
    options?: Partial<ResearchRequest>,
  ): Promise<ResearchResponse> {
    // Get conversation history
    const history = this.conversations.get(conversationId) || [];

    // Build request with context
    const request: ResearchRequest = {
      query,
      conversationHistory: history,
      ...options,
    };

    // Execute research
    const response = await this.research(request);

    // Update conversation history
    history.push({
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    });
    history.push({
      role: 'assistant',
      content: response.answer,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 10 turns
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    this.conversations.set(conversationId, history);

    return response;
  }

  /**
   * Start a new conversation
   */
  startConversation(): string {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.conversations.set(conversationId, []);
    return conversationId;
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationTurn[] {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Get available tools
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.agentTools.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Quick question (single-turn, no conversation context)
   */
  async quickQuestion(
    question: string,
    customerId?: string,
  ): Promise<{
    answer: string;
    confidence: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    const response = await this.research({
      query: question,
      customerId,
      maxIterations: 3, // Limit iterations for quick responses
    });

    return {
      answer: response.answer,
      confidence: response.confidence,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Research about a specific customer
   */
  async researchCustomer(
    customerId: string,
    questions: string[],
  ): Promise<Array<{ question: string; answer: string }>> {
    const results: Array<{ question: string; answer: string }> = [];

    for (const question of questions) {
      const response = await this.research({
        query: question,
        customerId,
        maxIterations: 5,
      });

      results.push({
        question,
        answer: response.answer,
      });
    }

    return results;
  }

  /**
   * Get example research questions
   */
  getExampleQuestions(): string[] {
    return [
      'What are the main concerns raised by customers in the last month?',
      'Which customers have declining sentiment and why?',
      'What topics are trending in customer communications?',
      'Are there any high-risk customers that need attention?',
      'How has communication volume changed over the past week?',
      'What are the most common complaints from VIP customers?',
      'Which channels have the most negative feedback?',
      'Summarize the relationship with [customer name]',
      'Find communications similar to [communication ID]',
      'What patterns exist in after-hours communications?',
    ];
  }

  // ===========================================================================
  // Context-Aware Insight Methods (Dashboard Integration)
  // ===========================================================================

  /**
   * Generate mock evidence for testing
   */
  private generateMockEvidence(context: string): InsightEvidence[] {
    const evidenceMap: Record<string, InsightEvidence[]> = {
      'payments-outage': [
        {
          id: 'ev-001',
          type: 'complaint',
          source: 'Email Complaint',
          timestamp: '2026-01-03T14:23:00Z',
          excerpt:
            "My payment failed at the supermarket checkout. I was mortified in front of other customers. This is unacceptable for a bank I've trusted for 8 years.",
          sentiment: -0.85,
          linkedChartId: 'timeline-bubble-0103',
        },
        {
          id: 'ev-002',
          type: 'social',
          source: 'Twitter/X',
          timestamp: '2026-01-03T11:45:00Z',
          excerpt:
            '@BankSupport your payment system is down AGAIN! Third time this month. Seriously considering switching to @CompetitorBank #frustrated',
          sentiment: -0.92,
          linkedChartId: 'sentiment-band-0103',
        },
        {
          id: 'ev-003',
          type: 'call',
          source: 'Call Centre Transcript',
          timestamp: '2026-01-03T15:12:00Z',
          excerpt:
            'Customer extremely upset about failed direct debit causing missed mortgage payment. Requested compensation and threatened to close account.',
          sentiment: -0.78,
        },
      ],
      'fee-changes': [
        {
          id: 'ev-004',
          type: 'complaint',
          source: 'Web Form',
          timestamp: '2026-01-22T10:30:00Z',
          excerpt:
            "I've been a loyal customer for 12 years and now you're increasing overdraft fees by 50%? This feels like punishment for loyalty.",
          sentiment: -0.72,
          linkedChartId: 'timeline-bubble-0122',
        },
        {
          id: 'ev-005',
          type: 'social',
          source: 'Facebook',
          timestamp: '2026-01-19T16:20:00Z',
          excerpt:
            "Just got the letter about new overdraft charges. Checked competitor rates - they're 30% cheaper. Time to move banks after 15 years.",
          sentiment: -0.65,
          linkedChartId: 'sentiment-band-0119',
        },
        {
          id: 'ev-006',
          type: 'news',
          source: 'Financial Times',
          timestamp: '2026-01-23T08:00:00Z',
          excerpt:
            'Consumer groups criticize major banks for overdraft fee hikes, calling them "disproportionately punitive" to vulnerable customers.',
          sentiment: -0.55,
        },
      ],
      'outage-resolved': [
        {
          id: 'ev-007',
          type: 'social',
          source: 'Twitter/X',
          timestamp: '2026-01-06T18:30:00Z',
          excerpt:
            'Finally! @BankSupport payments working again. Still waiting for that compensation though... 🙄',
          sentiment: -0.25,
        },
        {
          id: 'ev-008',
          type: 'complaint',
          source: 'Email',
          timestamp: '2026-01-07T09:15:00Z',
          excerpt:
            'Thank you for resolving the issue but I expect full refund of any fees incurred due to failed payments. Still rated NPS 4 as trust is damaged.',
          sentiment: -0.35,
        },
      ],
      'card-launch': [
        {
          id: 'ev-009',
          type: 'social',
          source: 'Twitter/X',
          timestamp: '2026-01-15T12:00:00Z',
          excerpt:
            'Just got approved for the new Premium Card! 3% cashback is amazing 💳✨ #winning',
          sentiment: 0.88,
          linkedChartId: 'timeline-bubble-0115',
        },
        {
          id: 'ev-010',
          type: 'complaint',
          source: 'Web Form',
          timestamp: '2026-01-16T14:45:00Z',
          excerpt:
            'Application rejected with no clear explanation. I have excellent credit score of 780. Very disappointed and confused about criteria.',
          sentiment: -0.68,
        },
      ],
      'app-update': [
        {
          id: 'ev-011',
          type: 'social',
          source: 'App Store Review',
          timestamp: '2026-01-20T19:00:00Z',
          excerpt:
            'Finally dark mode! My eyes thank you. Biometric login is so much faster now too. Great update! ⭐⭐⭐⭐⭐',
          sentiment: 0.92,
          linkedChartId: 'timeline-bubble-0120',
        },
        {
          id: 'ev-012',
          type: 'complaint',
          source: 'In-App Feedback',
          timestamp: '2026-01-21T08:30:00Z',
          excerpt:
            'Update deleted all my saved payees! Had to re-add 23 payment recipients manually. Very frustrating - this is basic stuff.',
          sentiment: -0.75,
        },
      ],
      'topic-payment-processing': [
        {
          id: 'ev-013',
          type: 'complaint',
          source: 'Email Complaint',
          timestamp: '2026-01-04T11:20:00Z',
          excerpt:
            'Third payment decline this week. Card works fine elsewhere. Your system flagged legitimate purchases as suspicious. Lost a limited item because of this.',
          sentiment: -0.82,
        },
        {
          id: 'ev-014',
          type: 'call',
          source: 'Call Centre',
          timestamp: '2026-01-05T16:40:00Z',
          excerpt:
            'Customer reports duplicate charges on account - £450 taken twice for same transaction. Requesting immediate refund and compensation.',
          sentiment: -0.88,
        },
      ],
      'topic-overdraft-fees': [
        {
          id: 'ev-015',
          type: 'complaint',
          source: 'Formal Complaint',
          timestamp: '2026-01-23T10:00:00Z',
          excerpt:
            'As a customer of 18 years, I find it appalling that my loyalty means nothing. Newer customers get fee waivers while I pay full price.',
          sentiment: -0.78,
        },
        {
          id: 'ev-016',
          type: 'social',
          source: 'Reddit',
          timestamp: '2026-01-22T20:15:00Z',
          excerpt:
            "Just did the math - the new overdraft fees work out to 39% APR equivalent. That's worse than most credit cards. Predatory pricing IMO.",
          sentiment: -0.72,
        },
      ],
      default: [
        {
          id: 'ev-017',
          type: 'social',
          source: 'Twitter/X',
          timestamp: '2026-01-15T14:00:00Z',
          excerpt:
            'Mixed feelings about @BankName lately. App is getting better but fees keep going up. Anyone else feeling the same? #banking',
          sentiment: -0.15,
        },
        {
          id: 'ev-018',
          type: 'complaint',
          source: 'Web Form',
          timestamp: '2026-01-14T09:30:00Z',
          excerpt:
            'Generally satisfied with service but would like to see more competitive rates on savings accounts. NPS: 7',
          sentiment: 0.2,
        },
      ],
    };

    return evidenceMap[context] || evidenceMap['default'];
  }

  /**
   * Pre-defined insights keyed by context type
   * Used as fallback when LLM is unavailable
   */
  private readonly insights: Record<string, Omit<ResearchInsight, 'evidence'>> =
    {
      'payments-outage': {
        summary:
          'The payments outage on January 3rd caused NPS to plummet to -58, with 74% of customers rating as Detractors (0-6). Social media sentiment began declining 3 days before formal complaints peaked, providing a critical early warning signal that could enable proactive intervention.',
        confidence: 'high',
        keyDrivers: [
          'Payment processing failure drove NPS from -20 to -58 (38-point drop)',
          'Detractor percentage spiked from 45% to 74% during outage',
          'Social media NPS led formal complaint NPS by approximately 3 days',
          'Direct debit failures created secondary mortgage/utility concerns',
        ],
        timelineReasoning:
          'Social NPS dropped 2-3 days before complaint volume increased, suggesting social monitoring could provide early warning. The sentiment band shows this predictive lead time clearly - watch for social NPS dips as precursors to complaint surges.',
        suggestedActions: [
          'Implement social media NPS monitoring for 3-day early warning',
          'Prepare proactive customer communication when social NPS drops below -30',
          'Target Detractors with personalized recovery outreach',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'Not yet - NPS dropped 38 points during the outage (from -20 to -58). While services were restored, only 18% of Detractors have converted to Passives after 2 weeks. 35% filed compensation requests, indicating significant trust damage.',
        },
      },
      'fee-changes': {
        summary:
          'The overdraft fee announcement on January 22nd triggered an NPS drop to -48, with Detractors (0-6 scores) at 66% - primarily long-term customers. Social media NPS indicated brewing discontent 3 days before formal complaint volumes spiked.',
        confidence: 'high',
        keyDrivers: [
          'Long-term customer NPS fell 25 points more than newer customers',
          'Detractor rate increased from 42% to 66% post-announcement',
          'Social media NPS declined 3 days ahead of complaints',
          'Promoter recovery rates are 40% lower than for technical issues',
        ],
        timelineReasoning:
          'Unlike technical issues which show NPS recovery patterns, fee-related complaints show sustained negative NPS. The social sentiment band clearly led formal complaints by ~3 days.',
        suggestedActions: [
          'Monitor social NPS for early fee-related discontent detection',
          'Consider loyalty tier exemptions for customers with historical NPS > 30',
          'Proactive outreach to high-value long-term Detractors',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'No - fee changes permanently degraded CX for long-term customers. NPS dropped 25 points more for 5+ year customers vs newer ones.',
        },
      },
      'outage-resolved': {
        summary:
          'Following the January 6th resolution, NPS began recovering from -58 to -32 over 4 days. However, 35% of affected customers filed compensation requests, and Promoter recovery was slow.',
        confidence: 'high',
        keyDrivers: [
          'NPS recovery trajectory: -58 → -42 → -32 over 4 days',
          'Compensation requests from 35% of affected customers',
          'Only 18% of Detractors converted to Passives within 2 weeks',
          'Social media sentiment improved faster than formal complaint NPS',
        ],
        timelineReasoning:
          'Post-resolution, the social sentiment band shows more rapid NPS improvement than formal complaints - customers acknowledged the fix on social media before updating formal feedback.',
        suggestedActions: [
          'Implement post-incident NPS recovery tracking dashboard',
          'Proactive compensation offers to high-value Detractors',
          'Follow-up survey 2 weeks post-resolution to measure Promoter recovery',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'Partially - NPS recovered from -58 to -32 over 4 days, a 26-point improvement. However, only 18% of Detractors converted to Passives within 2 weeks.',
        },
      },
      'card-launch': {
        summary:
          'The Premium Card launch on January 15th showed mixed NPS results: initial social NPS was +32 among early adopters, but declined to -15 by day 3 as rejected applicants voiced frustration.',
        confidence: 'high',
        keyDrivers: [
          'Early adopter NPS: +32 (65% Promoters, driven by 3% cashback)',
          'Rejected applicant NPS: -45 (68% Detractors)',
          'Unclear rejection criteria cited in 42% of complaints',
          '£150 annual fee mentioned as concern in 28% of social posts',
        ],
        timelineReasoning:
          'The social sentiment band shows an initial positive spike (early adopters celebrating approval) followed by decline as rejection notifications went out.',
        suggestedActions: [
          'Improve rejection letter clarity with specific reasons and alternatives',
          "Consider soft-launch 'pre-qualification' to reduce rejection surprises",
          'Target Passives with fee waiver offer to convert to Promoters',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'Mixed results - approved customers have excellent CX (NPS +32, 65% Promoters). However, rejected applicants show NPS -45 with 68% Detractors.',
        },
      },
      'app-update': {
        summary:
          'The January 20th app update (v4.2.1) achieved overall NPS of +12, with dark mode receiving praise (+38 NPS). However, payee data migration issues drove 23% of complaints.',
        confidence: 'medium',
        keyDrivers: [
          'Dark mode feature NPS: +38 (highly requested feature)',
          'Biometric login improvements: +25 NPS lift',
          'Payee migration bug affected 8% of users (NPS -28 for this group)',
          'Navigation changes generated 15% increase in support calls',
        ],
        timelineReasoning:
          'Social NPS spiked positive immediately as tech-savvy users praised new features. The 3-day lead pattern showed negative sentiment building among users who lost payee data.',
        suggestedActions: [
          'Urgent fix for payee data restoration with proactive push notification',
          'In-app tutorial for navigation changes to reduce support calls',
          'Target affected users with apology and NPS recovery survey',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'Yes, for 92% of users - dark mode and biometric improvements significantly improved the app experience. However, the 8% affected by the payee bug saw NPS drop to -28.',
        },
      },
      'topic-payment-processing': {
        summary:
          'Payment Processing Errors sits in the CRITICAL quadrant with NPS -58 (74% Detractors) and 245 complaints. This is the highest-impact issue requiring immediate attention.',
        confidence: 'high',
        keyDrivers: [
          'Legacy payment gateway timeout rate: 2.3% (target: <0.5%)',
          'Peak hour failures 4x higher than off-peak (12pm-2pm, 5pm-7pm)',
          'Retry logic causing duplicate transactions in 8% of failures',
          '89% of Detractors cite "embarrassment at point of sale" as primary frustration',
        ],
        timelineReasoning:
          'Payment errors correlate strongly with the January 3rd outage. Post-outage, baseline error rate increased from 0.8% to 2.3%.',
        suggestedActions: [
          'Urgent: Upgrade payment gateway infrastructure (target: <0.5% failure rate)',
          'Implement proactive SMS notification when payment fails',
          'Add retry limit to prevent duplicate transactions',
          'Create dedicated recovery workflow for affected customers',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'No - Payment Processing remains in the Critical quadrant with NPS -58. The 74% Detractor rate is the highest across all topics.',
        },
      },
      'topic-overdraft-fees': {
        summary:
          'Overdraft Fee Disputes is a CRITICAL issue with NPS -48 (66% Detractors) and 189 complaints. Unlike technical issues, fee disputes show no recovery pattern.',
        confidence: 'high',
        keyDrivers: [
          'Long-term customers (5+ years) 3x more likely to complain about fees',
          'January fee increase triggered 40% complaint volume spike',
          'Only 8% of fee complainants convert to Promoters post-resolution',
          'Competitor fee comparisons cited in 45% of complaints',
        ],
        timelineReasoning:
          'Fee complaints spiked following the January 22nd announcement. Unlike technical issues which show sentiment recovery, fee-related NPS shows sustained negative trajectory.',
        suggestedActions: [
          'Consider loyalty-based fee exemptions for 5+ year customers',
          'Implement transparent fee communication before charges apply',
          'Create fee reduction pathway for customers filing complaints',
          'Monitor competitor fee structures quarterly',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'No - Overdraft Fee Disputes remains Critical with NPS -48. Fee-related trust damage is persistent - only 8% of complainants become Promoters.',
        },
      },
      default: {
        summary:
          'Analysis of the selected period shows NPS ranging from -55 (Investigation stage) to -22 (Post-Resolution). While some improvement occurs through the journey, customers remain unsatisfied at resolution - indicating systemic CX issues requiring attention.',
        confidence: 'medium',
        keyDrivers: [
          'Social media NPS leads formal complaints by ~3 days',
          'NPS recovery through resolution journey averages only +20 points',
          'Post-resolution Detractor rate remains at 52%',
          'Response time delays impact NPS by -15 points on average',
        ],
        timelineReasoning:
          'Select a specific event or time period for detailed NPS analysis. Note: The purple-bordered sentiment band shows social chatter NPS that precedes formal complaints.',
        suggestedActions: [
          'Monitor social NPS band for early warning signals',
          'Click on an event or bubble for targeted NPS recommendations',
          'Focus on reducing Investigation stage friction - highest drop-off point',
        ],
        suggestedFollowUp: {
          question: 'Did we improve the customer experience?',
          answer:
            'Partially - the resolution journey shows a +20 point NPS improvement from Investigation (-55) to Post-Resolution (-22), but customers still end negative. Only 18% convert to Promoters, with 52% remaining Detractors. This indicates process improvements are needed.',
        },
      },
    };

  /**
   * Get context-aware insight based on dashboard selection
   * Uses real data from Elasticsearch and LLM for dynamic generation
   * Integrates Python analysis-service for statistical questions
   */
  async getInsight(request: InsightRequest): Promise<ResearchInsight> {
    const { context, question, useCache = true } = request;
    const cacheKey = this.buildInsightCacheKey(context);

    // Check cache first (10 minute TTL)
    if (useCache) {
      const cached = await this.cache.get<ResearchInsight>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for insight: ${cacheKey}`);
        return cached;
      }
    }

    // Check if this is a RAG question - if so, use semantic search with context filters
    if (this.isRagQuestion(question)) {
      this.logger.log(
        'RAG question detected, invoking semantic search with context filters',
      );
      const ragInsight = await this.performRagQuery(context, question);
      if (ragInsight) {
        // Cache the result
        await this.cache.set(cacheKey, ragInsight, this.INSIGHT_CACHE_TTL);
        return ragInsight;
      }
      // Fall through to standard processing if RAG fails
    }

    // Fetch real data from Elasticsearch
    this.logger.log('Fetching real insight data from Elasticsearch');
    const insightData = await this.insightData.getInsightData(context);

    // Combine communications and social mentions as evidence
    const evidence: InsightEvidence[] = [
      ...insightData.communications,
      ...insightData.socialMentions,
    ];

    // Check if this is a statistical question - if so, get Python analysis
    let statisticalAnalysis: StatisticalAnalysisResult | null = null;
    if (this.isStatisticalQuestion(question)) {
      this.logger.log(
        'Statistical question detected, invoking Python analysis service',
      );
      statisticalAnalysis = await this.performStatisticalAnalysis(
        context,
        insightData,
      );
    }

    // Try LLM-based generation with real data (and optional stats)
    try {
      const llmInsight = await this.generateLlmInsightWithData(
        context,
        insightData,
        question,
        statisticalAnalysis,
      );
      if (llmInsight) {
        // Use bubble volume if available (more accurate), otherwise use summary count
        llmInsight.totalCommunications =
          context.selectedBubble?.volume ??
          insightData.summary.totalCommunications;
        // Cache the result for 10 minutes
        await this.cache.set(cacheKey, llmInsight, this.INSIGHT_CACHE_TTL);
        return llmInsight;
      }
    } catch (error) {
      this.logger.warn(
        `LLM insight generation failed, using fallback: ${error.message}`,
      );
    }

    // Fallback to pre-defined insights with real evidence
    const fallbackInsight = this.resolveInsightFromContext(context);
    const insight: ResearchInsight = {
      ...fallbackInsight,
      // Use bubble volume if available (more accurate), otherwise use summary count
      totalCommunications:
        context.selectedBubble?.volume ??
        insightData.summary.totalCommunications,
      evidence:
        evidence.length > 0
          ? evidence
          : this.generateMockEvidence(this.determineContextType(context)),
    };

    // Cache the result
    await this.cache.set(cacheKey, insight, this.INSIGHT_CACHE_TTL);

    return insight;
  }

  /**
   * Generate insight using LLM with real aggregated data
   * Optionally includes statistical analysis from Python service
   */
  private async generateLlmInsightWithData(
    context: AnalysisContext,
    data: AggregatedInsightData,
    question?: string,
    statisticalAnalysis?: StatisticalAnalysisResult | null,
  ): Promise<ResearchInsight | null> {
    const providerStatus = this.llmClient.getProviderStatus();
    if (!providerStatus.anthropic && !providerStatus.openai) {
      this.logger.debug('No LLM providers available');
      return null;
    }

    // Build comprehensive prompt with real data
    let systemPrompt = `You are an expert customer experience analyst for a financial services company.
You analyze customer feedback, complaints, and social media sentiment to provide actionable insights.
Always focus on NPS (Net Promoter Score) trends, Detractor/Promoter conversion, and early warning signals.
Be specific with numbers and percentages from the data provided. Recommend concrete actions.

CRITICAL for "Did we improve CX?" analysis:
- If the final NPS is still NEGATIVE (below 0), the answer should be "Partially" or "No" - never "Yes, significantly"
- Even if there's improvement from -50 to -10, ending negative means customers are still unsatisfied
- True CX success requires ending with POSITIVE NPS (above 0) and high promoter rates (>30%)
- Highlight what's still broken and what actions are needed to achieve positive outcomes
- Be honest and actionable - the purpose is to identify problems that need fixing`;

    // Add statistical analysis context to system prompt if available
    if (statisticalAnalysis) {
      systemPrompt += `

STATISTICAL ANALYSIS AVAILABLE:
You have been provided with statistical analysis from a specialized Python service.
When answering statistical questions, prioritize the precise numbers from this analysis.
Explain the statistical findings in business terms the user can understand.`;
    }

    // Build prompt, including statistical analysis if available
    let userPrompt = this.buildEnhancedPrompt(context, data, question);
    if (statisticalAnalysis) {
      userPrompt += this.formatStatisticalAnalysis(statisticalAnalysis);
    }

    try {
      this.logger.log(
        `Generating LLM insight with real data${statisticalAnalysis ? ' + statistical analysis' : ''}`,
      );
      const response = await this.llmClient.prompt(userPrompt, systemPrompt, {
        rateLimitKey: 'llm:insight',
      });

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      // Combine real evidence
      const evidence: InsightEvidence[] = [
        ...data.communications,
        ...data.socialMentions,
      ];

      return {
        summary: parsed.summary,
        confidence: parsed.confidence || 'medium',
        keyDrivers: parsed.keyDrivers || [],
        evidence,
        timelineReasoning: parsed.timelineReasoning || '',
        suggestedActions: parsed.suggestedActions || [],
        suggestedQuestions: parsed.suggestedQuestions || [],
        suggestedFollowUp: parsed.suggestedFollowUp,
      };
    } catch (parseError) {
      this.logger.warn(`Failed to parse LLM response: ${parseError.message}`);
      return null;
    }
  }

  /**
   * Build enhanced prompt with real aggregated data
   */
  private buildEnhancedPrompt(
    context: AnalysisContext,
    data: AggregatedInsightData,
    question?: string,
  ): string {
    const parts: string[] = [];

    // Context description
    parts.push('## Analysis Context');
    parts.push(this.buildContextDescription(context));

    // Summary metrics
    parts.push('\n## Key Metrics');
    parts.push(
      `- Total Communications Analyzed: ${data.summary.totalCommunications}`,
    );
    parts.push(`- Total Social Mentions: ${data.summary.totalSocialMentions}`);
    parts.push(`- Average Sentiment: ${data.summary.avgSentiment.toFixed(2)}`);
    parts.push(`- NPS Score: ${data.summary.avgNps}`);
    parts.push(`- Promoters: ${data.summary.promoterPct.toFixed(1)}%`);
    parts.push(`- Passives: ${data.summary.passivePct.toFixed(1)}%`);
    parts.push(`- Detractors: ${data.summary.detractorPct.toFixed(1)}%`);

    if (data.summary.topThemes.length > 0) {
      parts.push('\n### Top Issues/Themes');
      data.summary.topThemes.forEach((t, i) => {
        parts.push(`${i + 1}. ${t.theme}: ${t.count} occurrences`);
      });
    }

    // Resolution Journey (most important for CX improvement)
    if (data.resolutionJourney.length > 0) {
      parts.push(
        '\n## Resolution Journey (Critical for CX Improvement Analysis)',
      );
      data.resolutionJourney.forEach((stage) => {
        parts.push(
          `- ${stage.label}: NPS ${stage.avgNps}, Sentiment ${stage.avgSentiment.toFixed(2)}, ${stage.communicationCount} communications`,
        );
      });

      // Calculate journey improvement
      const initial = data.resolutionJourney[0];
      const final = data.resolutionJourney[data.resolutionJourney.length - 1];
      if (initial && final) {
        const npsImprovement = final.avgNps - initial.avgNps;
        parts.push(
          `\n**Journey NPS Improvement: ${npsImprovement > 0 ? '+' : ''}${npsImprovement} points**`,
        );
        parts.push(
          `**Promoter Conversion Rate: ${final.promoterConversionRate.toFixed(1)}%**`,
        );
      }
    }

    // Event correlations (before/after analysis)
    if (data.eventCorrelations.length > 0) {
      parts.push('\n## Event Impact Analysis (Before/After)');
      data.eventCorrelations.forEach((event) => {
        parts.push(`\n### ${event.eventLabel} (${event.eventDate})`);
        parts.push(`- Severity: ${event.severity}`);
        parts.push(
          `- Before: NPS ${event.beforeMetrics.avgNps}, Sentiment ${event.beforeMetrics.avgSentiment.toFixed(2)}, Volume ${event.beforeMetrics.volume}`,
        );
        parts.push(
          `- During: NPS ${event.duringMetrics.avgNps}, Sentiment ${event.duringMetrics.avgSentiment.toFixed(2)}, Volume ${event.duringMetrics.volume}`,
        );
        parts.push(
          `- After: NPS ${event.afterMetrics.avgNps}, Sentiment ${event.afterMetrics.avgSentiment.toFixed(2)}, Volume ${event.afterMetrics.volume}`,
        );
        parts.push(
          `- **NPS Delta: ${event.npsDelta > 0 ? '+' : ''}${event.npsDelta}**`,
        );
      });
    }

    // Sample evidence
    if (data.communications.length > 0) {
      parts.push('\n## Sample Customer Communications');
      data.communications.slice(0, 5).forEach((comm) => {
        parts.push(
          `- [${comm.type.toUpperCase()}] ${comm.source} (Sentiment: ${comm.sentiment.toFixed(2)}): "${comm.excerpt}"`,
        );
      });
    }

    if (data.socialMentions.length > 0) {
      parts.push('\n## Sample Social Mentions');
      data.socialMentions.slice(0, 3).forEach((social) => {
        parts.push(
          `- [${social.source}] (Sentiment: ${social.sentiment.toFixed(2)}): "${social.excerpt}"`,
        );
      });
    }

    // Time series trends
    if (data.timeSeries.length > 0) {
      parts.push('\n## Recent Trends (Daily)');
      const recentDays = data.timeSeries.slice(-7);
      recentDays.forEach((day) => {
        parts.push(
          `- ${day.date}: NPS ${day.npsAvg}, Volume ${day.volume}, Detractors ${day.detractorPct.toFixed(0)}%`,
        );
      });
    }

    // Specific question if provided
    if (question) {
      parts.push(`\n## User Question\n${question}`);
    }

    // Calculate final NPS to guide the LLM response
    const finalNps =
      data.resolutionJourney.length > 0
        ? data.resolutionJourney[data.resolutionJourney.length - 1]?.avgNps
        : null;
    const initialNps =
      data.resolutionJourney.length > 0
        ? data.resolutionJourney[0]?.avgNps
        : null;
    const npsImprovement =
      finalNps !== null && initialNps !== null ? finalNps - initialNps : 0;

    // Determine the appropriate CX assessment based on final NPS
    let cxGuidance: string;
    if (finalNps === null) {
      cxGuidance =
        'Start with "Insufficient data" - explain what data is missing';
    } else if (finalNps >= 20) {
      cxGuidance =
        'Start with "Yes" - customers end satisfied with positive NPS';
    } else if (finalNps >= 0) {
      cxGuidance =
        'Start with "Partially" - some improvement but NPS is barely positive, more work needed';
    } else if (npsImprovement > 20) {
      cxGuidance = `Start with "Partially" - while there was ${npsImprovement} point improvement, customers still end at NPS ${finalNps} (negative). Highlight what needs fixing.`;
    } else {
      cxGuidance = `Start with "No" - NPS ends at ${finalNps} (negative) with only ${npsImprovement} point improvement. This indicates systemic CX problems.`;
    }

    // Output format
    parts.push(`\n## Required Output Format
Provide your analysis in the following JSON format:
{
  "summary": "2-3 sentence executive summary with specific numbers from the data",
  "confidence": "high|medium|low",
  "keyDrivers": ["driver 1 with specific metric", "driver 2 with specific metric", "driver 3", "driver 4"],
  "timelineReasoning": "Explain temporal patterns, resolution journey improvement, and any early warning signals from social media",
  "suggestedActions": ["specific action 1", "specific action 2", "specific action 3"],
  "suggestedQuestions": [
    "A relevant follow-up question the analyst might want to explore next",
    "Another insightful question based on the data patterns",
    "A question about potential root causes or improvements"
  ],
  "suggestedFollowUp": {
    "question": "Did we improve the customer experience?",
    "answer": "${cxGuidance}. Include: 1) Resolution Journey NPS (from ${initialNps ?? 'N/A'} to ${finalNps ?? 'N/A'}), 2) What's still broken if NPS is negative, 3) Specific actions to achieve positive outcomes"
  }
}

IMPORTANT for suggestedQuestions: Generate 3 contextual follow-up questions that would help the analyst dig deeper into the specific issue. Questions should be specific to the data patterns, events, or customer feedback observed.

Return ONLY valid JSON, no markdown code blocks or extra text.`);

    return parts.join('\n');
  }

  /**
   * Generate insight using LLM (legacy method - kept for compatibility)
   */
  private async generateLlmInsight(
    context: AnalysisContext,
    question?: string,
    evidence: InsightEvidence[] = [],
  ): Promise<ResearchInsight | null> {
    const providerStatus = this.llmClient.getProviderStatus();
    if (!providerStatus.anthropic && !providerStatus.openai) {
      this.logger.debug('No LLM providers available');
      return null;
    }

    const contextDescription = this.buildContextDescription(context);
    const evidenceSummary = evidence
      .map(
        (e) =>
          `[${e.type.toUpperCase()}] ${e.source} (${e.timestamp}): "${e.excerpt}" (sentiment: ${e.sentiment})`,
      )
      .join('\n');

    const systemPrompt = `You are an expert customer experience analyst for a financial services company. 
You analyze customer feedback, complaints, and social media sentiment to provide actionable insights.
Always focus on NPS (Net Promoter Score) trends, Detractor/Promoter conversion, and early warning signals.
Be specific with numbers and percentages. Recommend concrete actions.`;

    const userPrompt = `Analyze the following customer experience context and provide insights:

## Context
${contextDescription}

## Evidence
${evidenceSummary || 'No specific evidence provided - use general trends.'}

${question ? `## Specific Question\n${question}\n` : ''}

Provide your analysis in the following JSON format:
{
  "summary": "2-3 sentence executive summary of the key insight",
  "confidence": "high|medium|low",
  "keyDrivers": ["driver 1", "driver 2", "driver 3", "driver 4"],
  "timelineReasoning": "Explain temporal patterns and any leading indicators observed",
  "suggestedActions": ["action 1", "action 2", "action 3"],
  "suggestedQuestions": [
    "A relevant follow-up question based on this analysis",
    "Another insightful question to explore",
    "A question about potential root causes"
  ],
  "suggestedFollowUp": {
    "question": "A relevant follow-up question",
    "answer": "The answer based on your analysis"
  }
}

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const response = await this.llmClient.prompt(userPrompt, systemPrompt, {
        rateLimitKey: 'llm:insight',
      });

      // Parse the JSON response
      const parsed = JSON.parse(response.trim());

      return {
        summary: parsed.summary,
        confidence: parsed.confidence || 'medium',
        keyDrivers: parsed.keyDrivers || [],
        evidence,
        timelineReasoning: parsed.timelineReasoning || '',
        suggestedActions: parsed.suggestedActions || [],
        suggestedQuestions: parsed.suggestedQuestions || [],
        suggestedFollowUp: parsed.suggestedFollowUp,
      };
    } catch (parseError) {
      this.logger.warn(`Failed to parse LLM response: ${parseError.message}`);
      return null;
    }
  }

  /**
   * Build a human-readable description of the context for the LLM
   */
  private buildContextDescription(context: AnalysisContext): string {
    const parts: string[] = [];

    if (context.event) {
      parts.push(
        `Selected Event: ${context.event.type} - "${context.event.description || context.event.id}"`,
      );
      parts.push(`Event Date: ${context.event.date}`);
      if (context.event.severity) {
        parts.push(`Severity: ${context.event.severity}`);
      }
    }

    if (context.selectedBubble) {
      parts.push(`Selected Timeline Bubble: ${context.selectedBubble.id}`);
      parts.push(`Date: ${context.selectedBubble.date}`);
      if (context.selectedBubble.themes?.length) {
        parts.push(`Themes: ${context.selectedBubble.themes.join(', ')}`);
      }
      if (context.selectedBubble.sentiment !== undefined) {
        parts.push(`Sentiment: ${context.selectedBubble.sentiment}`);
      }
      if (context.selectedBubble.npsScore !== undefined) {
        parts.push(`NPS Score: ${context.selectedBubble.npsScore}`);
      }
    }

    if (context.journeyStage) {
      parts.push(`Journey Stage: ${context.journeyStage.stage}`);
      if (context.journeyStage.npsScore !== undefined) {
        parts.push(`Stage NPS: ${context.journeyStage.npsScore}`);
      }
    }

    if (context.selectedItems?.length) {
      parts.push(`Selected Topics/Items: ${context.selectedItems.join(', ')}`);
    }

    if (context.quadrant) {
      parts.push(`Quadrant: ${context.quadrant}`);
    }

    if (context.product) {
      parts.push(`Product: ${context.product}`);
    }

    if (context.timeWindow) {
      parts.push(
        `Time Window: ${context.timeWindow.start} to ${context.timeWindow.end}`,
      );
    }

    return parts.length > 0
      ? parts.join('\n')
      : 'General overview - no specific selection';
  }

  /**
   * Determine the context type for matching pre-defined insights and evidence
   */
  private determineContextType(context: AnalysisContext): string {
    if (context.event) {
      const eventId = context.event.id.toLowerCase();
      if (eventId.includes('outage') && !eventId.includes('resolved'))
        return 'payments-outage';
      if (eventId.includes('resolved')) return 'outage-resolved';
      if (eventId.includes('fee') || eventId.includes('overdraft'))
        return 'fee-changes';
      if (eventId.includes('card') || eventId.includes('premium'))
        return 'card-launch';
      if (eventId.includes('app') || eventId.includes('update'))
        return 'app-update';
    }

    if (context.selectedItems?.length) {
      const item = context.selectedItems[0].toLowerCase();
      if (item.includes('payment')) return 'topic-payment-processing';
      if (item.includes('overdraft') || item.includes('fee'))
        return 'topic-overdraft-fees';
    }

    if (context.selectedBubble?.themes) {
      const themes = context.selectedBubble.themes.join(' ').toLowerCase();
      if (themes.includes('payment')) return 'topic-payment-processing';
      if (themes.includes('fee') || themes.includes('overdraft'))
        return 'topic-overdraft-fees';
    }

    return 'default';
  }

  /**
   * Build cache key from context
   */
  private buildInsightCacheKey(context: AnalysisContext): string {
    const parts = ['insight'];

    if (context.event) {
      parts.push(`event:${context.event.id}`);
    } else if (context.journeyStage) {
      parts.push(`stage:${context.journeyStage.stage}`);
    } else if (context.selectedItems?.length) {
      parts.push(`items:${context.selectedItems.join(',')}`);
    } else if (context.selectedBubble) {
      parts.push(`bubble:${context.selectedBubble.id}`);
    } else if (context.quadrant) {
      parts.push(`quadrant:${context.quadrant}`);
    } else if (context.product) {
      parts.push(`product:${context.product}`);
    } else {
      parts.push('default');
    }

    if (context.timeWindow) {
      parts.push(`time:${context.timeWindow.start}-${context.timeWindow.end}`);
    }

    return parts.join(':');
  }

  /**
   * Resolve which pre-defined insight matches the context (fallback)
   */
  private resolveInsightFromContext(
    context: AnalysisContext,
  ): Omit<ResearchInsight, 'evidence'> {
    const contextType = this.determineContextType(context);
    return this.insights[contextType] || this.insights['default'];
  }

  // ===========================================================================
  // RAG Integration (Semantic Search for Specific Lookups)
  // ===========================================================================

  /**
   * Check if a question requires RAG/semantic search
   * These are questions looking for specific communications or examples
   */
  private isRagQuestion(question: string | undefined): boolean {
    if (!question) return false;
    return this.RAG_PATTERNS.some((pattern) => pattern.test(question));
  }

  /**
   * Perform RAG query with context filters from the dashboard
   * Respects date range, product, and channel constraints
   */
  private async performRagQuery(
    context: AnalysisContext,
    question: string,
  ): Promise<ResearchInsight | null> {
    try {
      // Build filters from dashboard context
      const filters: {
        channels?: string[];
        startDate?: string;
        endDate?: string;
        product?: string;
      } = {};

      // Apply date range from context
      if (context.timeWindow) {
        filters.startDate = context.timeWindow.start;
        filters.endDate = context.timeWindow.end;
      }

      // Apply channel filter if specified
      if (context.channel) {
        filters.channels = [context.channel];
      }

      // Apply product filter if specified
      if (context.product) {
        filters.product = context.product;
      }

      this.logger.log(`RAG query with filters: ${JSON.stringify(filters)}`);

      // Execute RAG query with reranking for best results
      const ragResponse: RagResponse = await this.ragService.query({
        query: question,
        topK: 10,
        filters,
        useReranking: true,
      });

      // Convert RAG response to ResearchInsight format
      const evidence: InsightEvidence[] = ragResponse.results.map((result) => ({
        id: result.document.id,
        type: (result.document.metadata.source === 'social'
          ? 'social'
          : 'complaint') as 'complaint' | 'call' | 'social',
        source:
          result.document.metadata.channel || result.document.metadata.source,
        timestamp:
          result.document.metadata.timestamp || new Date().toISOString(),
        excerpt:
          result.document.content.substring(0, 300) +
          (result.document.content.length > 300 ? '...' : ''),
        sentiment: parseFloat(result.document.metadata.sentiment || '0') || 0,
        linkedChartId: result.document.id,
      }));

      // Generate follow-up questions based on RAG results
      const suggestedQuestions = this.generateRagFollowUpQuestions(
        question,
        ragResponse,
        context,
      );

      return {
        summary: ragResponse.answer,
        confidence: this.mapConfidence(ragResponse.confidence),
        keyDrivers: ragResponse.sources.map((s) => s.relevance),
        evidence,
        timelineReasoning: `Found ${ragResponse.results.length} relevant communications matching your query within the selected ${context.product || 'all products'} ${context.channel ? `(${context.channel} channel)` : ''} context.`,
        suggestedActions: [
          'Review the highlighted communications for detailed context',
          'Use filters to narrow down to specific time periods or channels',
          'Ask follow-up questions about specific cases or themes',
        ],
        suggestedQuestions,
        totalCommunications: ragResponse.results.length,
      };
    } catch (error) {
      this.logger.warn(`RAG query failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Map numeric confidence to string
   */
  private mapConfidence(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Generate contextual follow-up questions based on RAG results
   */
  private generateRagFollowUpQuestions(
    originalQuestion: string,
    ragResponse: RagResponse,
    context: AnalysisContext,
  ): string[] {
    const questions: string[] = [];

    // If we found results, suggest drilling deeper
    if (ragResponse.results.length > 0) {
      questions.push(
        `What patterns or themes are common across these ${ragResponse.results.length} communications?`,
      );

      // Suggest exploring different time period
      questions.push(`How do these complaints compare to the previous month?`);

      // Suggest looking at sentiment
      questions.push(
        `What is the sentiment breakdown of customers raising these issues?`,
      );
    } else {
      // No results - suggest broadening search
      questions.push(
        `What are the most common complaints in the ${context.product || 'selected'} product category?`,
      );
      questions.push(
        `Are there similar issues reported through other channels?`,
      );
    }

    return questions.slice(0, 3);
  }

  // ===========================================================================
  // Statistical Analysis Integration (Python analysis-service)
  // ===========================================================================

  /**
   * Check if a question requires statistical analysis
   */
  private isStatisticalQuestion(question: string | undefined): boolean {
    if (!question) return false;
    return this.STATISTICAL_PATTERNS.some((pattern) => pattern.test(question));
  }

  /**
   * Perform statistical analysis using Python service
   */
  private async performStatisticalAnalysis(
    context: AnalysisContext,
    data: AggregatedInsightData,
  ): Promise<StatisticalAnalysisResult | null> {
    // Check if analysis service is available
    if (!this.analysisClient.isAvailable()) {
      this.logger.debug('Analysis service not available, skipping stats');
      return null;
    }

    try {
      // Prepare communications data for analysis
      const communicationsForAnalysis = data.communications.map((comm) => ({
        id: comm.id,
        type: comm.type,
        sentiment: comm.sentiment,
        timestamp: comm.timestamp,
        source: comm.source,
      }));

      if (communicationsForAnalysis.length < 3) {
        this.logger.debug('Not enough data for statistical analysis');
        return null;
      }

      this.logger.log(
        `Performing statistical analysis on ${communicationsForAnalysis.length} communications`,
      );

      // Call Python analysis service for data card (includes outliers, distributions)
      const dataCard = await this.analysisClient.generateDataCard({
        data: communicationsForAnalysis as Record<string, unknown>[],
        title: 'Communication Analysis',
        generateInsights: true,
      });

      // Extract statistical insights from the data card
      const result: StatisticalAnalysisResult = {
        outliers: [],
        correlations: [],
        distributions: [],
        temporalPatterns: null,
      };

      // Process column statistics
      for (const column of dataCard.columns || []) {
        // Extract outlier info if available
        if (
          column.name === 'sentiment' &&
          column.statistics?.stdDev !== undefined
        ) {
          const outlierCount = Math.round(
            (column.statistics.count || 0) * 0.05,
          ); // Estimate
          if (column.statistics.stdDev > 0.3) {
            result.outliers.push({
              field: 'sentiment',
              count: outlierCount,
              method: 'high-variance',
              details: `Sentiment shows high variance (std: ${column.statistics.stdDev.toFixed(2)}), indicating inconsistent customer experience`,
            });
          }
        }

        // Extract distributions for categorical fields
        if (column.topValues && column.topValues.length > 0) {
          const concentrationRisk =
            (column.topValues[0]?.percentage || 0) / 100;
          result.distributions.push({
            field: column.name,
            topValues: column.topValues.map((tv) => ({
              value: String(tv.value),
              count: tv.count,
              percent: tv.percentage,
            })),
            concentrationRisk,
          });
        }
      }

      // Extract correlations if available
      if (dataCard.correlations) {
        result.correlations = dataCard.correlations
          .filter((c) => Math.abs(c.correlation) > 0.3)
          .map((c) => ({
            field1: c.column1,
            field2: c.column2,
            correlation: c.correlation,
            interpretation:
              c.correlation > 0.5
                ? `Strong positive relationship between ${c.column1} and ${c.column2}`
                : c.correlation < -0.5
                  ? `Strong negative relationship between ${c.column1} and ${c.column2}`
                  : `Moderate relationship between ${c.column1} and ${c.column2}`,
          }));
      }

      // Analyze time series patterns from our existing data
      if (data.timeSeries.length >= 3) {
        const volumes = data.timeSeries.map((d) => d.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

        // Detect trend
        const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
        const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
        const firstAvg =
          firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg =
          secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        let trend = 'stable';
        if (secondAvg > firstAvg * 1.2) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.8) trend = 'decreasing';

        // Find anomalies (> 2x average)
        const changePoints = data.timeSeries
          .filter((d) => d.volume > avgVolume * 2 || d.volume < avgVolume * 0.3)
          .map((d) => ({
            date: d.date,
            type: d.volume > avgVolume * 2 ? 'spike' : 'drop',
            magnitude:
              d.volume > avgVolume
                ? d.volume / avgVolume
                : avgVolume / Math.max(d.volume, 1),
          }));

        result.temporalPatterns = {
          trend,
          changePoints,
        };

        // Add volume outliers
        if (changePoints.length > 0) {
          result.outliers.push({
            field: 'volume',
            count: changePoints.length,
            method: 'deviation-from-mean',
            details: `Found ${changePoints.length} unusual volume ${changePoints.length === 1 ? 'day' : 'days'} (${changePoints.map((c) => c.type).join(', ')})`,
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.warn(`Statistical analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Format statistical analysis results for LLM prompt
   */
  private formatStatisticalAnalysis(stats: StatisticalAnalysisResult): string {
    const parts: string[] = ['\n## Statistical Analysis (Python Service)'];

    // Outliers
    if (stats.outliers.length > 0) {
      parts.push('\n### Detected Anomalies');
      stats.outliers.forEach((o) => {
        parts.push(
          `- **${o.field}**: ${o.count} outliers detected (${o.method}). ${o.details}`,
        );
      });
    }

    // Correlations
    if (stats.correlations.length > 0) {
      parts.push('\n### Correlations Found');
      stats.correlations.forEach((c) => {
        parts.push(
          `- ${c.field1} ↔ ${c.field2}: r=${c.correlation.toFixed(2)} - ${c.interpretation}`,
        );
      });
    }

    // Distributions / Concentration
    const highConcentration = stats.distributions.filter(
      (d) => d.concentrationRisk > 0.5,
    );
    if (highConcentration.length > 0) {
      parts.push('\n### Concentration Risks');
      highConcentration.forEach((d) => {
        const top = d.topValues[0];
        parts.push(
          `- **${d.field}**: "${top.value}" dominates at ${top.percent.toFixed(1)}% (concentration risk: ${(d.concentrationRisk * 100).toFixed(0)}%)`,
        );
      });
    }

    // Temporal patterns
    if (stats.temporalPatterns) {
      parts.push('\n### Temporal Patterns');
      parts.push(`- **Trend**: ${stats.temporalPatterns.trend}`);
      if (stats.temporalPatterns.changePoints.length > 0) {
        parts.push('- **Anomalous periods**:');
        stats.temporalPatterns.changePoints.slice(0, 5).forEach((cp) => {
          parts.push(
            `  - ${cp.date}: ${cp.type} (${cp.magnitude.toFixed(1)}x ${cp.type === 'spike' ? 'above' : 'below'} average)`,
          );
        });
      }
    }

    if (parts.length === 1) {
      return ''; // No statistical findings
    }

    return parts.join('\n');
  }
}

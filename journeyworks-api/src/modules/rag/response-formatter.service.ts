/**
 * Research Response Formatter Service
 *
 * Transforms raw research findings into structured, analyst-ready outputs.
 * Generates executive summaries, insight cards, and actionable recommendations.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';

// =============================================================================
// Response Types
// =============================================================================

export interface ResearchInsight {
  finding: string;
  evidence: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  trend: 'improving' | 'stable' | 'declining' | 'emerging';
}

export interface RootCause {
  cause: string;
  evidence: string;
  controllability: 'internal' | 'external' | 'partial';
}

export interface Recommendation {
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
  owner?: string;
}

export interface RiskFlag {
  risk: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'compliance' | 'reputational' | 'financial' | 'operational';
  mitigation: string;
}

export interface DataQuality {
  coverage: string;
  limitations: string[];
  confidence: number;
}

export interface StructuredResearchResponse {
  executiveSummary: string;
  insights: ResearchInsight[];
  rootCauses?: RootCause[];
  recommendations: Recommendation[];
  risks: RiskFlag[];
  dataQuality: DataQuality;
  followUpQuestions: string[];
  processingTime: number;
}

export interface InsightCard {
  headline: string;
  insight: string;
  metric?: {
    value: string;
    label: string;
    change?: string;
    direction?: 'up' | 'down' | 'stable';
  };
  severity: 'info' | 'warning' | 'alert' | 'success';
  category:
    | 'sentiment'
    | 'volume'
    | 'churn'
    | 'satisfaction'
    | 'compliance'
    | 'operational';
  tags: string[];
  actions: Array<{
    label: string;
    action: 'drillDown' | 'createCase' | 'alert' | 'export';
  }>;
  citations: string[];
}

export interface TrendAnalysis {
  trendSummary: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changeRate: {
    value: number;
    period: string;
  };
  patterns: Array<{
    type: 'seasonal' | 'cyclical' | 'anomaly' | 'inflection';
    description: string;
    timing: string;
    magnitude: string;
  }>;
  anomalies: Array<{
    date: string;
    expected: number;
    actual: number;
    deviation: string;
    possibleCause: string;
  }>;
  forecast?: {
    shortTerm: string;
    confidence: number;
  };
}

export interface FormatOptions {
  question: string;
  evidence: string;
  timePeriod?: string;
  scope?: string;
  segment?: string;
}

// =============================================================================
// Service Implementation
// =============================================================================

@Injectable()
export class ResponseFormatterService {
  private readonly logger = new Logger(ResponseFormatterService.name);

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
  ) {}

  /**
   * Format raw research findings into a structured response
   */
  async formatResearchResponse(
    options: FormatOptions,
  ): Promise<StructuredResearchResponse> {
    const startTime = Date.now();

    this.logger.log('Formatting research response');

    try {
      const prompt = this.promptTemplate.renderNamed('research:response', {
        question: options.question,
        evidence: options.evidence,
        timePeriod: options.timePeriod || 'Not specified',
        scope: options.scope || 'All data',
        segment: options.segment || 'All customers',
      });

      const systemPrompt = this.promptTemplate.getTemplate(
        'system:customerIntelligence',
      );

      const response = await this.promptWithTimeout(prompt, systemPrompt, {
        rateLimitKey: 'llm:format-response',
      });

      const formatted = this.parseStructuredResponse(response);
      formatted.processingTime = Date.now() - startTime;

      return formatted;
    } catch (error) {
      this.logger.error(`Response formatting failed: ${error.message}`);
      // Return minimal response on error
      return this.createFallbackResponse(options, startTime);
    }
  }

  /**
   * Generate an insight card from a finding
   */
  async generateInsightCard(
    finding: string,
    data: string,
    context: string,
  ): Promise<InsightCard> {
    this.logger.log('Generating insight card');

    try {
      const prompt = this.promptTemplate.renderNamed('research:insightCard', {
        finding,
        data,
        context,
      });

      const systemPrompt = this.promptTemplate.getTemplate(
        'system:customerIntelligence',
      );

      const response = await this.promptWithTimeout(prompt, systemPrompt, {
        rateLimitKey: 'llm:insight-card',
      });

      return this.parseInsightCard(response);
    } catch (error) {
      this.logger.error(`Insight card generation failed: ${error.message}`);
      return this.createFallbackInsightCard(finding);
    }
  }

  /**
   * Analyze trends in time-series data
   */
  async analyzeTrends(
    dataPoints: Array<{ date: string; value: number }>,
    metricName: string,
    metricDescription: string,
    baseline?: string,
  ): Promise<TrendAnalysis> {
    this.logger.log(`Analyzing trends for: ${metricName}`);

    try {
      const startDate = dataPoints[0]?.date || 'Unknown';
      const endDate = dataPoints[dataPoints.length - 1]?.date || 'Unknown';

      const prompt = this.promptTemplate.renderNamed('research:trend', {
        dataPoints: JSON.stringify(dataPoints, null, 2),
        metricName,
        metricDescription,
        startDate,
        endDate,
        granularity: this.detectGranularity(dataPoints),
        baseline: baseline || 'Previous period average',
      });

      const systemPrompt = this.promptTemplate.getTemplate(
        'system:customerIntelligence',
      );

      const response = await this.promptWithTimeout(prompt, systemPrompt, {
        rateLimitKey: 'llm:trend-analysis',
      });

      return this.parseTrendAnalysis(response, dataPoints);
    } catch (error) {
      this.logger.error(`Trend analysis failed: ${error.message}`);
      return this.createFallbackTrendAnalysis(dataPoints);
    }
  }

  /**
   * Quick summary without LLM call - for simple cases
   */
  createQuickSummary(
    findings: string[],
    sources: number,
  ): { summary: string; confidence: number } {
    if (findings.length === 0) {
      return {
        summary: 'No relevant information found for this query.',
        confidence: 0,
      };
    }

    const summary =
      findings.length === 1
        ? findings[0]
        : `Based on ${sources} sources: ${findings.slice(0, 3).join('. ')}${findings.length > 3 ? ` (and ${findings.length - 3} more findings)` : ''}`;

    return {
      summary,
      confidence: Math.min(0.5 + sources * 0.1, 0.95),
    };
  }

  // =============================================================================
  // Parsing Helpers
  // =============================================================================

  private parseStructuredResponse(
    response: string,
  ): StructuredResearchResponse {
    try {
      // Try brace-matching first, then markdown fences, then raw
      const braceStart = response.indexOf('{');
      const jsonStr =
        braceStart >= 0 ? this.extractJsonObject(response, braceStart) : null;

      const parsed = jsonStr ? JSON.parse(jsonStr) : JSON.parse(response);

      return {
        executiveSummary:
          parsed.executiveSummary || this.extractExecutiveSummary(response),
        insights: parsed.insights || [],
        rootCauses: parsed.rootCauses,
        recommendations: parsed.recommendations || [],
        risks: parsed.risks || [],
        dataQuality: parsed.dataQuality || {
          coverage: 'Unknown',
          limitations: [],
          confidence: 0.5,
        },
        followUpQuestions: parsed.followUpQuestions || [],
        processingTime: 0,
      };
    } catch {
      // Try to extract structured data from unstructured response
      return this.extractFromUnstructured(response);
    }
  }

  private extractExecutiveSummary(response: string): string {
    // Try to find a summary-like section
    const summaryMatch = response.match(
      /(?:summary|conclusion|key finding)[:\s]*(.*?)(?:\n|$)/i,
    );
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    // Fall back to first paragraph
    const firstParagraph = response.split('\n\n')[0];
    return firstParagraph?.substring(0, 300) || 'Analysis complete.';
  }

  private extractFromUnstructured(
    response: string,
  ): StructuredResearchResponse {
    const lines = response.split('\n').filter((l) => l.trim());

    return {
      executiveSummary: lines[0] || 'Analysis complete.',
      insights: lines.slice(1, 4).map((line) => ({
        finding: line,
        evidence: 'Extracted from analysis',
        impact: 'medium' as const,
        confidence: 0.6,
        trend: 'stable' as const,
      })),
      recommendations: [],
      risks: [],
      dataQuality: {
        coverage: 'Partial analysis',
        limitations: ['Response parsing limited'],
        confidence: 0.5,
      },
      followUpQuestions: [],
      processingTime: 0,
    };
  }

  private parseInsightCard(response: string): InsightCard {
    try {
      const braceStart = response.indexOf('{');
      const jsonStr =
        braceStart >= 0 ? this.extractJsonObject(response, braceStart) : null;
      return JSON.parse(jsonStr || response);
    } catch {
      return this.createFallbackInsightCard(response.substring(0, 100));
    }
  }

  private parseTrendAnalysis(
    response: string,
    dataPoints: Array<{ date: string; value: number }>,
  ): TrendAnalysis {
    try {
      const braceStart = response.indexOf('{');
      const jsonStr =
        braceStart >= 0 ? this.extractJsonObject(response, braceStart) : null;
      return JSON.parse(jsonStr || response);
    } catch {
      return this.createFallbackTrendAnalysis(dataPoints);
    }
  }

  // =============================================================================
  // Fallback Creators
  // =============================================================================

  private createFallbackResponse(
    options: FormatOptions,
    startTime: number,
  ): StructuredResearchResponse {
    return {
      executiveSummary: `Analysis of: ${options.question}`,
      insights: [
        {
          finding: 'Analysis could not be fully completed',
          evidence: options.evidence?.substring(0, 200) || 'Limited data',
          impact: 'medium',
          confidence: 0.3,
          trend: 'stable',
        },
      ],
      recommendations: [
        {
          action: 'Review raw data manually',
          rationale: 'Automated analysis encountered issues',
          effort: 'medium',
          expectedImpact: 'Better understanding of the data',
        },
      ],
      risks: [],
      dataQuality: {
        coverage: 'Unknown',
        limitations: ['Automated formatting failed'],
        confidence: 0.3,
      },
      followUpQuestions: ['Can you rephrase the question?'],
      processingTime: Date.now() - startTime,
    };
  }

  private createFallbackInsightCard(finding: string): InsightCard {
    return {
      headline: finding.substring(0, 50),
      insight: finding,
      severity: 'info',
      category: 'operational',
      tags: [],
      actions: [{ label: 'View Details', action: 'drillDown' }],
      citations: [],
    };
  }

  private createFallbackTrendAnalysis(
    dataPoints: Array<{ date: string; value: number }>,
  ): TrendAnalysis {
    // Simple trend detection
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const avgFirst =
      firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length || 0;
    const avgSecond =
      secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length || 0;

    const changePercent =
      avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

    let direction: TrendAnalysis['direction'] = 'stable';
    if (changePercent > 5) direction = 'increasing';
    else if (changePercent < -5) direction = 'decreasing';

    return {
      trendSummary: `Metric ${direction} by ${Math.abs(changePercent).toFixed(1)}%`,
      direction,
      changeRate: {
        value: changePercent,
        period: 'analysis period',
      },
      patterns: [],
      anomalies: [],
    };
  }

  private detectGranularity(
    dataPoints: Array<{ date: string; value: number }>,
  ): string {
    if (dataPoints.length < 2) return 'unknown';

    const date1 = new Date(dataPoints[0].date);
    const date2 = new Date(dataPoints[1].date);
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) return 'hourly';
    if (diffDays === 1) return 'daily';
    if (diffDays <= 7) return 'weekly';
    if (diffDays <= 31) return 'monthly';
    return 'quarterly';
  }

  /**
   * Wrap LLM prompt call with a timeout to prevent indefinite hangs
   */
  private promptWithTimeout(
    prompt: string,
    systemPrompt?: string,
    options?: { rateLimitKey?: string },
  ): Promise<string> {
    return this.llmClient.promptWithTimeout(prompt, systemPrompt, options);
  }

  /**
   * Extract a JSON object from a string using brace-matching
   */
  private extractJsonObject(text: string, startIndex: number): string | null {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
    return null;
  }
}

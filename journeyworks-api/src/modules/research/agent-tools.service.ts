/**
 * Agent Tools Service
 *
 * Provides tools that the ReAct agent can use to perform research.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { RrgService } from '../rrg/rrg.service';
import { AnalysisService } from '../analysis/analysis.service';
import { CommunicationsService } from '../communications/communications.service';
import { AgentTool, ResearchSource } from './research.types';

@Injectable()
export class AgentTools {
  private readonly logger = new Logger(AgentTools.name);
  private readonly tools: Map<string, AgentTool> = new Map();

  constructor(
    private readonly ragService: RagService,
    private readonly rrgService: RrgService,
    private readonly analysisService: AnalysisService,
    private readonly communicationsService: CommunicationsService,
  ) {
    this.registerTools();
  }

  /**
   * Get all available tools
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tool descriptions for the agent prompt
   */
  getToolDescriptions(): string {
    return this.getTools()
      .map((tool) => {
        const params = Object.entries(tool.parameters.properties)
          .map(
            ([key, prop]) => `    - ${key} (${prop.type}): ${prop.description}`,
          )
          .join('\n');
        return `${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
      })
      .join('\n\n');
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    name: string,
    input: any,
  ): Promise<{ output: any; sources: ResearchSource[] }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    this.logger.log(`Executing tool: ${name}`);
    const result = await tool.execute(input);

    // Extract sources from result if available
    const sources = this.extractSources(name, result);

    return { output: result, sources };
  }

  /**
   * Register all available tools
   */
  private registerTools(): void {
    // RAG Search Tool
    this.tools.set('search_knowledge_base', {
      name: 'search_knowledge_base',
      description:
        'Search the knowledge base for information relevant to a query. Use this to find specific communications, documents, or information. Returns relevant documents with context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query in natural language',
          },
          topK: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            default: 5,
          },
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter results',
          },
        },
        required: ['query'],
      },
      execute: async (input) => {
        const results = await this.ragService.semanticSearch(
          input.query,
          input.topK || 5,
          { customerId: input.customerId },
        );
        return results.map((r) => ({
          id: r.document.id,
          content: r.document.content.substring(0, 500),
          score: r.score,
          metadata: r.document.metadata,
        }));
      },
    });

    // RAG Q&A Tool
    this.tools.set('ask_question', {
      name: 'ask_question',
      description:
        'Ask a question and get an answer based on the knowledge base. Use this for direct questions that can be answered from stored communications.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to answer',
          },
          customerId: {
            type: 'string',
            description: 'Optional customer ID to focus the answer on',
          },
        },
        required: ['question'],
      },
      execute: async (input) => {
        const result = await this.ragService.query({
          query: input.question,
          filters: input.customerId
            ? { customerId: input.customerId }
            : undefined,
          useReranking: true,
        });
        return {
          answer: result.answer,
          confidence: result.confidence,
          sourceCount: result.sources.length,
        };
      },
    });

    // RRG Query Tool
    this.tools.set('query_data', {
      name: 'query_data',
      description:
        'Query structured data using natural language. Use this for aggregations, filtering, counting, and data analysis. Translates natural language to database queries.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Natural language query for data (e.g., "count emails by sentiment this week")',
          },
          execute: {
            type: 'boolean',
            description:
              'Whether to execute the query and return results (default: true)',
            default: true,
          },
        },
        required: ['query'],
      },
      execute: async (input) => {
        const result = await this.rrgService.query({
          query: input.query,
          execute: input.execute !== false,
        });
        if ('results' in result) {
          return {
            total: result.results.total,
            summary: result.summary,
            aggregations: result.results.aggregations,
            sampleDocuments: result.results.documents.slice(0, 3),
          };
        }
        return {
          dsl: result.query,
          explanation: result.explanation,
        };
      },
    });

    // Customer Health Tool
    this.tools.set('analyze_customer_health', {
      name: 'analyze_customer_health',
      description:
        'Analyze the health and relationship status of a specific customer. Returns health score, sentiment trends, risk factors, and recommendations.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'The customer ID to analyze',
          },
        },
        required: ['customerId'],
      },
      execute: async (input) => {
        const result = await this.analysisService.analyze({
          type: 'customer-health',
          targetId: input.customerId,
          options: { includeRecommendations: true },
        });
        return {
          summary: result.summary,
          healthScore: result.metrics.healthScore,
          trend: result.metrics.trend,
          riskFactors: result.metrics.riskFactors,
          recommendations: result.recommendations,
        };
      },
    });

    // Sentiment Analysis Tool
    this.tools.set('analyze_sentiment', {
      name: 'analyze_sentiment',
      description:
        'Analyze sentiment across communications. Can be filtered by customer, time range, or other criteria.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          timeRange: {
            type: 'string',
            description: 'Time range (e.g., "last 7 days", "this month")',
          },
          query: {
            type: 'string',
            description: 'Optional text query to filter communications',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const result = await this.analysisService.analyze({
          type: 'sentiment',
          targetId: input.customerId,
          query: input.query,
          timeRange,
        });
        return {
          summary: result.summary,
          sentimentBreakdown: result.metrics.sentimentBreakdown,
          averageScore: result.metrics.averageScore,
          insights: result.insights.slice(0, 3),
        };
      },
    });

    // Topic Analysis Tool
    this.tools.set('analyze_topics', {
      name: 'analyze_topics',
      description:
        'Identify and analyze topics across communications. Shows what customers are talking about.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          timeRange: {
            type: 'string',
            description: 'Time range (e.g., "last 30 days")',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const result = await this.analysisService.analyze({
          type: 'topics',
          targetId: input.customerId,
          timeRange,
        });
        return {
          summary: result.summary,
          topTopics: result.metrics.topTopics,
          insights: result.insights.slice(0, 3),
        };
      },
    });

    // Risk Assessment Tool
    this.tools.set('assess_risk', {
      name: 'assess_risk',
      description:
        'Assess risk levels based on communications. Identifies risk factors and provides mitigation recommendations.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to focus on',
          },
          timeRange: {
            type: 'string',
            description: 'Time range to analyze',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const result = await this.analysisService.analyze({
          type: 'risk-assessment',
          targetId: input.customerId,
          timeRange,
        });
        return {
          summary: result.summary,
          riskLevel: result.metrics.riskLevel,
          riskScore: result.metrics.riskScore,
          factors: result.metrics.factors?.slice(0, 5),
          mitigations: result.recommendations,
        };
      },
    });

    // Get Customer Info Tool
    this.tools.set('get_customer_info', {
      name: 'get_customer_info',
      description:
        'Get detailed information about a customer including recent communications and summary.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'The customer ID to look up',
          },
        },
        required: ['customerId'],
      },
      execute: async (input) => {
        const communications = await this.communicationsService.getByCustomer(
          input.customerId,
          0,
          10,
        );

        if (communications.total === 0) {
          return { error: 'Customer not found or no communications' };
        }

        const comms = communications.items;
        const customerName = comms[0].customerName;

        // Get summary
        const summary = await this.ragService.summarizeCustomerCommunications(
          input.customerId,
        );

        return {
          customerId: input.customerId,
          customerName,
          totalCommunications: communications.total,
          recentCommunications: comms.slice(0, 5).map((c) => ({
            date: c.timestamp,
            channel: c.channel,
            sentiment: c.sentiment?.label,
            summary: c.summary || c.content.substring(0, 100),
          })),
          relationshipSummary: summary,
        };
      },
    });

    // Find Similar Communications Tool
    this.tools.set('find_similar', {
      name: 'find_similar',
      description:
        'Find communications similar to a specific one. Useful for finding related issues or patterns.',
      parameters: {
        type: 'object',
        properties: {
          communicationId: {
            type: 'string',
            description: 'ID of the communication to find similar ones for',
          },
          topK: {
            type: 'number',
            description: 'Number of similar communications to return',
            default: 5,
          },
        },
        required: ['communicationId'],
      },
      execute: async (input) => {
        const results = await this.ragService.findSimilar(
          input.communicationId,
          input.topK || 5,
        );
        return results.map((r) => ({
          id: r.document.id,
          content: r.document.content.substring(0, 300),
          similarity: r.score,
          customer: r.document.metadata.customerName,
          channel: r.document.metadata.channel,
        }));
      },
    });

    // Trend Analysis Tool
    this.tools.set('analyze_trends', {
      name: 'analyze_trends',
      description:
        'Analyze trends over time in communications. Shows volume, sentiment, and topic trends.',
      parameters: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Time range to analyze (e.g., "last 30 days")',
          },
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const result = await this.analysisService.analyze({
          type: 'trends',
          targetId: input.customerId,
          timeRange,
        });
        return {
          summary: result.summary,
          trendDirection: result.metrics.trendDirection,
          dailyAverage: result.metrics.dailyAverageVolume,
          dateRange: result.metrics.dateRange,
        };
      },
    });
  }

  /**
   * Parse time range string into from/to dates
   */
  private parseTimeRange(timeRange: string): { from: string; to: string } {
    const now = new Date();
    const lowerRange = timeRange.toLowerCase();

    const match = lowerRange.match(/last\s+(\d+)\s+(day|week|month|year)s?/);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2];

      const from = new Date(now);
      switch (unit) {
        case 'day':
          from.setDate(from.getDate() - amount);
          break;
        case 'week':
          from.setDate(from.getDate() - amount * 7);
          break;
        case 'month':
          from.setMonth(from.getMonth() - amount);
          break;
        case 'year':
          from.setFullYear(from.getFullYear() - amount);
          break;
      }

      return {
        from: from.toISOString(),
        to: now.toISOString(),
      };
    }

    // Default to last 30 days
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  /**
   * Extract sources from tool output
   */
  private extractSources(toolName: string, output: any): ResearchSource[] {
    const sources: ResearchSource[] = [];

    if (Array.isArray(output)) {
      for (const item of output) {
        if (item.id) {
          sources.push({
            type: 'communication',
            id: item.id,
            title:
              item.summary || item.content?.substring(0, 50) || 'Communication',
            relevance: item.score || item.similarity || 0.5,
            excerpt: item.content?.substring(0, 200),
            metadata: item.metadata,
          });
        }
      }
    } else if (output && typeof output === 'object') {
      if (output.sampleDocuments) {
        for (const doc of output.sampleDocuments) {
          sources.push({
            type: 'communication',
            id: doc.id || 'unknown',
            title: doc.summary || doc.subject || 'Document',
            relevance: 0.5,
            excerpt: doc.content?.substring(0, 200),
          });
        }
      }
    }

    return sources;
  }
}

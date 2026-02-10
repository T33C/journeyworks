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
import { ElasticsearchClientService } from '../../infrastructure/elasticsearch';
import { DateRangeParser } from '../../shared/utils/date-range.util';
import { findProductByTerm } from '../synthetic/data/products';
import { AgentTool, ResearchSource, ToolParameters } from './research.types';

@Injectable()
export class AgentTools {
  private readonly logger = new Logger(AgentTools.name);
  private readonly tools: Map<string, AgentTool> = new Map();

  // Elasticsearch index constants
  private static readonly ES_INDICES = {
    communications: 'journeyworks_communications',
    cases: 'journeyworks_cases',
  } as const;

  // Default time range for queries - 'all' means no date filter
  private static readonly DEFAULT_TIME_RANGE = 'all';

  constructor(
    private readonly ragService: RagService,
    private readonly rrgService: RrgService,
    private readonly analysisService: AnalysisService,
    private readonly communicationsService: CommunicationsService,
    private readonly esClient: ElasticsearchClientService,
  ) {
    this.registerTools();
  }

  /**
   * Get Elasticsearch client or throw if unavailable
   */
  private getElasticClient() {
    const client = this.esClient.getClient();
    if (!client) {
      throw new Error('Elasticsearch client not available');
    }
    return client;
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
          .map(([key, prop]) => {
            const defaultStr =
              prop.default !== undefined ? ` (default: ${prop.default})` : '';
            return `    - ${key} (${prop.type}): ${prop.description}${defaultStr}`;
          })
          .join('\n');
        return `${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
      })
      .join('\n\n');
  }

  /**
   * Validate tool input against parameter schema
   */
  private validateToolInput(
    toolName: string,
    input: any,
    parameters: ToolParameters,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Input must be an object
    if (!input || typeof input !== 'object') {
      return { valid: false, errors: ['Input must be an object'] };
    }

    // Check required fields
    for (const requiredField of parameters.required || []) {
      if (!(requiredField in input) || input[requiredField] === undefined) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }

    // Validate field types
    for (const [key, schema] of Object.entries(parameters.properties)) {
      if (key in input && input[key] !== undefined) {
        const value = input[key];
        const expectedType = schema.type;

        if (!this.isValidType(value, expectedType)) {
          errors.push(
            `Invalid type for '${key}': expected ${expectedType}, got ${typeof value}`,
          );
        }

        // Validate enum values if specified
        if (schema.enum && !schema.enum.includes(value)) {
          errors.push(
            `Invalid value for '${key}': must be one of [${schema.enum.join(', ')}]`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if a value matches the expected type
   */
  private isValidType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return (
          typeof value === 'object' && value !== null && !Array.isArray(value)
        );
      default:
        return true; // Unknown types pass through
    }
  }

  /**
   * Execute a tool by name with input validation
   */
  async executeTool(
    name: string,
    input: any,
  ): Promise<{ output: any; sources: ResearchSource[] }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Validate input against schema
    const validation = this.validateToolInput(name, input, tool.parameters);
    if (!validation.valid) {
      this.logger.warn(
        `Tool validation failed for ${name}: ${validation.errors.join(', ')}`,
      );
      throw new Error(
        `Tool input validation failed: ${validation.errors.join('; ')}`,
      );
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
        'Analyze sentiment across communications. Can be filtered by customer, time range, product, or other criteria.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          query: {
            type: 'string',
            description: 'Optional text query to filter communications',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const product = this.normalizeProduct(input.product);
        const result = await this.analysisService.analyze({
          type: 'sentiment',
          targetId: input.customerId,
          query: input.query,
          product,
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
        'Identify and analyze topics across communications. Shows what customers are talking about. Can filter by product.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const product = this.normalizeProduct(input.product);
        const result = await this.analysisService.analyze({
          type: 'topics',
          targetId: input.customerId,
          product,
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
        'Analyze trends over time in communications. Shows volume, sentiment, and topic trends. Can filter by product.',
      parameters: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const product = this.normalizeProduct(input.product);
        const result = await this.analysisService.analyze({
          type: 'trends',
          targetId: input.customerId,
          product,
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

    // ============================================
    // NEW SPECIALIZED SKILL TOOLS
    // ============================================

    // Channel Escalation Analysis Tool
    this.tools.set('analyze_channel_escalation', {
      name: 'analyze_channel_escalation',
      description:
        'Analyze escalation patterns between channels. Use this to find how many communications escalate from one channel (e.g., chatbot) to another (e.g., human agent, phone). Returns daily counts and totals.',
      parameters: {
        type: 'object',
        properties: {
          fromChannel: {
            type: 'string',
            description: 'Source channel or mode (chatbot, chat, email)',
          },
          toChannel: {
            type: 'string',
            description: 'Target channel after escalation (human-agent, phone)',
          },
          category: {
            type: 'string',
            description: 'Optional category filter (e.g., cdd-remediation)',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
        },
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const filter: any[] = [];
          if (timeRange) {
            filter.push({
              range: { timestamp: { gte: timeRange.from, lte: timeRange.to } },
            });
          }

          // Filter by escalatedFrom field
          if (input.fromChannel) {
            filter.push({ term: { escalatedFrom: input.fromChannel } });
          }

          // Filter by target channel/chatMode
          if (input.toChannel === 'human-agent') {
            filter.push({ term: { chatMode: 'human-agent' } });
          } else if (input.toChannel) {
            filter.push({ term: { channel: input.toChannel } });
          }

          if (input.category) {
            filter.push({
              term: { 'aiClassification.category.keyword': input.category },
            });
          }

          const response = await client.search({
            index: AgentTools.ES_INDICES.communications,
            body: {
              query: { bool: { filter } },
              size: 0,
              aggs: {
                daily: {
                  date_histogram: {
                    field: 'timestamp',
                    calendar_interval: 'day',
                  },
                  aggs: { count: { value_count: { field: 'id' } } },
                },
                total: { value_count: { field: 'id' } },
              },
            },
          });

          const aggs = response.aggregations as any;
          return {
            totalEscalations: aggs?.total?.value || 0,
            dailyBreakdown: (aggs?.daily?.buckets || []).map((b: any) => ({
              date: b.key_as_string,
              count: b.count?.value || b.doc_count,
            })),
            timeRange,
          };
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // CDD Cases Analysis Tool
    this.tools.set('analyze_cdd_cases', {
      name: 'analyze_cdd_cases',
      description:
        'Analyze CDD (Customer Due Diligence) remediation cases. Returns volumes, reasons breakdown, and trends.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'Filter by specific reason (e.g., "Account Closed", "Restrictions")',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          includeChannelBreakdown: {
            type: 'boolean',
            description: 'Include breakdown by communication channel',
          },
        },
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          // Only parse time range if explicitly provided by user
          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const filter: any[] = [
            { term: { 'category.keyword': 'CDD Remediation' } },
          ];

          // Only add date filter if timeRange was specified
          if (timeRange) {
            filter.push({
              range: { createdAt: { gte: timeRange.from, lte: timeRange.to } },
            });
          }

          if (input.reason) {
            filter.push({ match: { subcategory: input.reason } });
          }

          const aggs: any = {
            by_reason: { terms: { field: 'subcategory.keyword', size: 15 } },
            daily: {
              date_histogram: { field: 'createdAt', calendar_interval: 'day' },
            },
            by_status: { terms: { field: 'status.keyword' } },
          };

          // Add channel breakdown if requested
          if (input.includeChannelBreakdown) {
            aggs.by_channel = { terms: { field: 'channel.keyword', size: 10 } };
          }

          const response = await client.search({
            index: AgentTools.ES_INDICES.cases,
            body: { query: { bool: { filter } }, size: 0, aggs },
          });

          const aggsResult = response.aggregations as any;
          const result: any = {
            totalCases: (response.hits as any)?.total?.value || 0,
            byReason: (aggsResult?.by_reason?.buckets || []).map((b: any) => ({
              reason: b.key,
              count: b.doc_count,
            })),
            dailyVolume: (aggsResult?.daily?.buckets || []).map((b: any) => ({
              date: b.key_as_string,
              count: b.doc_count,
            })),
            byStatus: (aggsResult?.by_status?.buckets || []).map((b: any) => ({
              status: b.key,
              count: b.doc_count,
            })),
            timeRange,
          };

          if (input.includeChannelBreakdown && aggsResult?.by_channel) {
            result.byChannel = (aggsResult.by_channel.buckets || []).map(
              (b: any) => ({
                channel: b.key,
                count: b.doc_count,
              }),
            );
          }

          return result;
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // Daily Volumes Tool
    this.tools.set('get_daily_volumes', {
      name: 'get_daily_volumes',
      description:
        'Get daily volume counts for communications or cases. Use for "per day" type questions. Can filter by product.',
      parameters: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            description: 'Type of data: "communications" or "cases"',
          },
          channel: {
            type: 'string',
            description: 'Filter by channel (email, phone, chat, etc.)',
          },
          category: {
            type: 'string',
            description: 'Filter by category (e.g., cdd-remediation)',
          },
          status: {
            type: 'string',
            description: 'Filter by status (e.g., escalated, open)',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., \"last 7 days\", \"this month\"). Omit to search all data.',
          },
        },
        required: ['dataType'],
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const index =
            input.dataType === 'cases'
              ? AgentTools.ES_INDICES.cases
              : AgentTools.ES_INDICES.communications;
          const dateField =
            input.dataType === 'cases' ? 'createdAt' : 'timestamp';

          const filter: any[] = [];
          if (timeRange) {
            filter.push({
              range: {
                [dateField]: { gte: timeRange.from, lte: timeRange.to },
              },
            });
          }

          if (input.channel) filter.push({ term: { channel: input.channel } });
          if (input.category) {
            const catField =
              input.dataType === 'cases'
                ? 'category.keyword'
                : 'aiClassification.category.keyword';
            filter.push({ term: { [catField]: input.category } });
          }
          if (input.status) filter.push({ term: { status: input.status } });

          if (input.product) {
            const slug = this.normalizeProduct(input.product);
            if (slug) {
              const productField =
                input.dataType === 'cases'
                  ? 'product'
                  : 'aiClassification.product';
              filter.push({ term: { [productField]: slug } });
            }
          }

          const response = await client.search({
            index,
            body: {
              query: { bool: { filter } },
              size: 0,
              aggs: {
                daily: {
                  date_histogram: {
                    field: dateField,
                    calendar_interval: 'day',
                  },
                },
              },
            },
          });

          const aggs = response.aggregations as any;
          const daily = (aggs?.daily?.buckets || []).map((b: any) => ({
            date: b.key_as_string,
            count: b.doc_count,
          }));

          const total = daily.reduce((sum: number, d: any) => sum + d.count, 0);
          const avgPerDay =
            daily.length > 0 ? Math.round(total / daily.length) : 0;

          return { total, avgPerDay, daily, timeRange };
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // Resolution Time Analysis Tool
    this.tools.set('analyze_resolution_times', {
      name: 'analyze_resolution_times',
      description:
        'Analyze case resolution times. Returns average, min, max resolution times by category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Filter by category (e.g., CDD Remediation)',
          },
          timeRange: {
            type: 'string',
            description: 'Time range for cases created',
          },
        },
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const filter: any[] = [{ exists: { field: 'resolvedAt' } }];
          if (timeRange) {
            filter.push({
              range: { createdAt: { gte: timeRange.from, lte: timeRange.to } },
            });
          }
          if (input.category) {
            filter.push({ term: { 'category.keyword': input.category } });
          }

          const response = await client.search({
            index: AgentTools.ES_INDICES.cases,
            body: {
              query: { bool: { filter } },
              size: 0,
              aggs: {
                resolution_stats: {
                  scripted_metric: {
                    init_script: 'state.times = []',
                    map_script: `
                      if (doc['resolvedAt'].size() > 0 && doc['createdAt'].size() > 0) {
                        def resolved = doc['resolvedAt'].value.toInstant().toEpochMilli();
                        def created = doc['createdAt'].value.toInstant().toEpochMilli();
                        state.times.add((resolved - created) / 86400000.0);
                      }
                    `,
                    combine_script: 'return state.times',
                    reduce_script: `
                      def all = [];
                      for (t in states) { all.addAll(t); }
                      if (all.size() == 0) return ['count': 0];
                      def sum = 0.0; def min = all.get(0); def max = all.get(0);
                      for (v in all) { sum += v; if (v < min) min = v; if (v > max) max = v; }
                      return ['count': all.size(), 'avg': sum / all.size(), 'min': min, 'max': max];
                    `,
                  },
                },
              },
            },
          });

          const stats = (response.aggregations as any)?.resolution_stats?.value;

          if (!stats || stats.count === 0) {
            return { error: 'No resolved cases found in time range' };
          }

          return {
            casesAnalyzed: stats.count,
            avgResolutionDays: Math.round(stats.avg * 10) / 10,
            minResolutionDays: Math.round(stats.min * 10) / 10,
            maxResolutionDays: Math.round(stats.max * 10) / 10,
            timeRange,
          };
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // SLA Compliance Tool
    this.tools.set('analyze_sla_compliance', {
      name: 'analyze_sla_compliance',
      description:
        'Analyze SLA breach rates for cases. Returns counts of breached vs compliant cases.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Filter by category',
          },
          timeRange: {
            type: 'string',
            description: 'Time range',
          },
        },
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const filter: any[] = [];
          if (timeRange) {
            filter.push({
              range: { createdAt: { gte: timeRange.from, lte: timeRange.to } },
            });
          }
          if (input.category) {
            filter.push({ term: { 'category.keyword': input.category } });
          }

          const response = await client.search({
            index: AgentTools.ES_INDICES.cases,
            body: {
              query: { bool: { filter } },
              size: 0,
              aggs: {
                sla_status: { terms: { field: 'slaBreached' } },
                by_category: {
                  terms: { field: 'category.keyword' },
                  aggs: { breach_rate: { terms: { field: 'slaBreached' } } },
                },
              },
            },
          });

          const aggs = response.aggregations as any;
          const slaStatus = aggs?.sla_status?.buckets || [];
          const breached =
            slaStatus.find((b: any) => b.key === 1)?.doc_count || 0;
          const compliant =
            slaStatus.find((b: any) => b.key === 0)?.doc_count || 0;
          const total = breached + compliant;

          return {
            totalCases: total,
            breachedCount: breached,
            compliantCount: compliant,
            breachRate:
              total > 0 ? `${Math.round((breached / total) * 100)}%` : 'N/A',
            byCategory: (aggs?.by_category?.buckets || []).map((b: any) => {
              const brch =
                b.breach_rate?.buckets?.find((x: any) => x.key === 1)
                  ?.doc_count || 0;
              return { category: b.key, total: b.doc_count, breached: brch };
            }),
            timeRange,
          };
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // Category Breakdown Tool
    this.tools.set('get_category_breakdown', {
      name: 'get_category_breakdown',
      description:
        'Get breakdown of cases or communications by category and subcategory. Shows top complaint reasons. Can filter by product.',
      parameters: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            description: 'Type of data: "communications" or "cases"',
          },
          timeRange: {
            type: 'string',
            description: 'Time range',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
        },
      },
      execute: async (input) => {
        try {
          const client = this.getElasticClient();

          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null; // null = no date filter (all time)

          const index =
            input.dataType === 'cases'
              ? AgentTools.ES_INDICES.cases
              : AgentTools.ES_INDICES.communications;
          const dateField =
            input.dataType === 'cases' ? 'createdAt' : 'timestamp';
          const catField =
            input.dataType === 'cases'
              ? 'category.keyword'
              : 'aiClassification.category.keyword';

          const filterClauses: any[] = [];
          if (timeRange) {
            filterClauses.push({
              range: {
                [dateField]: { gte: timeRange.from, lte: timeRange.to },
              },
            });
          }
          if (input.product) {
            const slug = this.normalizeProduct(input.product);
            if (slug) {
              const productField =
                input.dataType === 'cases'
                  ? 'product'
                  : 'aiClassification.product';
              filterClauses.push({ term: { [productField]: slug } });
            }
          }

          const response = await client.search({
            index,
            body: {
              query: {
                bool: {
                  filter: filterClauses,
                },
              },
              size: 0,
              aggs: {
                by_category: {
                  terms: { field: catField, size: 10 },
                  aggs:
                    input.dataType === 'cases'
                      ? {
                          by_subcategory: {
                            terms: { field: 'subcategory.keyword', size: 10 },
                          },
                        }
                      : {},
                },
              },
            },
          });

          const aggs = response.aggregations as any;
          return {
            total: (response.hits as any)?.total?.value || 0,
            byCategory: (aggs?.by_category?.buckets || []).map((b: any) => ({
              category: b.key,
              count: b.doc_count,
              subcategories: (b.by_subcategory?.buckets || []).map(
                (s: any) => ({
                  name: s.key,
                  count: s.doc_count,
                }),
              ),
            })),
            timeRange,
          };
        } catch (error) {
          return { error: `Query failed: ${error.message}` };
        }
      },
    });

    // Issue Detection Tool
    this.tools.set('detect_issues', {
      name: 'detect_issues',
      description:
        'Detect and categorize issues from customer communications. Identifies recurring problems, systemic issues, and urgent complaints. Focuses on negative sentiment and high-priority messages.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Optional customer ID to filter',
          },
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter. Only specify if the user explicitly requests a date range (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card", "Cash ISA"). Accepts product names, slugs, or aliases.',
          },
        },
      },
      execute: async (input) => {
        const timeRange = input.timeRange
          ? this.parseTimeRange(input.timeRange)
          : undefined;
        const product = this.normalizeProduct(input.product);
        const result = await this.analysisService.analyze({
          type: 'issue-detection',
          targetId: input.customerId,
          product,
          timeRange,
        });
        return {
          summary: result.summary,
          issueCount: result.metrics.issueCount,
          problematicCount: result.metrics.problematicCount,
          totalCommunications: result.metrics.totalCommunications,
          insights: result.insights?.slice(0, 5),
          recommendations: result.recommendations,
        };
      },
    });

    // Anomaly Detection Tool
    this.tools.set('detect_anomalies', {
      name: 'detect_anomalies',
      description:
        'Detect statistical anomalies and outliers in communication data. Uses z-score and IQR methods to find unusual spikes or drops in volume, sentiment, or other metrics. Also detects concentration risk (e.g., single category dominating). Use this when asked about anomalies, outliers, spikes, unusual patterns, or abnormal values.',
      parameters: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description:
              'Optional time range filter (e.g., "last 7 days", "this month"). Omit to search all data.',
          },
          product: {
            type: 'string',
            description:
              'Optional product to filter by (e.g., "Advance Account", "credit-card"). Accepts product names, slugs, or aliases.',
          },
          field: {
            type: 'string',
            description:
              'Optional specific field to check for outliers (e.g., "sentiment", "volume"). Omit to analyse all numeric fields.',
          },
          method: {
            type: 'string',
            description:
              'Outlier detection method: "zscore" (default) or "iqr"',
            default: 'zscore',
            enum: ['zscore', 'iqr'],
          },
          threshold: {
            type: 'number',
            description:
              'Sensitivity threshold. For z-score: number of standard deviations (default: 2.0). For IQR: multiplier (default: 1.5). Lower values = more sensitive.',
            default: 2.0,
          },
        },
      },
      execute: async (input) => {
        try {
          const timeRange = input.timeRange
            ? this.parseTimeRange(input.timeRange)
            : null;
          const product = this.normalizeProduct(input.product);

          // Build ES query to fetch raw communications for analysis
          const must: any[] = [];
          if (timeRange) {
            must.push({
              range: {
                timestamp: { gte: timeRange.from, lte: timeRange.to },
              },
            });
          }
          if (product) {
            must.push({ term: { 'product.keyword': product } });
          }

          const client = this.getElasticClient();
          const response = await client.search({
            index: AgentTools.ES_INDICES.communications,
            size: 2000,
            body: {
              query: must.length > 0 ? { bool: { must } } : { match_all: {} },
              _source: [
                'timestamp',
                'sentiment',
                'channel',
                'category',
                'subcategory',
                'product',
                'subject',
              ],
              sort: [{ timestamp: 'asc' }],
            },
          });

          const hits = (response.hits as any).hits || [];
          if (hits.length === 0) {
            return {
              summary: 'No communications found matching the criteria.',
              anomalies: [],
              totalAnalysed: 0,
            };
          }

          // Extract numeric fields for analysis
          const records = hits.map((h: any) => h._source);
          const sentiments = records
            .map((r: any) => r.sentiment)
            .filter((v: any) => typeof v === 'number');

          // Group by day for volume analysis
          const dailyVolumes: Record<string, number> = {};
          for (const r of records) {
            const day = (r.timestamp || '').substring(0, 10);
            if (day) dailyVolumes[day] = (dailyVolumes[day] || 0) + 1;
          }
          const volumeValues = Object.values(dailyVolumes);

          // Category concentration (HHI)
          const categoryCounts: Record<string, number> = {};
          for (const r of records) {
            const cat = r.category || 'unknown';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          }

          const method = input.method || 'zscore';
          const threshold =
            input.threshold || (method === 'zscore' ? 2.0 : 1.5);

          const anomalies: any[] = [];

          // Helper: detect outliers in a numeric array
          const detectOutliers = (
            values: number[],
            fieldName: string,
            labels?: string[],
          ) => {
            if (values.length < 3) return;
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            const stdDev = Math.sqrt(
              values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length,
            );
            if (stdDev === 0) return;

            if (method === 'zscore') {
              values.forEach((v, i) => {
                const z = Math.abs((v - mean) / stdDev);
                if (z > threshold) {
                  anomalies.push({
                    type: 'statistical_outlier',
                    field: fieldName,
                    label: labels ? labels[i] : `index ${i}`,
                    value: v,
                    zScore: +z.toFixed(2),
                    mean: +mean.toFixed(3),
                    stdDev: +stdDev.toFixed(3),
                    severity: z > 3 ? 'high' : 'medium',
                    description: `${fieldName} value ${typeof v === 'number' ? v.toFixed(3) : v} is ${z.toFixed(1)}σ from the mean`,
                  });
                }
              });
            } else {
              // IQR method
              const sorted = [...values].sort((a, b) => a - b);
              const q1 = sorted[Math.floor(sorted.length * 0.25)];
              const q3 = sorted[Math.floor(sorted.length * 0.75)];
              const iqr = q3 - q1;
              const lower = q1 - threshold * iqr;
              const upper = q3 + threshold * iqr;
              values.forEach((v, i) => {
                if (v < lower || v > upper) {
                  anomalies.push({
                    type: 'statistical_outlier',
                    field: fieldName,
                    label: labels ? labels[i] : `index ${i}`,
                    value: v,
                    bounds: {
                      lower: +lower.toFixed(3),
                      upper: +upper.toFixed(3),
                    },
                    severity:
                      v < lower - iqr || v > upper + iqr ? 'high' : 'medium',
                    description: `${fieldName} value ${v.toFixed(3)} outside IQR bounds [${lower.toFixed(3)}, ${upper.toFixed(3)}]`,
                  });
                }
              });
            }
          };

          // Detect sentiment outliers
          if (!input.field || input.field === 'sentiment') {
            detectOutliers(sentiments, 'sentiment');
          }

          // Detect daily volume outliers
          if (!input.field || input.field === 'volume') {
            const days = Object.keys(dailyVolumes).sort();
            detectOutliers(volumeValues, 'daily_volume', days);
          }

          // Detect concentration risk
          if (!input.field || input.field === 'category') {
            const total = records.length;
            const shares = Object.values(categoryCounts).map(
              (c) => (c / total) ** 2,
            );
            const hhi = shares.reduce((s, v) => s + v, 0);
            if (hhi > 0.25) {
              const topCat = Object.entries(categoryCounts).sort(
                (a, b) => b[1] - a[1],
              )[0];
              anomalies.push({
                type: 'concentration_risk',
                field: 'category',
                severity: hhi > 0.5 ? 'high' : 'medium',
                hhi: +hhi.toFixed(3),
                topCategory: topCat[0],
                topCategoryPct: +((topCat[1] / total) * 100).toFixed(1),
                description: `High concentration risk (HHI=${hhi.toFixed(2)}): "${topCat[0]}" accounts for ${((topCat[1] / total) * 100).toFixed(0)}% of all communications`,
              });
            }
          }

          // Sort by severity
          anomalies.sort((a, b) =>
            a.severity === 'high' && b.severity !== 'high' ? -1 : 1,
          );

          const highCount = anomalies.filter(
            (a) => a.severity === 'high',
          ).length;
          const summary =
            anomalies.length === 0
              ? `No statistical anomalies detected across ${records.length} communications (method: ${method}, threshold: ${threshold}).`
              : `Detected ${anomalies.length} anomalies (${highCount} high severity) across ${records.length} communications using ${method} method (threshold: ${threshold}).`;

          return {
            summary,
            method,
            threshold,
            totalAnalysed: records.length,
            anomalyCount: anomalies.length,
            highSeverityCount: highCount,
            anomalies: anomalies.slice(0, 20),
          };
        } catch (error) {
          return { error: `Anomaly detection failed: ${error.message}` };
        }
      },
    });

    // Relationship Summary Tool
    this.tools.set('get_relationship_summary', {
      name: 'get_relationship_summary',
      description:
        'Get a comprehensive relationship summary for a specific customer. Analyzes their full communication history to assess relationship health, sentiment trajectory, key interactions, and active issues.',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'The customer ID to summarize',
          },
        },
        required: ['customerId'],
      },
      execute: async (input) => {
        const result = await this.analysisService.analyze({
          type: 'relationship-summary',
          targetId: input.customerId,
        });
        return {
          summary: result.summary,
          customerName: result.metrics.customerName,
          communicationCount: result.metrics.communicationCount,
          firstContact: result.metrics.firstContact,
          lastContact: result.metrics.lastContact,
        };
      },
    });
  }

  /**
   * Parse time range string into from/to dates.
   * Delegates to the shared DateRangeParser utility.
   * Returns null for "all" / "all time" / unrecognised (no date filter).
   */
  private parseTimeRange(
    timeRange: string,
  ): { from: string; to: string } | null {
    return DateRangeParser.parse(timeRange);
  }

  /**
   * Normalize a product term (name, alias, or slug) to the canonical ES slug.
   * Returns undefined if the term doesn't match any known product.
   */
  private normalizeProduct(product: string | undefined): string | undefined {
    if (!product) return undefined;
    const found = findProductByTerm(product);
    return found ? found.slug : product;
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
            excerpt: item.content?.substring(0, 500),
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
            excerpt: doc.content?.substring(0, 500),
          });
        }
      }
    }

    return sources;
  }
}

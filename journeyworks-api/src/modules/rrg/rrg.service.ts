/**
 * RRG Service
 *
 * Implements Retrieval-Refined Generation for natural language to DSL conversion.
 * Uses LLM to parse natural language queries into structured intents,
 * then builds Elasticsearch DSL queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import {
  formatGlossaryForPrompt,
  mapSentiment,
  mapChannel,
  mapPriority,
} from '../../infrastructure/llm/prompts/rrg/glossary';
import { RedisCacheService } from '../../infrastructure/redis';
import { CommunicationsRepository } from '../communications/communications.repository';
import { QueryBuilder } from './query-builder.service';
import {
  NlQueryRequest,
  ParsedIntent,
  GeneratedDsl,
  QueryExecutionResult,
  ExtractedEntities,
  TimeRange,
  QueryFilter,
  RequestedAggregation,
} from './rrg.types';

/**
 * RRG Configuration Constants
 */
const RRG_CONFIG = {
  /** Cache TTL for parsed intents in seconds */
  CACHE_TTL_SECONDS: 300,
  /** Default number of results to return */
  DEFAULT_RESULT_SIZE: 20,
  /** Default confidence score when LLM doesn't provide one */
  DEFAULT_CONFIDENCE: 0.7,
  /** Low confidence threshold indicating parse failure */
  LOW_CONFIDENCE_THRESHOLD: 0.3,
  /** Number of sample documents for summary generation */
  SUMMARY_SAMPLE_SIZE: 3,
  /** Maximum previous queries to include in context */
  MAX_PREVIOUS_QUERIES: 3,
  /** Default timezone for relative time parsing */
  DEFAULT_TIMEZONE: 'UTC',
} as const;

/**
 * Valid index names for RRG queries
 */
const VALID_INDICES = new Set(['communications', 'cases', 'social-mentions']);

/**
 * Allowed DSL query patterns to prevent injection
 */
const ALLOWED_DSL_PATTERNS = {
  queryTypes: new Set([
    'bool',
    'match',
    'match_all',
    'term',
    'terms',
    'range',
    'exists',
    'multi_match',
    'nested',
  ]),
  aggregationTypes: new Set([
    'terms',
    'date_histogram',
    'avg',
    'sum',
    'min',
    'max',
    'value_count',
    'percentiles',
    'cardinality',
  ]),
  topLevelKeys: new Set([
    'query',
    'aggs',
    'aggregations',
    'sort',
    'size',
    'from',
    '_source',
    'track_total_hits',
  ]),
} as const;

/**
 * Error types for RRG operations
 */
export class RrgValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RrgValidationError';
  }
}

export class DslValidationError extends RrgValidationError {
  constructor(
    message: string,
    public readonly invalidPatterns: string[],
  ) {
    super(message, 'DSL_VALIDATION_ERROR', { invalidPatterns });
    this.name = 'DslValidationError';
  }
}

@Injectable()
export class RrgService {
  private readonly logger = new Logger(RrgService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly cache: RedisCacheService,
    private readonly queryBuilder: QueryBuilder,
    private readonly communicationsRepo: CommunicationsRepository,
  ) {}

  /**
   * Convert natural language query to DSL and optionally execute
   */
  async query(
    request: NlQueryRequest,
  ): Promise<QueryExecutionResult | GeneratedDsl> {
    const startTime = Date.now();

    this.logger.log(`Processing NL query: "${request.query}"`);

    // Validate index name
    const index = request.index || 'communications';
    if (!VALID_INDICES.has(index)) {
      throw new RrgValidationError(
        'Invalid index specified',
        'INVALID_INDEX',
        // Don't reveal valid index names in error
      );
    }

    // 1. Parse the natural language query into structured intent
    const intent = await this.parseQuery(request);

    // 2. Build DSL from intent
    const dsl = this.queryBuilder.build(intent, index);

    // 3. Validate DSL for safety
    this.validateDsl(dsl.query);

    // 4. Optionally validate against schema
    if (request.validate !== false) {
      const validation = this.queryBuilder.validateQuery(dsl.query, index);
      if (!validation.valid) {
        this.logger.warn(
          `Query validation warnings: ${validation.errors.join(', ')}`,
        );
      }
    }

    // 5. If execute is requested, run the query
    if (request.execute) {
      const results = await this.executeQuery(dsl, index);
      const executionTime = Date.now() - startTime;

      // Generate natural language summary of results
      const summary = await this.summarizeResults(request.query, results, dsl);

      return {
        dsl,
        results,
        executionTime,
        summary,
      };
    }

    return dsl;
  }

  /**
   * Generate a secure cache key for parsed intents
   */
  private generateCacheKey(request: NlQueryRequest): string {
    const keyData = JSON.stringify({
      query: request.query,
      context: request.context || '',
      index: request.index || 'communications',
      timezone: request.timezone || RRG_CONFIG.DEFAULT_TIMEZONE,
    });
    const hash = crypto
      .createHash('sha256')
      .update(keyData)
      .digest('hex')
      .substring(0, 16);
    return `rrg:parse:${hash}`;
  }

  /**
   * Validate DSL query for security - prevent injection attacks
   */
  private validateDsl(query: Record<string, any>): void {
    const invalidPatterns: string[] = [];

    const validateObject = (obj: any, path: string = ''): void => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        // Check top-level keys
        if (!path && !ALLOWED_DSL_PATTERNS.topLevelKeys.has(key)) {
          invalidPatterns.push(`Invalid top-level key: ${key}`);
        }

        // Check for script queries (security risk)
        if (key === 'script' || key === '_script') {
          invalidPatterns.push(`Script queries not allowed: ${fullPath}`);
        }

        // Check for update/delete operations
        if (key === 'update' || key === 'delete' || key === '_update') {
          invalidPatterns.push(`Mutation operations not allowed: ${fullPath}`);
        }

        // Validate query types in nested bool queries
        if (
          path.includes('query') &&
          typeof value === 'object' &&
          value !== null
        ) {
          for (const queryType of Object.keys(value)) {
            if (
              !ALLOWED_DSL_PATTERNS.queryTypes.has(queryType) &&
              ![
                'must',
                'must_not',
                'should',
                'filter',
                'minimum_should_match',
              ].includes(queryType)
            ) {
              // Only warn for truly unknown query types
              if (!queryType.startsWith('_') && queryType !== 'boost') {
                this.logger.debug(
                  `Unknown query type: ${queryType} at ${fullPath}`,
                );
              }
            }
          }
        }

        // Recursively validate nested objects
        if (typeof value === 'object') {
          validateObject(value, fullPath);
        }
      }
    };

    validateObject(query);

    if (invalidPatterns.length > 0) {
      throw new DslValidationError(
        'DSL query contains disallowed patterns',
        invalidPatterns,
      );
    }
  }

  /**
   * Parse natural language query using LLM
   */
  private async parseQuery(request: NlQueryRequest): Promise<ParsedIntent> {
    // Check cache first with secure key
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.cache.get<ParsedIntent>(cacheKey);
    if (cached) {
      this.logger.debug('Using cached parsed intent');
      return cached;
    }

    // Get schema information for context
    const schema = this.queryBuilder.getSchema(
      request.index || 'communications',
    );
    const schemaContext = schema
      ? `Available fields: ${schema.fields.map((f) => `${f.name} (${f.type}${f.values ? `: ${f.values.join(', ')}` : ''})`).join(', ')}`
      : '';

    // Get domain glossary for better term mapping
    const glossary = formatGlossaryForPrompt();

    const prompt = this.promptTemplate.renderNamed('rrg:nl_to_dsl', {
      query: request.query,
      context: request.context || '',
      schema: schemaContext,
      glossary,
      previousQueries: request.previousQueries
        ? JSON.stringify(
            request.previousQueries.slice(-RRG_CONFIG.MAX_PREVIOUS_QUERIES),
            null,
            2,
          )
        : 'None',
    });

    const response = await this.llmClient.prompt(
      prompt,
      this.promptTemplate.getTemplate('system:rrg'),
      { rateLimitKey: 'llm:rrg' },
    );

    // Parse LLM response
    const intent = this.parseLlmResponse(response, request.timezone);

    // Cache the result
    await this.cache.set(cacheKey, intent, RRG_CONFIG.CACHE_TTL_SECONDS);

    return intent;
  }

  /**
   * Parse LLM response into ParsedIntent
   */
  private parseLlmResponse(response: string, timezone?: string): ParsedIntent {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeIntent(parsed, timezone);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse LLM response as JSON: ${error.message}`,
      );
    }

    // Fallback: create a basic search intent with parse failure indicator
    this.logger.warn('Query parsing failed, returning fallback intent');
    return {
      intent: 'search',
      entities: {},
      filters: [],
      aggregations: [],
      confidence: RRG_CONFIG.LOW_CONFIDENCE_THRESHOLD,
      parseFailed: true,
      parseFailureReason:
        'Could not parse the query. Try rephrasing or being more specific.',
    };
  }

  /**
   * Normalize and validate parsed intent using glossary mappings
   */
  private normalizeIntent(raw: any, timezone?: string): ParsedIntent {
    const intent: ParsedIntent = {
      intent: this.normalizeIntentType(raw.intent),
      entities: this.normalizeEntities(raw.entities || {}),
      filters: this.normalizeFilters(raw.filters || []),
      aggregations: this.normalizeAggregations(raw.aggregations || []),
      confidence: Math.min(
        1,
        Math.max(0, raw.confidence || RRG_CONFIG.DEFAULT_CONFIDENCE),
      ),
    };

    if (raw.timeRange) {
      intent.timeRange = this.normalizeTimeRange(raw.timeRange, timezone);
    }

    if (raw.sort) {
      intent.sort = {
        field: raw.sort.field || 'timestamp',
        order: raw.sort.order === 'asc' ? 'asc' : 'desc',
      };
    }

    return intent;
  }

  /**
   * Normalize intent type
   */
  private normalizeIntentType(raw: string): ParsedIntent['intent'] {
    const normalized = (raw || 'search').toLowerCase();
    if (
      ['search', 'aggregate', 'analyze', 'compare', 'trend'].includes(
        normalized,
      )
    ) {
      return normalized as ParsedIntent['intent'];
    }
    return 'search';
  }

  /**
   * Normalize entities using glossary mappings for validation
   */
  private normalizeEntities(raw: any): ExtractedEntities {
    // Normalize channels using glossary
    const rawChannels = this.toStringArray(raw.channels);
    const channels = rawChannels
      ?.map((c) => {
        const mapped = mapChannel(c);
        return mapped || c.toLowerCase();
      })
      .filter((c, i, arr) => arr.indexOf(c) === i); // dedupe

    // Normalize sentiments using glossary
    const rawSentiments = this.toStringArray(raw.sentiments);
    const sentiments = rawSentiments
      ?.map((s) => {
        const mapped = mapSentiment(s);
        return mapped || s.toLowerCase();
      })
      .filter((s, i, arr) => arr.indexOf(s) === i); // dedupe

    // Normalize priorities using glossary
    const rawPriorities = this.toStringArray(raw.priorities);
    const priorities = rawPriorities
      ?.map((p) => {
        const mapped = mapPriority(p);
        return mapped || p.toLowerCase();
      })
      .filter((p, i, arr) => arr.indexOf(p) === i); // dedupe

    return {
      customers: this.toStringArray(raw.customers),
      channels,
      sentiments,
      topics: this.toStringArray(raw.topics),
      categories: this.toStringArray(raw.categories),
      priorities,
      regions: this.toStringArray(raw.regions),
      products: this.toStringArray(raw.products),
      statuses: this.toStringArray(raw.statuses)?.map((s) => s.toLowerCase()),
    };
  }

  /**
   * Normalize filters
   */
  private normalizeFilters(raw: any[]): QueryFilter[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((f) => f && f.field)
      .map((f) => ({
        field: f.field,
        operator: this.normalizeOperator(f.operator),
        value: f.value,
      }));
  }

  /**
   * Normalize operator
   */
  private normalizeOperator(op: string): QueryFilter['operator'] {
    const normalized = (op || 'eq').toLowerCase();
    if (
      [
        'eq',
        'ne',
        'gt',
        'gte',
        'lt',
        'lte',
        'in',
        'contains',
        'exists',
      ].includes(normalized)
    ) {
      return normalized as QueryFilter['operator'];
    }
    return 'eq';
  }

  /**
   * Normalize aggregations
   */
  private normalizeAggregations(raw: any[]): RequestedAggregation[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((a) => a && a.type)
      .map((a) => ({
        type: this.normalizeAggType(a.type),
        field: a.field,
        name: a.name || `${a.type}_${a.field || 'count'}`,
        options: a.options,
      }));
  }

  /**
   * Normalize aggregation type
   */
  private normalizeAggType(type: string): RequestedAggregation['type'] {
    const normalized = (type || 'count').toLowerCase();
    if (
      [
        'count',
        'avg',
        'sum',
        'min',
        'max',
        'terms',
        'date_histogram',
        'percentiles',
      ].includes(normalized)
    ) {
      return normalized as RequestedAggregation['type'];
    }
    return 'count';
  }

  /**
   * Normalize time range with timezone support
   * @param raw - Raw time range from LLM
   * @param timezone - User's timezone (e.g., 'America/New_York')
   */
  private normalizeTimeRange(raw: any, timezone?: string): TimeRange {
    const range: TimeRange = {};

    if (raw.from) {
      range.from = this.parseDate(raw.from, timezone);
    }
    if (raw.to) {
      range.to = this.parseDate(raw.to, timezone);
    }
    if (raw.relative) {
      range.relative = raw.relative;
      // Convert relative to absolute
      const parsed = this.parseRelativeTime(raw.relative, timezone);
      if (parsed) {
        range.from = parsed.from;
        range.to = parsed.to;
      }
    }

    return range;
  }

  /**
   * Parse a date string with optional timezone context
   * @param value - Date string to parse
   * @param timezone - User's timezone for context (currently logs for future use)
   */
  private parseDate(value: string, timezone?: string): string {
    if (!value) return '';

    // If already ISO format, return as-is
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value;
    }

    // Try to parse
    // Note: For full timezone support, consider using date-fns-tz or luxon
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // If timezone is provided, log for future enhancement
      if (timezone) {
        this.logger.debug(
          `Parsing date '${value}' in timezone context: ${timezone}`,
        );
      }
      return date.toISOString();
    }

    return value;
  }

  /**
   * Parse relative time expressions with timezone awareness
   * @param relative - Relative time expression (e.g., "last 7 days")
   * @param timezone - User's timezone for accurate "today" calculations
   */
  private parseRelativeTime(
    relative: string,
    timezone?: string,
  ): { from: string; to: string } | null {
    // Use timezone-aware "now" if timezone is provided
    // For full support, consider using date-fns-tz: zonedTimeToUtc, utcToZonedTime
    const now = new Date();

    // Log timezone for future enhancement when timezone-aware date library is added
    if (timezone) {
      this.logger.debug(
        `Parsing relative time '${relative}' with timezone: ${timezone}`,
      );
    }

    const lowerRelative = relative.toLowerCase();

    const match = lowerRelative.match(/last\s+(\d+)\s+(day|week|month|year)s?/);
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

    // Handle specific relative terms
    if (lowerRelative.includes('today')) {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString(),
        to: now.toISOString(),
      };
    }

    if (lowerRelative.includes('yesterday')) {
      const from = new Date(now);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 999);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      };
    }

    if (lowerRelative.includes('this week')) {
      const from = new Date(now);
      from.setDate(from.getDate() - from.getDay());
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString(),
        to: now.toISOString(),
      };
    }

    if (lowerRelative.includes('this month')) {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: from.toISOString(),
        to: now.toISOString(),
      };
    }

    return null;
  }

  /**
   * Helper to convert to string array
   */
  private toStringArray(value: any): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }
    return [String(value)].filter(Boolean);
  }

  /**
   * Execute a DSL query
   */
  private async executeQuery(
    dsl: GeneratedDsl,
    index: string,
  ): Promise<{
    total: number;
    documents: any[];
    aggregations?: Record<string, any>;
  }> {
    // For now, only support communications index
    if (index !== 'communications') {
      throw new Error(`Index ${index} not yet supported for query execution`);
    }

    // Use the search method from repository
    const results = await this.communicationsRepo.searchIndex(
      dsl.query || { match_all: {} },
    );

    return {
      total: results.total,
      documents: results.hits.map((h) => h.source),
      aggregations: results.aggregations,
    };
  }

  /**
   * Generate natural language summary of results
   */
  private async summarizeResults(
    query: string,
    results: {
      total: number;
      documents: any[];
      aggregations?: Record<string, any>;
    },
    dsl: GeneratedDsl,
  ): Promise<string> {
    if (results.total === 0) {
      return 'No results found matching your query.';
    }

    const resultsSummary = {
      total: results.total,
      sampleDocuments: results.documents.slice(0, 3).map((d) => ({
        channel: d.channel,
        customer: d.customerName,
        sentiment: d.sentiment?.label,
        summary: d.summary || d.content?.substring(0, 100),
      })),
      aggregations: results.aggregations,
    };

    const prompt = `Summarize the following query results in 2-3 sentences.

Original question: ${query}

Query interpretation: ${dsl.explanation}

Results:
- Total matches: ${results.total}
- Sample data: ${JSON.stringify(resultsSummary.sampleDocuments, null, 2)}
${results.aggregations ? `- Aggregations: ${JSON.stringify(results.aggregations, null, 2)}` : ''}

Provide a concise, natural language summary of what was found.`;

    try {
      return await this.llmClient.prompt(prompt, undefined, {
        rateLimitKey: 'llm:rrg',
      });
    } catch (error) {
      // Fallback to simple summary
      return `Found ${results.total} communications matching your query.`;
    }
  }

  /**
   * Refine a query based on feedback
   */
  async refineQuery(
    originalRequest: NlQueryRequest,
    feedback: string,
    previousDsl: GeneratedDsl,
  ): Promise<GeneratedDsl> {
    const prompt = this.promptTemplate.renderNamed('rrg:dsl_refinement', {
      originalQuery: originalRequest.query,
      previousDsl: JSON.stringify(previousDsl.query, null, 2),
      previousExplanation: previousDsl.explanation,
      feedback,
    });

    const response = await this.llmClient.prompt(
      prompt,
      this.promptTemplate.getTemplate('system:rrg'),
      { rateLimitKey: 'llm:rrg' },
    );

    const intent = this.parseLlmResponse(response);
    const index = originalRequest.index || 'communications';

    return this.queryBuilder.build(intent, index);
  }

  /**
   * Get example queries for a given index
   */
  getExampleQueries(index: string = 'communications'): string[] {
    const examples: Record<string, string[]> = {
      communications: [
        'Show me all negative sentiment emails from last week',
        'Find communications from Goldman Sachs about compliance issues',
        'What are the trending topics in customer complaints this month?',
        'Compare sentiment across email and phone channels',
        'Show urgent priority cases that are unresolved',
        'Find all interactions with VIP customers in the past 30 days',
        'Which customers have the most negative sentiment?',
        'Show me a breakdown of communications by channel and sentiment',
      ],
      cases: [
        'Show all open high priority cases',
        'Find cases assigned to support team that are past SLA',
        'What categories have the most open cases?',
        'Show resolved cases from this week',
      ],
      'social-mentions': [
        'Find negative mentions on Twitter',
        'Show social sentiment trends this month',
        'Which platform has the most engagement?',
      ],
    };

    return examples[index] || examples.communications;
  }
}

/**
 * Query Builder Service
 *
 * Builds Elasticsearch DSL queries from parsed intents.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedIntent,
  GeneratedDsl,
  QueryFilter,
  RequestedAggregation,
  IndexSchema,
  SchemaField,
} from './rrg.types';

@Injectable()
export class QueryBuilder {
  private readonly logger = new Logger(QueryBuilder.name);

  /**
   * Known schemas for different indices
   */
  private readonly schemas: Record<string, IndexSchema> = {
    communications: {
      name: 'communications',
      fields: [
        { name: 'id', type: 'keyword', searchable: false, aggregatable: true },
        {
          name: 'content',
          type: 'text',
          searchable: true,
          aggregatable: false,
        },
        {
          name: 'subject',
          type: 'text',
          searchable: true,
          aggregatable: false,
        },
        {
          name: 'summary',
          type: 'text',
          searchable: true,
          aggregatable: false,
        },
        {
          name: 'channel',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['email', 'phone', 'chat', 'meeting'],
        },
        {
          name: 'direction',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['inbound', 'outbound'],
        },
        {
          name: 'customerId',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'customerName',
          type: 'keyword',
          searchable: true,
          aggregatable: true,
        },
        {
          name: 'assignedTo',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'timestamp',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'sentiment.label',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['positive', 'negative', 'neutral', 'mixed'],
        },
        {
          name: 'sentiment.score',
          type: 'double',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'priority',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['low', 'medium', 'high', 'urgent'],
        },
        {
          name: 'status',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['new', 'read', 'replied', 'resolved', 'archived'],
        },
        {
          name: 'tags',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'topics',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
      ],
    },
    cases: {
      name: 'cases',
      fields: [
        { name: 'id', type: 'keyword', searchable: false, aggregatable: true },
        { name: 'title', type: 'text', searchable: true, aggregatable: false },
        {
          name: 'description',
          type: 'text',
          searchable: true,
          aggregatable: false,
        },
        {
          name: 'category',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'priority',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['low', 'medium', 'high', 'critical'],
        },
        {
          name: 'status',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
        },
        {
          name: 'customerId',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'assignedTo',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'createdAt',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'updatedAt',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'resolvedAt',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'slaDeadline',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
      ],
    },
    'social-mentions': {
      name: 'social-mentions',
      fields: [
        { name: 'id', type: 'keyword', searchable: false, aggregatable: true },
        {
          name: 'content',
          type: 'text',
          searchable: true,
          aggregatable: false,
        },
        {
          name: 'platform',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
          values: ['twitter', 'linkedin', 'reddit', 'trustpilot'],
        },
        {
          name: 'sentiment',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'author',
          type: 'keyword',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'timestamp',
          type: 'date',
          searchable: false,
          aggregatable: true,
        },
        {
          name: 'engagement',
          type: 'long',
          searchable: false,
          aggregatable: true,
        },
        { name: 'reach', type: 'long', searchable: false, aggregatable: true },
      ],
    },
  };

  /**
   * Build an Elasticsearch DSL query from a parsed intent
   */
  build(intent: ParsedIntent, index: string = 'communications'): GeneratedDsl {
    const schema = this.schemas[index];
    if (!schema) {
      throw new Error(`Unknown index: ${index}`);
    }

    const query: Record<string, any> = {
      size: intent.intent === 'aggregate' ? 0 : 20,
    };

    // Build the bool query
    const boolQuery = this.buildBoolQuery(intent, schema);
    if (Object.keys(boolQuery).length > 0) {
      query.query = { bool: boolQuery };
    }

    // Add aggregations if requested
    if (intent.aggregations.length > 0) {
      query.aggs = this.buildAggregations(intent.aggregations, schema);
    }

    // Add sorting
    if (intent.sort) {
      query.sort = [{ [intent.sort.field]: { order: intent.sort.order } }];
    } else if (intent.intent !== 'aggregate') {
      // Default sort by timestamp desc
      query.sort = [{ timestamp: { order: 'desc' } }];
    }

    // Add source filtering
    query._source = {
      excludes: ['embedding', 'sparseEmbedding'],
    };

    const explanation = this.generateExplanation(intent, query);

    return {
      query,
      intent,
      validated: true,
      explanation,
      suggestions: this.generateSuggestions(intent),
    };
  }

  /**
   * Build a bool query from filters
   */
  private buildBoolQuery(
    intent: ParsedIntent,
    schema: IndexSchema,
  ): Record<string, any> {
    const must: any[] = [];
    const mustNot: any[] = [];
    const filter: any[] = [];
    const should: any[] = [];

    // Process time range
    if (intent.timeRange) {
      const dateField =
        schema.fields.find(
          (f) => f.type === 'date' && f.name.includes('timestamp'),
        )?.name || 'timestamp';

      const range: Record<string, any> = {};
      if (intent.timeRange.from) {
        range.gte = intent.timeRange.from;
      }
      if (intent.timeRange.to) {
        range.lte = intent.timeRange.to;
      }
      if (Object.keys(range).length > 0) {
        filter.push({ range: { [dateField]: range } });
      }
    }

    // Process entities
    const { entities } = intent;

    if (entities.customers?.length) {
      filter.push({
        bool: {
          should: entities.customers.map((c) => ({
            multi_match: {
              query: c,
              fields: ['customerName^2', 'customerId'],
            },
          })),
          minimum_should_match: 1,
        },
      });
    }

    if (entities.channels?.length) {
      filter.push({ terms: { channel: entities.channels } });
    }

    if (entities.sentiments?.length) {
      filter.push({ terms: { 'sentiment.label': entities.sentiments } });
    }

    if (entities.topics?.length) {
      should.push(
        ...entities.topics.map((t) => ({
          multi_match: {
            query: t,
            fields: ['content', 'subject', 'summary', 'topics'],
            type: 'best_fields',
          },
        })),
      );
    }

    if (entities.categories?.length) {
      filter.push({ terms: { category: entities.categories } });
    }

    if (entities.priorities?.length) {
      filter.push({ terms: { priority: entities.priorities } });
    }

    if (entities.statuses?.length) {
      filter.push({ terms: { status: entities.statuses } });
    }

    // Process explicit filters
    for (const f of intent.filters) {
      const clause = this.filterToClause(f);
      if (f.operator === 'ne') {
        mustNot.push(clause);
      } else {
        filter.push(clause);
      }
    }

    const boolQuery: Record<string, any> = {};
    if (must.length > 0) boolQuery.must = must;
    if (mustNot.length > 0) boolQuery.must_not = mustNot;
    if (filter.length > 0) boolQuery.filter = filter;
    if (should.length > 0) {
      boolQuery.should = should;
      boolQuery.minimum_should_match = 1;
    }

    return boolQuery;
  }

  /**
   * Convert a filter to an Elasticsearch clause
   */
  private filterToClause(filter: QueryFilter): Record<string, any> {
    switch (filter.operator) {
      case 'eq':
        return { term: { [filter.field]: filter.value } };
      case 'ne':
        return { term: { [filter.field]: filter.value } };
      case 'gt':
        return { range: { [filter.field]: { gt: filter.value } } };
      case 'gte':
        return { range: { [filter.field]: { gte: filter.value } } };
      case 'lt':
        return { range: { [filter.field]: { lt: filter.value } } };
      case 'lte':
        return { range: { [filter.field]: { lte: filter.value } } };
      case 'in':
        return { terms: { [filter.field]: filter.value } };
      case 'contains':
        return { match: { [filter.field]: filter.value } };
      case 'exists':
        return { exists: { field: filter.field } };
      default:
        return { term: { [filter.field]: filter.value } };
    }
  }

  /**
   * Build aggregations from requested aggregations
   */
  private buildAggregations(
    aggregations: RequestedAggregation[],
    schema: IndexSchema,
  ): Record<string, any> {
    const aggs: Record<string, any> = {};

    for (const agg of aggregations) {
      switch (agg.type) {
        case 'count':
          aggs[agg.name] = { value_count: { field: agg.field || '_id' } };
          break;
        case 'avg':
          aggs[agg.name] = { avg: { field: agg.field } };
          break;
        case 'sum':
          aggs[agg.name] = { sum: { field: agg.field } };
          break;
        case 'min':
          aggs[agg.name] = { min: { field: agg.field } };
          break;
        case 'max':
          aggs[agg.name] = { max: { field: agg.field } };
          break;
        case 'terms':
          aggs[agg.name] = {
            terms: {
              field: agg.field,
              size: agg.options?.size || 10,
            },
          };
          break;
        case 'date_histogram':
          aggs[agg.name] = {
            date_histogram: {
              field: agg.field || 'timestamp',
              calendar_interval: agg.options?.interval || 'day',
            },
          };
          break;
        case 'percentiles':
          aggs[agg.name] = {
            percentiles: {
              field: agg.field,
              percents: agg.options?.percents || [25, 50, 75, 95, 99],
            },
          };
          break;
      }
    }

    return aggs;
  }

  /**
   * Generate a human-readable explanation of the query
   */
  private generateExplanation(
    intent: ParsedIntent,
    query: Record<string, any>,
  ): string {
    const parts: string[] = [];

    // Intent description
    switch (intent.intent) {
      case 'search':
        parts.push('Searching for documents');
        break;
      case 'aggregate':
        parts.push('Aggregating data');
        break;
      case 'analyze':
        parts.push('Analyzing patterns');
        break;
      case 'compare':
        parts.push('Comparing data');
        break;
      case 'trend':
        parts.push('Finding trends');
        break;
    }

    // Entities
    const { entities } = intent;
    if (entities.customers?.length) {
      parts.push(`for customer(s): ${entities.customers.join(', ')}`);
    }
    if (entities.channels?.length) {
      parts.push(`via ${entities.channels.join('/')}`);
    }
    if (entities.sentiments?.length) {
      parts.push(`with ${entities.sentiments.join('/')} sentiment`);
    }
    if (entities.topics?.length) {
      parts.push(`about: ${entities.topics.join(', ')}`);
    }

    // Time range
    if (intent.timeRange) {
      if (intent.timeRange.relative) {
        parts.push(intent.timeRange.relative);
      } else {
        const from = intent.timeRange.from || 'beginning';
        const to = intent.timeRange.to || 'now';
        parts.push(`from ${from} to ${to}`);
      }
    }

    // Aggregations
    if (intent.aggregations.length > 0) {
      const aggDescs = intent.aggregations.map(
        (a) => `${a.type} by ${a.field || 'count'}`,
      );
      parts.push(`(${aggDescs.join(', ')})`);
    }

    return parts.join(' ');
  }

  /**
   * Generate suggestions for query refinement
   */
  private generateSuggestions(intent: ParsedIntent): string[] {
    const suggestions: string[] = [];

    if (!intent.timeRange) {
      suggestions.push(
        'Try adding a time range like "last 7 days" or "this month"',
      );
    }

    if (intent.aggregations.length === 0 && intent.intent !== 'search') {
      suggestions.push('You could group by channel, sentiment, or customer');
    }

    if (!intent.entities.sentiments?.length) {
      suggestions.push('Filter by sentiment: positive, negative, or neutral');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get schema for an index
   */
  getSchema(index: string): IndexSchema | undefined {
    return this.schemas[index];
  }

  /**
   * Validate a DSL query against a schema
   */
  validateQuery(
    query: Record<string, any>,
    index: string,
  ): { valid: boolean; errors: string[] } {
    const schema = this.schemas[index];
    if (!schema) {
      return { valid: false, errors: [`Unknown index: ${index}`] };
    }

    const errors: string[] = [];
    const fieldNames = new Set(schema.fields.map((f) => f.name));

    // Validate referenced fields exist
    const validateFields = (obj: any, path: string = ''): void => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        const value = obj[key];

        // Check if key looks like a field reference
        if (['term', 'terms', 'match', 'range', 'exists'].includes(path)) {
          if (!fieldNames.has(key) && !key.includes('.')) {
            errors.push(`Unknown field: ${key}`);
          }
        }

        if (typeof value === 'object') {
          validateFields(value, key);
        }
      }
    };

    validateFields(query);

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

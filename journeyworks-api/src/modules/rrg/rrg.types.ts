/**
 * RRG Types
 *
 * Type definitions for Retrieval-Refined Generation.
 */

/**
 * Natural language query request
 */
export interface NlQueryRequest {
  /** Natural language query */
  query: string;
  /** Context about what the user is looking for */
  context?: string;
  /** Previous queries in the conversation */
  previousQueries?: Array<{
    nl: string;
    dsl: any;
  }>;
  /** Index to query */
  index?: string;
  /** Whether to validate the generated query */
  validate?: boolean;
  /** Whether to execute the query */
  execute?: boolean;
}

/**
 * Parsed intent from natural language
 */
export interface ParsedIntent {
  /** Primary intent category */
  intent: 'search' | 'aggregate' | 'analyze' | 'compare' | 'trend';
  /** Entities extracted from the query */
  entities: ExtractedEntities;
  /** Time range if mentioned */
  timeRange?: TimeRange;
  /** Filters to apply */
  filters: QueryFilter[];
  /** Aggregations requested */
  aggregations: RequestedAggregation[];
  /** Sort preferences */
  sort?: SortPreference;
  /** Confidence score */
  confidence: number;
}

/**
 * Extracted entities from query
 */
export interface ExtractedEntities {
  /** Customer names or IDs */
  customers?: string[];
  /** Communication channels */
  channels?: string[];
  /** Sentiment values */
  sentiments?: string[];
  /** Topics or keywords */
  topics?: string[];
  /** Case categories */
  categories?: string[];
  /** Priority levels */
  priorities?: string[];
  /** Geographic regions */
  regions?: string[];
  /** Products mentioned */
  products?: string[];
  /** Status values */
  statuses?: string[];
}

/**
 * Time range specification
 */
export interface TimeRange {
  /** Start date (ISO string) */
  from?: string;
  /** End date (ISO string) */
  to?: string;
  /** Relative time (e.g., "last 7 days") */
  relative?: string;
}

/**
 * Query filter
 */
export interface QueryFilter {
  /** Field to filter on */
  field: string;
  /** Operator */
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'contains'
    | 'exists';
  /** Value to filter by */
  value: any;
}

/**
 * Requested aggregation
 */
export interface RequestedAggregation {
  /** Type of aggregation */
  type:
    | 'count'
    | 'avg'
    | 'sum'
    | 'min'
    | 'max'
    | 'terms'
    | 'date_histogram'
    | 'percentiles';
  /** Field to aggregate */
  field?: string;
  /** Aggregation name */
  name: string;
  /** Additional options */
  options?: Record<string, any>;
}

/**
 * Sort preference
 */
export interface SortPreference {
  /** Field to sort by */
  field: string;
  /** Sort order */
  order: 'asc' | 'desc';
}

/**
 * Generated DSL query
 */
export interface GeneratedDsl {
  /** The Elasticsearch DSL query */
  query: Record<string, any>;
  /** Original parsed intent */
  intent: ParsedIntent;
  /** Whether the query was validated */
  validated: boolean;
  /** Explanation of the query */
  explanation: string;
  /** Suggested refinements */
  suggestions?: string[];
}

/**
 * Query execution result
 */
export interface QueryExecutionResult {
  /** The DSL query that was executed */
  dsl: GeneratedDsl;
  /** Query results */
  results: {
    /** Total hits */
    total: number;
    /** Returned documents */
    documents: any[];
    /** Aggregation results */
    aggregations?: Record<string, any>;
  };
  /** Execution time in ms */
  executionTime: number;
  /** Natural language summary of results */
  summary?: string;
}

/**
 * Schema information for query building
 */
export interface IndexSchema {
  /** Index name */
  name: string;
  /** Field mappings */
  fields: SchemaField[];
}

/**
 * Field in the schema
 */
export interface SchemaField {
  /** Field name */
  name: string;
  /** Field type */
  type:
    | 'text'
    | 'keyword'
    | 'date'
    | 'long'
    | 'double'
    | 'boolean'
    | 'nested'
    | 'dense_vector';
  /** Whether the field is searchable */
  searchable: boolean;
  /** Whether the field is aggregatable */
  aggregatable: boolean;
  /** Possible values (for keyword fields) */
  values?: string[];
}

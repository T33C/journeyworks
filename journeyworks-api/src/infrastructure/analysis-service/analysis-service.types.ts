/**
 * Analysis Service Types
 */

// Data Card Types
export interface DataCardRequest {
  data: Record<string, unknown>[];
  title?: string;
  description?: string;
  generateInsights?: boolean;
}

export interface StatisticalSummary {
  mean?: number;
  median?: number;
  mode?: number | string;
  stdDev?: number;
  min?: number;
  max?: number;
  count: number;
  missing: number;
  unique: number;
  percentiles?: Record<string, number>;
}

export interface ColumnAnalysis {
  name: string;
  inferredType:
    | 'numeric'
    | 'categorical'
    | 'temporal'
    | 'text'
    | 'boolean'
    | 'unknown';
  statistics: StatisticalSummary;
  distribution?: {
    type: string;
    parameters: Record<string, number>;
  };
  topValues?: Array<{
    value: string | number;
    count: number;
    percentage: number;
  }>;
  temporalPattern?: {
    granularity: string;
    trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';
    seasonality?: string;
  };
}

export interface DataQuality {
  completeness: number;
  consistency: number;
  accuracy: number;
  issues: Array<{
    column: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    affectedRows: number;
  }>;
}

export interface DataCard {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnAnalysis[];
  dataQuality: DataQuality;
  insights: string[];
  correlations?: Array<{
    column1: string;
    column2: string;
    correlation: number;
    type: 'pearson' | 'spearman' | 'cramers_v';
  }>;
}

// Schema Inference Types
export interface SchemaInferenceRequest {
  data: Record<string, unknown>[];
  sampleSize?: number;
}

export interface FieldSchema {
  name: string;
  type: string;
  nullable: boolean;
  format?: string;
  enum?: string[];
  pattern?: string;
}

export interface SchemaInferenceResponse {
  fields: FieldSchema[];
  confidence: number;
  recommendations: string[];
}

// Categorical Analysis Types
export interface CategoricalAnalysisRequest {
  data: Record<string, unknown>[];
  columns: string[];
}

export interface CategoryDistribution {
  column: string;
  categories: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
  entropy: number;
  cardinality: number;
}

export interface CategoricalAnalysisResponse {
  distributions: CategoryDistribution[];
  crossTabulations?: Array<{
    columns: string[];
    contingencyTable: Record<string, Record<string, number>>;
    chiSquare?: number;
    pValue?: number;
  }>;
}

// Temporal Analysis Types
export interface TemporalAnalysisRequest {
  data: Record<string, unknown>[];
  dateColumn: string;
  valueColumns: string[];
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface TimeSeriesMetrics {
  column: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  seasonality: boolean;
  seasonalPeriod?: number;
  changePoints: Array<{
    date: string;
    type: 'increase' | 'decrease' | 'anomaly';
    magnitude: number;
  }>;
  forecast?: Array<{
    date: string;
    value: number;
    lowerBound: number;
    upperBound: number;
  }>;
}

export interface TemporalAnalysisResponse {
  dateRange: {
    start: string;
    end: string;
  };
  granularity: string;
  metrics: TimeSeriesMetrics[];
  aggregations: Array<{
    period: string;
    values: Record<string, number>;
  }>;
}

// Statistical Analysis Types
export interface StatisticalAnalysisRequest {
  data: Record<string, unknown>[];
  columns: string[];
  tests?: string[];
}

export interface StatisticalTest {
  name: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  interpretation: string;
}

export interface StatisticalAnalysisResponse {
  descriptive: Record<string, StatisticalSummary>;
  correlations: Array<{
    column1: string;
    column2: string;
    pearson?: number;
    spearman?: number;
  }>;
  tests: StatisticalTest[];
  outliers: Array<{
    column: string;
    indices: number[];
    method: string;
  }>;
}

// Health Status
export interface AnalysisHealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  capabilities: string[];
}

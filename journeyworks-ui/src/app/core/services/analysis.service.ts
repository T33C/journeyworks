import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/analysis`;

  /**
   * Analyze a single communication
   */
  analyzeCommunication(
    communicationId: string,
  ): Observable<CommunicationAnalysis> {
    return this.http.post<CommunicationAnalysis>(
      `${this.baseUrl}/communication/${communicationId}`,
      {},
    );
  }

  /**
   * Get sentiment trends over time
   */
  getSentimentTrends(params: TrendParams): Observable<SentimentTrend[]> {
    return this.http.get<SentimentTrend[]>(`${this.baseUrl}/trends/sentiment`, {
      params: params as any,
    });
  }

  /**
   * Get topic distribution
   */
  getTopicDistribution(params?: TrendParams): Observable<TopicDistribution> {
    return this.http.get<TopicDistribution>(`${this.baseUrl}/topics`, {
      params: params as any,
    });
  }

  /**
   * Get volume trends
   */
  getVolumeTrends(params: TrendParams): Observable<VolumeTrend[]> {
    return this.http.get<VolumeTrend[]>(`${this.baseUrl}/trends/volume`, {
      params: params as any,
    });
  }

  /**
   * Get risk assessment for customers
   */
  getRiskAssessment(customerId?: string): Observable<RiskAssessment[]> {
    const url = customerId
      ? `${this.baseUrl}/risk/${customerId}`
      : `${this.baseUrl}/risk`;
    return this.http.get<RiskAssessment[]>(url);
  }

  /**
   * Get executive summary / dashboard KPIs
   */
  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard`);
  }

  /**
   * Generate data card for a dataset
   */
  generateDataCard(datasetId: string): Observable<DataCard> {
    return this.http.post<DataCard>(
      `${this.baseUrl}/datacard/${datasetId}`,
      {},
    );
  }
}

export interface TrendParams {
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
  customerId?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface CommunicationAnalysis {
  communicationId: string;
  sentiment: {
    score: number;
    label: string;
    confidence: number;
  };
  topics: TopicAnalysis[];
  entities: Entity[];
  intent: string;
  urgency: 'low' | 'medium' | 'high';
  keyPhrases: string[];
  actionItems: string[];
  summary: string;
}

export interface TopicAnalysis {
  name: string;
  confidence: number;
  subtopics?: string[];
}

export interface Entity {
  text: string;
  type: 'person' | 'organization' | 'product' | 'date' | 'money' | 'other';
  confidence: number;
}

export interface SentimentTrend {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  average: number;
}

export interface TopicDistribution {
  topics: { name: string; count: number; percentage: number }[];
  trending: { name: string; change: number }[];
  emerging: string[];
}

export interface VolumeTrend {
  date: string;
  total: number;
  byChannel: Record<string, number>;
}

export interface RiskAssessment {
  customerId: string;
  customerName: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  trend: 'improving' | 'stable' | 'worsening';
  recommendations: string[];
}

export interface RiskFactor {
  name: string;
  severity: number;
  description: string;
}

export interface DashboardSummary {
  kpis: {
    totalCommunications: number;
    totalCommunicationsChange: number;
    openCases: number;
    openCasesChange: number;
    avgSentiment: number;
    avgSentimentChange: number;
    avgResponseTime: number;
    avgResponseTimeChange: number;
    atRiskCustomers: number;
    atRiskCustomersChange: number;
  };
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
  alerts: {
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }[];
}

export interface DataCard {
  datasetId: string;
  name: string;
  description: string;
  statistics: {
    rowCount: number;
    columnCount: number;
    missingValues: number;
    dateRange?: { from: string; to: string };
  };
  columns: {
    name: string;
    type: string;
    nullCount: number;
    uniqueCount: number;
    sampleValues: string[];
  }[];
  generatedAt: string;
}

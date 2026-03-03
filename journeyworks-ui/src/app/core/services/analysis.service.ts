import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Lightweight interface mirroring the backend AnalysisResult envelope.
 * Used to unwrap API responses into the specific shapes the UI needs.
 */
interface AnalysisResultEnvelope {
  type: string;
  summary: string;
  confidence: number;
  insights: Array<{
    category: string;
    text: string;
    severity: string;
    evidence?: string[];
  }>;
  metrics: Record<string, any>;
  visualizations?: Array<{ type: string; title: string; data: any[] }>;
  recommendations?: string[];
  processingTime: number;
}

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
      `${environment.apiUrl}/communications/${communicationId}/analyze`,
      {},
    );
  }

  /**
   * Get sentiment trends over time.
   * The backend returns an AnalysisResult; we extract the sentiment
   * visualization data into the SentimentTrend[] shape the UI expects.
   */
  getSentimentTrends(params: TrendParams): Observable<SentimentTrend[]> {
    return this.http
      .get<AnalysisResultEnvelope>(`${this.baseUrl}/trends/sentiment`, {
        params: params as any,
      })
      .pipe(
        map((result) => {
          const viz = result.visualizations?.find((v) =>
            v.title?.toLowerCase().includes('sentiment'),
          );
          if (viz?.data?.length) {
            return viz.data.map((d: any) => ({
              date: d.date,
              positive: d.positive || 0,
              neutral: d.neutral || 0,
              negative: d.negative || 0,
              average: d.average ?? (d.positive || 0) - (d.negative || 0),
            }));
          }
          return [];
        }),
      );
  }

  /**
   * Get topic distribution.
   * Extracts topic data from the AnalysisResult metrics.
   */
  getTopicDistribution(params?: TrendParams): Observable<TopicDistribution> {
    return this.http
      .get<AnalysisResultEnvelope>(`${this.baseUrl}/topics`, {
        params: params as any,
      })
      .pipe(
        map((result) => {
          const topTopics: Array<{ topic: string; count: number }> =
            result.metrics?.['topTopics'] || [];
          const totalCount = topTopics.reduce((s, t) => s + t.count, 0) || 1;
          return {
            topics: topTopics.map((t) => ({
              name: t.topic,
              count: t.count,
              percentage: Math.round((t.count / totalCount) * 100),
            })),
            trending: [],
            emerging: [],
          };
        }),
      );
  }

  /**
   * Get volume trends.
   * Extracts the volume visualization data from the AnalysisResult.
   */
  getVolumeTrends(params: TrendParams): Observable<VolumeTrend[]> {
    return this.http
      .get<AnalysisResultEnvelope>(`${this.baseUrl}/trends/volume`, {
        params: params as any,
      })
      .pipe(
        map((result) => {
          const viz = result.visualizations?.find((v) =>
            v.title?.toLowerCase().includes('volume'),
          );
          if (viz?.data?.length) {
            return viz.data.map((d: any) => ({
              date: d.date,
              total: d.volume ?? d.count ?? 0,
              byChannel: d.byChannel || {},
            }));
          }
          return [];
        }),
      );
  }

  /**
   * Get risk assessment for customers.
   * Wraps the AnalysisResult risk metrics into a RiskAssessment array.
   */
  getRiskAssessment(customerId?: string): Observable<RiskAssessment[]> {
    const url = customerId
      ? `${this.baseUrl}/risk/${customerId}`
      : `${this.baseUrl}/risk`;
    return this.http.get<AnalysisResultEnvelope>(url).pipe(
      map((result) => {
        const m = result.metrics || {};
        return [
          {
            customerId: customerId || 'overview',
            customerName: m['customerName'] || 'All Customers',
            riskScore: m['riskScore'] ?? 0,
            riskLevel: m['riskLevel'] ?? 'low',
            factors: (m['factors'] || []).map((f: any) => ({
              name: f.factor || f.name || 'Unknown',
              severity: f.impact === 'high' ? 3 : f.impact === 'medium' ? 2 : 1,
              description: f.description || '',
            })),
            trend: 'stable' as const,
            recommendations: result.recommendations || m['mitigations'] || [],
          },
        ];
      }),
    );
  }

  /**
   * Get executive summary / dashboard KPIs.
   * Extracts combined metrics from the dashboard endpoint.
   */
  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http
      .get<AnalysisResultEnvelope>(`${this.baseUrl}/dashboard`)
      .pipe(
        map((result) => {
          const sentiment = result.metrics?.['sentiment'] || {};
          const trends = result.metrics?.['trends'] || {};
          return {
            kpis: {
              totalCommunications: trends.totalCommunications ?? 0,
              totalCommunicationsChange: 0,
              openCases: 0,
              openCasesChange: 0,
              avgSentiment: sentiment.averageScore ?? 0,
              avgSentimentChange: 0,
              avgResponseTime: 0,
              avgResponseTimeChange: 0,
              atRiskCustomers: 0,
              atRiskCustomersChange: 0,
            },
            recentActivity: [],
            alerts: result.insights
              .filter((i) => i.severity === 'high' || i.severity === 'critical')
              .map((i) => ({
                severity:
                  i.severity === 'critical'
                    ? ('critical' as const)
                    : ('warning' as const),
                message: i.text,
                timestamp: new Date().toISOString(),
              })),
          };
        }),
      );
  }

  /**
   * Generate data card for a dataset
   */
  generateDataCard(datasetId: string): Observable<DataCard> {
    return this.http.post<DataCard>(`${this.baseUrl}/data-card`, {
      targetId: datasetId,
    });
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

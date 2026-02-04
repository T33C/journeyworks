/**
 * Analysis Service Client
 *
 * HTTP client for interacting with the Python analysis-service.
 * Provides data card generation, schema inference, and statistical analysis.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
  DataCardRequest,
  DataCard,
  SchemaInferenceRequest,
  SchemaInferenceResponse,
  CategoricalAnalysisRequest,
  CategoricalAnalysisResponse,
  TemporalAnalysisRequest,
  TemporalAnalysisResponse,
  StatisticalAnalysisRequest,
  StatisticalAnalysisResponse,
  AnalysisHealthStatus,
} from './analysis-service.types';

@Injectable()
export class AnalysisServiceClient implements OnModuleInit {
  private readonly logger = new Logger(AnalysisServiceClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private isHealthy: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl =
      this.configService.get<string>('services.analysisService.url') ||
      'http://localhost:8081';
    this.timeoutMs =
      this.configService.get<number>('services.analysisService.timeout') ||
      120000;
    this.logger.log(`Analysis service client configured for: ${this.baseUrl}`);
  }

  async onModuleInit(): Promise<void> {
    // Check health on startup (non-blocking)
    this.checkHealth().catch(() => {
      this.logger.warn('Analysis service not available on startup');
    });
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<AnalysisHealthStatus> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<AnalysisHealthStatus>(`${this.baseUrl}/health`)
          .pipe(
            timeout(5000),
            catchError((error: AxiosError) => {
              throw new Error(`Health check failed: ${error.message}`);
            }),
          ),
      );

      this.isHealthy = response.data.status === 'healthy';
      return response.data;
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isHealthy;
  }

  /**
   * Generate a data card for a dataset
   */
  async generateDataCard(request: DataCardRequest): Promise<DataCard> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post<DataCard>(`${this.baseUrl}/datacard`, request)
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(
                `Data card generation failed: ${error.message}`,
              );
              throw new Error(`Data card generation failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate data card: ${error.message}`);
      throw error;
    }
  }

  /**
   * Infer schema from data
   */
  async inferSchema(
    request: SchemaInferenceRequest,
  ): Promise<SchemaInferenceResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post<SchemaInferenceResponse>(
            `${this.baseUrl}/schema/infer`,
            request,
          )
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(`Schema inference failed: ${error.message}`);
              throw new Error(`Schema inference failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to infer schema: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform categorical analysis
   */
  async analyzeCategorical(
    request: CategoricalAnalysisRequest,
  ): Promise<CategoricalAnalysisResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post<CategoricalAnalysisResponse>(
            `${this.baseUrl}/analyze/categorical`,
            request,
          )
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(
                `Categorical analysis failed: ${error.message}`,
              );
              throw new Error(`Categorical analysis failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to analyze categorical data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform temporal analysis
   */
  async analyzeTemporal(
    request: TemporalAnalysisRequest,
  ): Promise<TemporalAnalysisResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post<TemporalAnalysisResponse>(
            `${this.baseUrl}/analyze/temporal`,
            request,
          )
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(`Temporal analysis failed: ${error.message}`);
              throw new Error(`Temporal analysis failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to analyze temporal data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform statistical analysis
   */
  async analyzeStatistical(
    request: StatisticalAnalysisRequest,
  ): Promise<StatisticalAnalysisResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post<StatisticalAnalysisResponse>(
            `${this.baseUrl}/analyze/statistical`,
            request,
          )
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(
                `Statistical analysis failed: ${error.message}`,
              );
              throw new Error(`Statistical analysis failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to perform statistical analysis: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Convenience method: Analyze communications data
   */
  async analyzeCommunications(
    communications: Array<{
      id: string;
      channel: string;
      sentiment: string;
      timestamp: string;
      [key: string]: unknown;
    }>,
  ): Promise<{
    dataCard: DataCard;
    temporalAnalysis: TemporalAnalysisResponse;
    categoricalAnalysis: CategoricalAnalysisResponse;
  }> {
    // Generate data card
    const dataCard = await this.generateDataCard({
      data: communications,
      title: 'Communications Analysis',
      description: 'Comprehensive analysis of customer communications',
      generateInsights: true,
    });

    // Temporal analysis
    const temporalAnalysis = await this.analyzeTemporal({
      data: communications,
      dateColumn: 'timestamp',
      valueColumns: ['sentiment'],
      granularity: 'day',
    });

    // Categorical analysis
    const categoricalAnalysis = await this.analyzeCategorical({
      data: communications,
      columns: ['channel', 'sentiment'],
    });

    return {
      dataCard,
      temporalAnalysis,
      categoricalAnalysis,
    };
  }

  /**
   * Convenience method: Analyze cases data
   */
  async analyzeCases(
    cases: Array<{
      id: string;
      status: string;
      priority: string;
      createdAt: string;
      [key: string]: unknown;
    }>,
  ): Promise<{
    dataCard: DataCard;
    statusDistribution: CategoricalAnalysisResponse;
  }> {
    const dataCard = await this.generateDataCard({
      data: cases,
      title: 'Cases Analysis',
      description: 'Analysis of customer cases and complaints',
      generateInsights: true,
    });

    const statusDistribution = await this.analyzeCategorical({
      data: cases,
      columns: ['status', 'priority'],
    });

    return {
      dataCard,
      statusDistribution,
    };
  }
}

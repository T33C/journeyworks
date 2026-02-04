/**
 * Model Service Client
 *
 * HTTP client for interacting with the Python model-service.
 * Provides embeddings (dense + sparse) and reranking capabilities.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
  EmbeddingRequest,
  EmbeddingResponse,
  SparseEmbeddingRequest,
  SparseEmbeddingResponse,
  RerankRequest,
  RerankResponse,
  ModelHealthStatus,
  SparseVector,
} from './model-service.types';

@Injectable()
export class ModelServiceClient implements OnModuleInit {
  private readonly logger = new Logger(ModelServiceClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private isHealthy: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl =
      this.configService.get<string>('services.modelService.url') ||
      'http://localhost:8080';
    this.timeoutMs =
      this.configService.get<number>('services.modelService.timeout') || 30000;
    this.logger.log(`Model service client configured for: ${this.baseUrl}`);
  }

  async onModuleInit(): Promise<void> {
    // Check health on startup (non-blocking)
    this.checkHealth().catch(() => {
      this.logger.warn('Model service not available on startup');
    });
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<ModelHealthStatus> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ModelHealthStatus>(`${this.baseUrl}/health`).pipe(
          timeout(5000),
          catchError((error: AxiosError) => {
            throw new Error(`Health check failed: ${error.message}`);
          }),
        ),
      );

      this.isHealthy = response.data.status === 'ok';
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
   * Generate dense embeddings for texts
   */
  async embedTexts(
    texts: string[],
    model?: string,
  ): Promise<EmbeddingResponse> {
    const request: EmbeddingRequest = { texts, model };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<EmbeddingResponse>(`${this.baseUrl}/embed/dense/batch`, request)
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(`Embedding request failed: ${error.message}`);
              throw new Error(`Embedding failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(text: string, model?: string): Promise<number[]> {
    const response = await this.embedTexts([text], model);
    return response.embeddings[0];
  }

  /**
   * Generate sparse embeddings (SPLADE) for texts
   */
  async embedSparse(texts: string[]): Promise<SparseEmbeddingResponse> {
    const request: SparseEmbeddingRequest = { texts };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<SparseEmbeddingResponse>(
            `${this.baseUrl}/embed/sparse/batch`,
            request,
          )
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(
                `Sparse embedding request failed: ${error.message}`,
              );
              throw new Error(`Sparse embedding failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to generate sparse embeddings: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate sparse embedding for a single text
   */
  async embedTextSparse(text: string): Promise<SparseVector> {
    const response = await this.embedSparse([text]);
    return response.sparse_vectors[0];
  }

  /**
   * Rerank documents for a query
   */
  async rerank(
    query: string,
    documents: Array<{ id: string | number; text: string }>,
    topN?: number,
  ): Promise<RerankResponse> {
    const request: RerankRequest = { query, documents, top_n: topN };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<RerankResponse>(`${this.baseUrl}/rerank`, request)
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              this.logger.error(`Rerank request failed: ${error.message}`);
              throw new Error(`Reranking failed: ${error.message}`);
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to rerank documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate both dense and sparse embeddings
   */
  async embedHybrid(
    texts: string[],
    model?: string,
  ): Promise<{ dense: EmbeddingResponse; sparse: SparseEmbeddingResponse }> {
    const [dense, sparse] = await Promise.all([
      this.embedTexts(texts, model),
      this.embedSparse(texts),
    ]);

    return { dense, sparse };
  }

  /**
   * Batch embed with chunking for large datasets
   */
  async embedTextsBatched(
    texts: string[],
    batchSize: number = 32,
    model?: string,
  ): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.embedTexts(batch, model);
      allEmbeddings.push(...response.embeddings);

      // Log progress for large batches
      if (texts.length > batchSize) {
        this.logger.log(
          `Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} texts`,
        );
      }
    }

    return allEmbeddings;
  }
}

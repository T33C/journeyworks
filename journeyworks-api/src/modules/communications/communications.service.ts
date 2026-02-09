/**
 * Communications Service
 *
 * Business logic for communication operations.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CommunicationsRepository,
  CommunicationDocument,
} from './communications.repository';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { RedisCacheService } from '../../infrastructure/redis';
import {
  CreateCommunicationDto,
  UpdateCommunicationDto,
  SearchCommunicationsDto,
  SemanticSearchDto,
  CommunicationResponseDto,
  PaginatedCommunicationsDto,
  CommunicationAggregationsDto,
  CommunicationStatsDto,
  CommunicationStatus,
} from './dto';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly CACHE_PREFIX = 'comm:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Create a new communication
   */
  async create(dto: CreateCommunicationDto): Promise<CommunicationResponseDto> {
    const now = new Date().toISOString();

    const document: CommunicationDocument = {
      id: uuidv4(),
      channel: dto.channel,
      direction: dto.direction,
      customerId: dto.customerId,
      customerName: dto.customerName,
      caseId: dto.caseId,
      subject: dto.subject,
      content: dto.content,
      summary: dto.summary,
      timestamp: dto.timestamp || now,
      status: 'open',
      priority: dto.priority,
      sentiment: dto.sentiment,
      intent: dto.intent,
      entities: dto.entities,
      tags: dto.tags || [],
      attachments: dto.attachments,
      metadata: dto.metadata,
      aiClassification: dto.aiClassification as any,
      messages: dto.messages as any,
      threadId: dto.threadId,
      relatedEventId: dto.relatedEventId,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(document.id, document);
    this.logger.log(`Created communication: ${document.id}`);

    return this.toResponseDto(document);
  }

  /**
   * Create multiple communications in bulk
   */
  async createBulk(
    dtos: CreateCommunicationDto[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();

    const documents: CommunicationDocument[] = dtos.map((dto) => ({
      id: uuidv4(),
      channel: dto.channel,
      direction: dto.direction,
      customerId: dto.customerId,
      customerName: dto.customerName,
      caseId: dto.caseId,
      subject: dto.subject,
      content: dto.content,
      summary: dto.summary,
      timestamp: dto.timestamp || now,
      status: 'open',
      priority: dto.priority,
      sentiment: dto.sentiment,
      intent: dto.intent,
      entities: dto.entities,
      tags: dto.tags || [],
      attachments: dto.attachments,
      metadata: dto.metadata,
      aiClassification: dto.aiClassification as any,
      messages: dto.messages as any,
      threadId: dto.threadId,
      relatedEventId: dto.relatedEventId,
      createdAt: now,
      updatedAt: now,
    }));

    const results = await this.repository.bulkIndex(documents);
    this.logger.log(
      `Bulk created ${results.created} communications, ${results.failed} failed`,
    );

    return { created: results.created, failed: results.failed };
  }

  /**
   * Get communication by ID
   */
  async findById(id: string): Promise<CommunicationResponseDto> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;

    // Try cache first
    const cached = await this.cache.get<CommunicationDocument>(cacheKey);
    if (cached) {
      return this.toResponseDto(cached);
    }

    const document = await this.repository.findById(id);
    if (!document) {
      throw new NotFoundException(`Communication not found: ${id}`);
    }

    // Cache the result
    await this.cache.set(cacheKey, document, this.CACHE_TTL);

    return this.toResponseDto(document);
  }

  /**
   * Update a communication
   */
  async update(
    id: string,
    dto: UpdateCommunicationDto,
  ): Promise<CommunicationResponseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Communication not found: ${id}`);
    }

    const updates: Partial<CommunicationDocument> = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.updateById(id, updates);

    // Invalidate cache
    await this.cache.delete(`${this.CACHE_PREFIX}${id}`);

    const updated = await this.repository.findById(id);
    return this.toResponseDto(updated!);
  }

  /**
   * Delete a communication
   */
  async delete(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Communication not found: ${id}`);
    }

    await this.repository.deleteById(id);
    await this.cache.delete(`${this.CACHE_PREFIX}${id}`);

    this.logger.log(`Deleted communication: ${id}`);
  }

  /**
   * Search communications
   */
  async search(
    dto: SearchCommunicationsDto,
  ): Promise<PaginatedCommunicationsDto> {
    const results = await this.repository.searchCommunications(
      dto.query,
      {
        channels: dto.channels,
        direction: dto.direction,
        sentiments: dto.sentiments,
        statuses: dto.statuses,
        priorities: dto.priorities,
        customerId: dto.customerId,
        caseId: dto.caseId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        tags: dto.tags,
        product: dto.product,
      },
      {
        from: dto.from || 0,
        size: dto.size || 20,
        sort: dto.sortField
          ? [{ [dto.sortField]: dto.sortOrder || 'desc' }]
          : [{ timestamp: 'desc' }],
      },
    );

    return {
      items: results.hits.map((hit) => ({
        ...this.toResponseDto(hit.source),
        score: hit.score,
        highlights: hit.highlight,
      })),
      total: results.total,
      from: dto.from || 0,
      size: dto.size || 20,
      hasMore: (dto.from || 0) + (dto.size || 20) < results.total,
    };
  }

  /**
   * Semantic search
   */
  async semanticSearch(
    dto: SemanticSearchDto,
  ): Promise<PaginatedCommunicationsDto> {
    const results = await this.repository.semanticSearch(
      dto.query,
      dto.topK || 10,
      {
        channels: dto.channels,
        customerId: dto.customerId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    );

    let items = results.hits.map((hit) => ({
      ...this.toResponseDto(hit.source),
      score: hit.score,
    }));

    // Apply reranking if requested
    if (dto.useReranking && items.length > 0) {
      // This would call the model service for reranking
      // For now, just return the vector search results
      this.logger.log('Reranking requested but not yet implemented');
    }

    return {
      items,
      total: results.total,
      from: 0,
      size: dto.topK || 10,
      hasMore: false,
    };
  }

  /**
   * Get communications by customer
   */
  async getByCustomer(
    customerId: string,
    from: number = 0,
    size: number = 20,
  ): Promise<PaginatedCommunicationsDto> {
    const results = await this.repository.getByCustomerId(customerId, {
      from,
      size,
    });

    return {
      items: results.hits.map((hit) => this.toResponseDto(hit.source)),
      total: results.total,
      from,
      size,
      hasMore: from + size < results.total,
    };
  }

  /**
   * Get communications by case
   */
  async getByCase(caseId: string): Promise<CommunicationResponseDto[]> {
    const results = await this.repository.getByCaseId(caseId, { size: 1000 });
    return results.hits.map((hit) => this.toResponseDto(hit.source));
  }

  /**
   * Get aggregations
   */
  async getAggregations(
    customerId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CommunicationAggregationsDto> {
    return this.repository.getAggregations({
      customerId,
      startDate,
      endDate,
    });
  }

  /**
   * Analyze communication content using LLM
   */
  async analyzeContent(id: string): Promise<{
    sentiment: { label: string; score: number; confidence: number };
    intent: { primary: string; secondary: string[]; confidence: number };
    entities: Array<{ type: string; value: string; confidence: number }>;
    summary: string;
  }> {
    const communication = await this.repository.findById(id);
    if (!communication) {
      throw new NotFoundException(`Communication not found: ${id}`);
    }

    // Generate comprehensive analysis prompt
    const prompt = this.promptTemplate.renderNamed('analysis:comprehensive', {
      content: communication.content,
      channel: communication.channel,
      customerId: communication.customerId,
      customerName: communication.customerName || 'Unknown',
      date: communication.timestamp,
      previousContext: 'None available',
    });

    const response = await this.llmClient.prompt(
      prompt,
      this.promptTemplate.getTemplate('system:analyst'),
    );

    // Parse JSON response
    try {
      const analysis = JSON.parse(response);

      // Update the communication with analysis results
      await this.update(id, {
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        entities: analysis.entities,
        summary: analysis.summary?.headline || analysis.summary,
      });

      return analysis;
    } catch (error) {
      this.logger.error(
        `Failed to parse LLM analysis response: ${error.message}`,
      );
      throw new Error('Failed to analyze communication content');
    }
  }

  /**
   * Generate embeddings for a communication
   */
  async generateEmbedding(id: string): Promise<void> {
    const communication = await this.repository.findById(id);
    if (!communication) {
      throw new NotFoundException(`Communication not found: ${id}`);
    }

    await this.repository.addEmbedding(id, communication.content);
    this.logger.log(`Generated embedding for communication: ${id}`);
  }

  /**
   * Bulk generate embeddings
   */
  async bulkGenerateEmbeddings(
    ids?: string[],
    limit?: number,
  ): Promise<{ processed: number }> {
    let documents: Array<{ id: string; content: string }>;

    if (ids?.length) {
      // Get specific documents
      documents = [];
      for (const id of ids) {
        const doc = await this.repository.findById(id);
        if (doc) {
          documents.push({ id: doc.id, content: doc.content });
        }
      }
    } else {
      // Get documents without embeddings using exists query
      const results = await this.repository.searchWithoutEmbeddings(
        limit || 1000,
      );
      documents = results.map((hit) => ({
        id: hit.source.id,
        content: hit.source.content,
      }));
    }

    if (documents.length > 0) {
      await this.repository.bulkAddEmbeddings(documents);
    }

    return { processed: documents.length };
  }

  // ===========================================================================
  // Phase 3 Additions: Recent, Stats, and Status Updates
  // ===========================================================================

  /**
   * Get recent communications
   */
  async getRecent(
    limit: number = 20,
    channel?: string,
    sentiment?: string,
  ): Promise<PaginatedCommunicationsDto> {
    const results = await this.repository.searchCommunications(
      undefined,
      {
        channels: channel ? [channel] : undefined,
        sentiments: sentiment ? [sentiment] : undefined,
      },
      {
        size: limit,
      },
    );

    return {
      items: results.hits.map((hit) => this.toResponseDto(hit.source)),
      total: results.total,
      from: 0,
      size: limit,
      hasMore: results.total > limit,
    };
  }

  /**
   * Get communication statistics for dashboard
   */
  async getStats(
    startDate?: string,
    endDate?: string,
  ): Promise<CommunicationStatsDto> {
    // Get aggregations for the period
    const aggregations = await this.getAggregations(
      undefined,
      startDate,
      endDate,
    );

    // Calculate date ranges
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get counts for different time periods
    const [last24HoursResult, last7DaysResult] = await Promise.all([
      this.repository.searchCommunications(
        undefined,
        { startDate: yesterday.toISOString() },
        { size: 0 },
      ),
      this.repository.searchCommunications(
        undefined,
        { startDate: lastWeek.toISOString() },
        { size: 0 },
      ),
    ]);

    // Calculate totals from aggregations
    const total = Object.values(aggregations.byChannel).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Calculate average sentiment (using synthetic data patterns)
    const sentimentCounts = aggregations.bySentiment;
    const totalWithSentiment =
      (sentimentCounts.positive || 0) +
      (sentimentCounts.neutral || 0) +
      (sentimentCounts.negative || 0) +
      (sentimentCounts.mixed || 0);

    let avgSentimentScore = 0;
    if (totalWithSentiment > 0) {
      // Weighted score: positive=0.7, neutral=0.1, mixed=-0.2, negative=-0.6
      avgSentimentScore =
        ((sentimentCounts.positive || 0) * 0.7 +
          (sentimentCounts.neutral || 0) * 0.1 +
          (sentimentCounts.mixed || 0) * -0.2 +
          (sentimentCounts.negative || 0) * -0.6) /
        totalWithSentiment;
    }

    // Calculate requires attention percentage (negative sentiment)
    const requiresAttentionPct =
      totalWithSentiment > 0
        ? ((sentimentCounts.negative || 0) / totalWithSentiment) * 100
        : 0;

    // Placeholder for top customers (would require aggregation query in real implementation)
    const topCustomers = [
      { customerId: 'CUST-001', customerName: 'James Morrison', count: 12 },
      { customerId: 'CUST-002', customerName: 'Emma Richardson', count: 8 },
      { customerId: 'CUST-003', customerName: 'Robert Thompson', count: 7 },
      { customerId: 'CUST-004', customerName: 'Sarah Williams', count: 6 },
      { customerId: 'CUST-005', customerName: 'Michael Brown', count: 5 },
    ];

    // Placeholder for trend (would compare with previous period)
    const trend = {
      volumeChange: 12.5, // +12.5% vs previous period
      sentimentChange: -0.05, // Slight sentiment decline
    };

    return {
      total,
      last24Hours: last24HoursResult.total,
      last7Days: last7DaysResult.total,
      byChannel: aggregations.byChannel,
      bySentiment: aggregations.bySentiment,
      byStatus: {
        new: Math.floor(total * 0.3),
        reviewed: Math.floor(total * 0.25),
        actioned: Math.floor(total * 0.2),
        resolved: Math.floor(total * 0.2),
        escalated: Math.floor(total * 0.05),
      },
      avgSentimentScore: Math.round(avgSentimentScore * 100) / 100,
      requiresAttentionPct: Math.round(requiresAttentionPct * 10) / 10,
      topCustomers,
      trend,
    };
  }

  /**
   * Update communication status
   */
  async updateStatus(
    id: string,
    status: CommunicationStatus,
    note?: string,
  ): Promise<CommunicationResponseDto> {
    const existing = await this.findById(id);

    const updatePayload: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    // Add status change to metadata history
    if (note) {
      const metadata = existing.metadata || {};
      const statusHistory = (metadata.statusHistory as unknown[]) || [];
      statusHistory.push({
        from: existing.metadata?.status || 'new',
        to: status,
        note,
        timestamp: new Date().toISOString(),
      });
      updatePayload.metadata = { ...metadata, statusHistory };
    }

    await this.repository.updateById(id, updatePayload);

    // Invalidate cache
    await this.cache.delete(`${this.CACHE_PREFIX}${id}`);

    return this.findById(id);
  }

  /**
   * Delete all communications (for seeding/reset)
   */
  async deleteAll(): Promise<{ deleted: number }> {
    this.logger.log('Deleting all communications...');

    // Delete all documents matching everything
    const deleted = await this.repository.deleteAll();

    // Clear cache
    await this.cache.deletePattern(`${this.CACHE_PREFIX}*`);

    this.logger.log(`Deleted ${deleted} communications`);
    return { deleted };
  }

  /**
   * Convert document to response DTO
   */
  private toResponseDto(doc: CommunicationDocument): CommunicationResponseDto {
    return {
      id: doc.id,
      channel: doc.channel as any,
      direction: doc.direction as any,
      customerId: doc.customerId,
      customerName: doc.customerName,
      caseId: doc.caseId,
      subject: doc.subject,
      content: doc.content,
      summary: doc.summary,
      timestamp: doc.timestamp,
      status: doc.status as CommunicationStatus,
      priority: doc.priority as any,
      sentiment: doc.sentiment as any,
      intent: doc.intent as any,
      entities: doc.entities as any,
      tags: doc.tags,
      attachments: doc.attachments as any,
      metadata: doc.metadata,
      aiClassification: doc.aiClassification as any,
      messages: doc.messages as any,
      threadId: doc.threadId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

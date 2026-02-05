/**
 * RAG Service
 *
 * Implements Retrieval-Augmented Generation for customer communications
 * with query enhancement and structured response formatting for
 * customer intelligence research.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { ModelServiceClient } from '../../infrastructure/model-service';
import { RedisCacheService } from '../../infrastructure/redis';
import { CommunicationsRepository } from '../communications/communications.repository';
import { ContextualChunker } from './contextual-chunker.service';
import { QueryEnhancerService } from './query-enhancer.service';
import { ResponseFormatterService } from './response-formatter.service';
import { RagQuery, RagResponse, RagResult } from './rag.types';

/** RAG configuration constants */
const RAG_CONFIG = {
  /** Default number of documents to retrieve (per Anthropic research, top-20 performs best) */
  DEFAULT_TOP_K: 20,
  /** Documents to keep after reranking */
  DEFAULT_RERANK_TOP_K: 10,
  /** Minimum score threshold for retrieval */
  DEFAULT_MIN_SCORE: 0.5,
  /** Multiplier for initial retrieval (get more for filtering) */
  RETRIEVAL_MULTIPLIER: 2,
  /** Maximum characters for document context sent to LLM */
  MAX_CONTEXT_CHARS: 50000,
  /** Maximum characters per document in context */
  MAX_DOC_CHARS: 4000,
  /** Default excerpt length */
  DEFAULT_EXCERPT_LENGTH: 150,
  /** Number of sources to include when parsing fails */
  FALLBACK_SOURCE_COUNT: 3,
  /** Default confidence when JSON parsing fails */
  FALLBACK_CONFIDENCE: 0.6,
  /** Default confidence when JSON parsed but no value */
  DEFAULT_CONFIDENCE: 0.7,
  /** Default topK for customer queries */
  CUSTOMER_QUERY_TOP_K: 15,
  /** Default max communications for summary */
  DEFAULT_MAX_COMMUNICATIONS: 20,
} as const;

/** Metadata about degraded operation modes */
interface DegradedModeInfo {
  queryEnhancementFailed?: boolean;
  rerankingFailed?: boolean;
  reason?: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly topK: number;
  private readonly rerankTopK: number;
  private readonly minScore: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly modelService: ModelServiceClient,
    private readonly cache: RedisCacheService,
    private readonly communicationsRepo: CommunicationsRepository,
    // Note: chunker and responseFormatter are available for future use
    // when implementing contextual embedding and structured formatting
    private readonly chunker: ContextualChunker,
    private readonly queryEnhancer: QueryEnhancerService,
    private readonly responseFormatter: ResponseFormatterService,
  ) {
    // Per Anthropic's Contextual RAG research, top-20 performs best
    this.topK =
      this.configService.get<number>('rag.topK') || RAG_CONFIG.DEFAULT_TOP_K;
    this.rerankTopK =
      this.configService.get<number>('rag.rerankTopK') ||
      RAG_CONFIG.DEFAULT_RERANK_TOP_K;
    this.minScore =
      this.configService.get<number>('rag.minScore') ||
      RAG_CONFIG.DEFAULT_MIN_SCORE;
  }

  /**
   * Main RAG query method with optional query enhancement
   */
  async query(request: RagQuery): Promise<RagResponse> {
    const startTime = Date.now();
    const topK = request.topK || this.topK;
    const degradedMode: DegradedModeInfo = {};

    this.logger.log(`Processing RAG query: "${request.query}"`);

    // 0. Optional: Enhance query for better retrieval
    let searchQuery = request.query;
    if (request.enhanceQuery !== false) {
      try {
        const enhanced = await this.queryEnhancer.enhance(request.query, {
          timeRange: this.buildTimeRange(request.filters),
          selectedFilters: JSON.stringify(request.filters || {}),
        });
        // Use primary enhanced query, fall back to original
        searchQuery = enhanced.enhancedQueries[0]?.query || request.query;
        this.logger.debug(`Enhanced query: "${searchQuery}"`);
      } catch (error) {
        degradedMode.queryEnhancementFailed = true;
        degradedMode.reason = `Query enhancement failed: ${error.message}`;
        this.logger.warn(
          `Query enhancement failed, using original: ${error.message}`,
        );
      }
    }

    // 1. Retrieve relevant documents
    const retrievalResults = await this.retrieve(
      { ...request, query: searchQuery },
      topK,
    );

    // 2. Optionally rerank results
    let finalResults = retrievalResults;
    if (request.useReranking && retrievalResults.length > 0) {
      try {
        finalResults = await this.rerank(
          request.query, // Use original query for reranking
          retrievalResults,
          this.rerankTopK,
        );
      } catch (error) {
        degradedMode.rerankingFailed = true;
        degradedMode.reason = `Reranking failed: ${error.message}`;
        this.logger.warn(
          `Reranking failed: ${error.message}, using original order`,
        );
        finalResults = retrievalResults.slice(0, this.rerankTopK);
      }
    }

    // 3. Generate answer using LLM
    const answer = await this.generate(request.query, finalResults);

    const processingTime = Date.now() - startTime;

    return {
      query: request.query,
      answer: answer.content,
      confidence: answer.confidence,
      results: finalResults,
      sources: answer.sources,
      processingTime,
    };
  }

  /**
   * Retrieve relevant documents
   */
  private async retrieve(
    request: RagQuery,
    topK: number,
  ): Promise<RagResult[]> {
    // Try hybrid search first (combines BM25 + vector)
    const searchResults = await this.communicationsRepo.searchHybrid(
      request.query,
      topK * RAG_CONFIG.RETRIEVAL_MULTIPLIER, // Get more for filtering
      {
        channels: request.filters?.channels,
        customerId: request.filters?.customerId,
        sentiments: request.filters?.sentiments,
        startDate: request.filters?.startDate,
        endDate: request.filters?.endDate,
        tags: request.filters?.tags,
      },
    );

    const results: RagResult[] = [];

    for (const hit of searchResults.hits) {
      const doc = hit.source;

      // Filter by minimum score
      if (hit.score && hit.score < this.minScore) {
        continue;
      }

      results.push({
        document: {
          id: doc.id,
          content: doc.content,
          metadata: {
            source: 'communication',
            sourceId: doc.id,
            customerId: doc.customerId,
            customerName: doc.customerName,
            channel: doc.channel,
            timestamp: doc.timestamp,
            sentiment: doc.sentiment?.label,
            tags: doc.tags,
          },
        },
        score: hit.score || 0,
        highlights: hit.highlight
          ? Object.values(hit.highlight).flat()
          : undefined,
      });

      if (results.length >= topK) {
        break;
      }
    }

    this.logger.log(`Retrieved ${results.length} documents`);
    return results;
  }

  /**
   * Rerank results using cross-encoder
   * Throws on failure - caller should handle fallback
   */
  private async rerank(
    query: string,
    results: RagResult[],
    topK: number,
  ): Promise<RagResult[]> {
    if (results.length === 0) {
      return results;
    }

    // Build document objects with IDs for the reranker
    const documents = results.map((r, idx) => ({
      id: idx,
      text: r.document.content,
    }));

    const rerankResponse = await this.modelService.rerank(
      query,
      documents,
      topK,
    );

    // Map reranked results back using the document IDs
    const rerankedResults: RagResult[] = rerankResponse.reranked_documents.map(
      (doc) => ({
        ...results[doc.id as number],
        rerankScore: doc.score,
      }),
    );

    // Results are already sorted by score from the model service
    this.logger.log(`Reranked to ${rerankedResults.length} documents`);
    return rerankedResults;
  }

  /**
   * Generate answer using LLM with customer intelligence system prompt
   * Limits context size to prevent LLM overload
   */
  private async generate(
    query: string,
    results: RagResult[],
  ): Promise<{
    content: string;
    confidence: number;
    sources: Array<{ id: string; relevance: string; excerpt: string }>;
  }> {
    if (results.length === 0) {
      return {
        content:
          'I could not find any relevant information to answer your question. Please try rephrasing or providing more context.',
        confidence: 0,
        sources: [],
      };
    }

    // Build context from documents with size limits
    let totalChars = 0;
    const includedDocs: typeof results = [];

    for (const r of results) {
      const docSize = Math.min(
        r.document.content.length,
        RAG_CONFIG.MAX_DOC_CHARS,
      );
      if (totalChars + docSize > RAG_CONFIG.MAX_CONTEXT_CHARS) {
        this.logger.debug(
          `Context limit reached, using ${includedDocs.length}/${results.length} documents`,
        );
        break;
      }
      includedDocs.push(r);
      totalChars += docSize;
    }

    const documentsContext = includedDocs
      .map((r, i) => {
        const meta = r.document.metadata;
        const content =
          r.document.content.length > RAG_CONFIG.MAX_DOC_CHARS
            ? r.document.content.substring(0, RAG_CONFIG.MAX_DOC_CHARS) + '...'
            : r.document.content;
        return `Document ${i + 1} [ID: ${r.document.id}]:
Source: ${meta.source} | Channel: ${meta.channel || 'N/A'} | Customer: ${meta.customerName || 'N/A'}
Date: ${meta.timestamp || 'N/A'} | Sentiment: ${meta.sentiment || 'N/A'}
Content:
${content}
---`;
      })
      .join('\n\n');

    const prompt = this.promptTemplate.renderNamed('rag:answer', {
      question: query,
      documents: documentsContext,
    });

    // Use customer intelligence system prompt for better structured responses
    const systemPrompt =
      this.promptTemplate.getTemplate('system:customerIntelligence') ||
      this.promptTemplate.getTemplate('system:researcher');

    const response = await this.llmClient.prompt(prompt, systemPrompt, {
      rateLimitKey: 'llm:rag',
    });

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response);
      // Clamp confidence to valid range [0, 1]
      const confidence = Math.min(
        1,
        Math.max(0, parsed.confidence || RAG_CONFIG.DEFAULT_CONFIDENCE),
      );
      return {
        content: parsed.answer || response,
        confidence,
        sources: (parsed.sources || []).map((s: any) => ({
          id: s.documentId || s.id,
          relevance: s.relevance || 'Relevant to the query',
          excerpt: this.extractExcerpt(
            includedDocs.find((r) => r.document.id === (s.documentId || s.id))
              ?.document.content || '',
          ),
        })),
      };
    } catch {
      // If not JSON, return as plain text
      return {
        content: response,
        confidence: RAG_CONFIG.FALLBACK_CONFIDENCE,
        sources: includedDocs
          .slice(0, RAG_CONFIG.FALLBACK_SOURCE_COUNT)
          .map((r) => ({
            id: r.document.id,
            relevance: 'Used in generating response',
            excerpt: this.extractExcerpt(r.document.content),
          })),
      };
    }
  }

  /**
   * Extract a short excerpt from content
   */
  private extractExcerpt(
    content: string,
    maxLength: number = RAG_CONFIG.DEFAULT_EXCERPT_LENGTH,
  ): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Semantic search only (no generation)
   */
  async semanticSearch(
    query: string,
    topK: number = 10,
    filters?: RagQuery['filters'],
  ): Promise<RagResult[]> {
    return this.retrieve({ query, topK, filters }, topK);
  }

  /**
   * Get similar documents to a given document
   */
  async findSimilar(
    documentId: string,
    topK: number = 5,
  ): Promise<RagResult[]> {
    const document = await this.communicationsRepo.findById(documentId);
    if (!document) {
      return [];
    }

    return this.semanticSearch(document.content, topK + 1, {}).then((results) =>
      results.filter((r) => r.document.id !== documentId).slice(0, topK),
    );
  }

  /**
   * Answer a question about a specific customer
   */
  async askAboutCustomer(
    customerId: string,
    question: string,
  ): Promise<RagResponse> {
    return this.query({
      query: question,
      topK: RAG_CONFIG.CUSTOMER_QUERY_TOP_K,
      filters: { customerId },
      useReranking: true,
    });
  }

  /**
   * Summarize communications for a customer
   */
  async summarizeCustomerCommunications(
    customerId: string,
    maxCommunications: number = RAG_CONFIG.DEFAULT_MAX_COMMUNICATIONS,
  ): Promise<string> {
    const results = await this.communicationsRepo.getByCustomerId(customerId, {
      size: maxCommunications,
    });

    if (results.hits.length === 0) {
      return 'No communications found for this customer.';
    }

    const communicationsSummary = results.hits
      .map((hit) => {
        const doc = hit.source;
        return `[${doc.timestamp}] ${doc.channel}: ${doc.summary || doc.content.substring(0, 200)}`;
      })
      .join('\n');

    const prompt = `Summarize the following customer communications. Identify key themes, sentiment trends, and any issues or concerns raised.

Communications:
${communicationsSummary}

Provide a concise summary (2-3 paragraphs) covering:
1. Overall relationship health and sentiment
2. Key topics and concerns discussed
3. Any action items or follow-ups needed`;

    return this.llmClient.prompt(
      prompt,
      this.promptTemplate.getTemplate('system:customerIntelligence') ||
        this.promptTemplate.getTemplate('system:analyst'),
      { rateLimitKey: 'llm:rag' },
    );
  }

  /**
   * Index documents for RAG (add embeddings)
   */
  async indexDocuments(documentIds?: string[]): Promise<{ indexed: number }> {
    if (!documentIds || documentIds.length === 0) {
      // No specific IDs - could implement full reindex here
      this.logger.log('No document IDs provided for indexing');
      return { indexed: 0 };
    }

    const documents = await Promise.all(
      documentIds.map(async (id) => {
        const doc = await this.communicationsRepo.findById(id);
        return doc ? { id: doc.id, content: doc.content } : null;
      }),
    ).then((docs) =>
      docs.filter((d): d is { id: string; content: string } => d !== null),
    );

    if (documents.length === 0) {
      this.logger.warn('No valid documents found for provided IDs');
      return { indexed: 0 };
    }

    await this.communicationsRepo.bulkAddEmbeddings(documents);
    this.logger.log(`Indexed ${documents.length} documents`);

    return { indexed: documents.length };
  }

  /**
   * Build a human-readable time range description from filters
   */
  private buildTimeRange(filters?: RagQuery['filters']): string {
    if (!filters?.startDate && !filters?.endDate) {
      return 'All available data';
    }

    const start = filters.startDate
      ? new Date(filters.startDate).toLocaleDateString()
      : 'earliest';
    const end = filters.endDate
      ? new Date(filters.endDate).toLocaleDateString()
      : 'latest';

    return `${start} to ${end}`;
  }
}

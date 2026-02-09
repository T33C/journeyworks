/**
 * Query Enhancement Service
 *
 * Transforms user queries into optimized search strategies using LLM-powered
 * query understanding, expansion, and decomposition.
 *
 * This service implements query rewriting for better retrieval in the
 * Customer Intelligence Research application.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { RedisCacheService } from '../../infrastructure/redis';

export interface EnhancedQuery {
  originalIntent: string;
  enhancedQueries: Array<{
    query: string;
    purpose: string;
    weight: number;
  }>;
  suggestedFilters: {
    channels?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral' | 'all';
    dateRange?: string;
    priority?: string;
  };
  keyTerms: string[];
  synonymExpansion: Record<string, string[]>;
  subQuestions: string[];
  analysisHints: string[];
}

export interface QueryEnhancementOptions {
  timeRange?: string;
  customerContext?: string;
  selectedFilters?: string;
  skipCache?: boolean;
}

@Injectable()
export class QueryEnhancerService {
  private readonly logger = new Logger(QueryEnhancerService.name);
  private readonly cachePrefix = 'query:enhanced:';
  private readonly cacheTtl = 3600; // 1 hour

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Enhance a user query for optimal retrieval
   */
  async enhance(
    query: string,
    options: QueryEnhancementOptions = {},
  ): Promise<EnhancedQuery> {
    const startTime = Date.now();

    // Check cache first
    if (!options.skipCache) {
      const cacheKey = this.buildCacheKey(query, options);
      const cached = await this.cache.get<EnhancedQuery>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for query enhancement: "${query}"`);
        return cached;
      }
    }

    this.logger.log(`Enhancing query: "${query}"`);

    try {
      // Render the enhancement prompt
      const prompt = this.promptTemplate.renderNamed(
        'research:queryEnhancement',
        {
          query,
          timeRange: options.timeRange || 'Last 12 months',
          customerContext: options.customerContext,
          selectedFilters: options.selectedFilters,
        },
      );

      // Get system prompt for customer intelligence
      const systemPrompt = this.promptTemplate.getTemplate(
        'system:customerIntelligence',
      );

      // Call LLM for query enhancement
      const response = await this.promptWithTimeout(prompt, systemPrompt, {
        rateLimitKey: 'llm:query-enhance',
      });

      // Parse the response
      const enhanced = this.parseEnhancementResponse(response, query);

      // Cache the result
      if (!options.skipCache) {
        const cacheKey = this.buildCacheKey(query, options);
        await this.cache.set(cacheKey, enhanced, this.cacheTtl);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Query enhanced in ${duration}ms: ${enhanced.enhancedQueries.length} queries generated`,
      );

      return enhanced;
    } catch (error) {
      this.logger.error(`Query enhancement failed: ${error.message}`);
      // Return a basic enhancement as fallback
      return this.createBasicEnhancement(query);
    }
  }

  /**
   * Quick synonym expansion without full LLM call
   * Uses common customer intelligence domain synonyms
   */
  expandWithSynonyms(query: string): string[] {
    const synonymMap: Record<string, string[]> = {
      complaint: [
        'complaint',
        'issue',
        'problem',
        'concern',
        'frustration',
        'unhappy',
        'dissatisfied',
      ],
      happy: ['happy', 'satisfied', 'pleased', 'delighted', 'positive'],
      angry: ['angry', 'frustrated', 'upset', 'furious', 'irate', 'annoyed'],
      delay: ['delay', 'late', 'slow', 'waiting', 'pending', 'overdue'],
      fee: ['fee', 'charge', 'cost', 'price', 'payment'],
      cancel: ['cancel', 'close', 'terminate', 'end', 'stop'],
      transfer: ['transfer', 'move', 'switch', 'migrate'],
      support: ['support', 'help', 'assistance', 'service'],
      bug: ['bug', 'error', 'glitch', 'issue', 'problem', 'broken'],
      app: ['app', 'application', 'mobile', 'online', 'digital'],
      mortgage: ['mortgage', 'home loan', 'property loan'],
      savings: ['savings', 'deposit', 'saving account'],
      investment: ['investment', 'portfolio', 'trading', 'stocks', 'shares'],
    };

    const words = query.toLowerCase().split(/\s+/);
    const expansions: Set<string> = new Set([query]);

    for (const word of words) {
      if (synonymMap[word]) {
        // Create variations with synonyms
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const synonym of synonymMap[word]) {
          if (synonym !== word) {
            expansions.add(query.replace(new RegExp(escaped, 'gi'), synonym));
          }
        }
      }
    }

    return Array.from(expansions);
  }

  /**
   * Decompose a complex question into simpler sub-questions
   */
  async decompose(question: string): Promise<string[]> {
    // Simple heuristic decomposition for common patterns
    const subQuestions: string[] = [];

    // Check for "and" or "or" conjunctions
    if (/\band\b/i.test(question)) {
      const parts = question.split(/\band\b/i).map((p) => p.trim());
      if (parts.length > 1 && parts.every((p) => p.length > 10)) {
        subQuestions.push(...parts);
      }
    }

    // Check for comparison questions
    if (/compare|versus|vs|difference between/i.test(question)) {
      subQuestions.push(
        question.replace(/compare|versus|vs|difference between/gi, '').trim() +
          ' - first aspect',
        question.replace(/compare|versus|vs|difference between/gi, '').trim() +
          ' - second aspect',
      );
    }

    // Check for "why" questions that might need multiple angles
    if (/^why/i.test(question)) {
      subQuestions.push(
        question.replace(/^why/i, 'What is the trend in'),
        question.replace(/^why/i, 'What events preceded'),
        question.replace(/^why/i, 'What patterns show'),
      );
    }

    return subQuestions.length > 0 ? subQuestions : [question];
  }

  /**
   * Build cache key for query enhancement using SHA256 hash
   * Includes query and relevant options for cache isolation
   */
  private buildCacheKey(
    query: string,
    options: QueryEnhancementOptions,
  ): string {
    const hashInput = JSON.stringify({
      query: query.toLowerCase().trim(),
      timeRange: options.timeRange,
      customerContext: options.customerContext,
      selectedFilters: options.selectedFilters,
    });
    const hash = createHash('sha256').update(hashInput).digest('hex');
    return `${this.cachePrefix}${hash.substring(0, 32)}`;
  }

  /**
   * Parse LLM response into EnhancedQuery
   */
  private parseEnhancementResponse(
    response: string,
    originalQuery: string,
  ): EnhancedQuery {
    try {
      // Use brace-matching to handle preamble/postamble from LLM
      const braceStart = response.indexOf('{');
      const jsonStr =
        braceStart >= 0 ? this.extractJsonObject(response, braceStart) : null;
      const parsed = jsonStr ? JSON.parse(jsonStr) : JSON.parse(response);

      return {
        originalIntent: parsed.originalIntent || originalQuery,
        enhancedQueries: parsed.enhancedQueries || [
          { query: originalQuery, purpose: 'Original query', weight: 1.0 },
        ],
        suggestedFilters: parsed.suggestedFilters || {},
        keyTerms: parsed.keyTerms || [],
        synonymExpansion: parsed.synonymExpansion || {},
        subQuestions: parsed.subQuestions || [],
        analysisHints: parsed.analysisHints || [],
      };
    } catch {
      // If parsing fails, return basic enhancement
      this.logger.warn('Failed to parse enhancement response, using fallback');
      return this.createBasicEnhancement(originalQuery);
    }
  }

  /**
   * Create a basic enhancement when LLM call fails
   */
  private createBasicEnhancement(query: string): EnhancedQuery {
    const expandedQueries = this.expandWithSynonyms(query);

    return {
      originalIntent: query,
      enhancedQueries: expandedQueries.map((q, i) => ({
        query: q,
        purpose: i === 0 ? 'Original query' : 'Synonym expansion',
        weight: i === 0 ? 1.0 : 0.7,
      })),
      suggestedFilters: {},
      keyTerms: query.split(/\s+/).filter((w) => w.length > 3),
      synonymExpansion: {},
      subQuestions: [],
      analysisHints: [],
    };
  }

  /**
   * Wrap LLM prompt call with a timeout to prevent indefinite hangs
   */
  private promptWithTimeout(
    prompt: string,
    systemPrompt?: string,
    options?: { rateLimitKey?: string },
  ): Promise<string> {
    return this.llmClient.promptWithTimeout(prompt, systemPrompt, options);
  }

  /**
   * Extract a JSON object from a string using brace-matching
   */
  private extractJsonObject(text: string, startIndex: number): string | null {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
    return null;
  }
}

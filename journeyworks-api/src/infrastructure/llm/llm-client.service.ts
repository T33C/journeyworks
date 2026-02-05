/**
 * LLM Client Service
 *
 * Unified LLM client with Anthropic (primary) and OpenAI (fallback).
 * Includes rate limiting integration and automatic fallback on errors.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicService } from './anthropic.service';
import { OpenAIService } from './openai.service';
import { RedisRateLimiterService } from '../redis';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmCompletionWithToolsRequest,
  LlmCompletionWithToolsResponse,
  LlmMessage,
} from './llm.types';

export interface LlmClientOptions {
  preferredProvider?: 'anthropic' | 'openai';
  enableFallback?: boolean;
  rateLimitKey?: string;
  skipRateLimit?: boolean;
  /** Maximum retry attempts for rate limit errors */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  baseDelayMs?: number;
}

/** Error type for rate limit exceeded */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Error type for LLM provider errors */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

/** Default retry configuration */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly primaryProvider: 'anthropic' | 'openai';
  private readonly fallbackEnabled: boolean;
  private readonly rateLimitRequests: number;
  private readonly rateLimitWindowMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly anthropic: AnthropicService,
    private readonly openai: OpenAIService,
    private readonly rateLimiter: RedisRateLimiterService,
  ) {
    this.primaryProvider =
      this.configService.get<'anthropic' | 'openai'>('llm.primaryProvider') ||
      'anthropic';
    this.fallbackEnabled =
      this.configService.get<boolean>('llm.fallbackEnabled') ?? true;
    this.rateLimitRequests =
      this.configService.get<number>('llm.rateLimitRequests') || 100;
    this.rateLimitWindowMs =
      this.configService.get<number>('llm.rateLimitWindowMs') || 60000;
    this.maxRetries =
      this.configService.get<number>('llm.maxRetries') || DEFAULT_MAX_RETRIES;
    this.baseDelayMs =
      this.configService.get<number>('llm.baseDelayMs') ||
      DEFAULT_BASE_DELAY_MS;

    this.logger.log(
      `LLM Client initialized with primary provider: ${this.primaryProvider}`,
    );
    this.logger.log(`Fallback enabled: ${this.fallbackEnabled}`);
  }

  /**
   * Get availability status of providers
   */
  getProviderStatus(): { anthropic: boolean; openai: boolean } {
    return {
      anthropic: this.anthropic.isAvailable(),
      openai: this.openai.isAvailable(),
    };
  }

  /**
   * Complete a message using the configured providers with fallback
   */
  async complete(
    request: LlmCompletionRequest,
    options: LlmClientOptions = {},
  ): Promise<LlmCompletionResponse> {
    const {
      preferredProvider = this.primaryProvider,
      enableFallback = this.fallbackEnabled,
      rateLimitKey = 'llm:global',
      skipRateLimit = false,
      maxRetries = this.maxRetries,
      baseDelayMs = this.baseDelayMs,
    } = options;

    // Check rate limit
    if (!skipRateLimit) {
      const result = await this.rateLimiter.checkLimit(rateLimitKey, {
        maxRequests: this.rateLimitRequests,
        windowMs: this.rateLimitWindowMs,
      });

      if (!result.allowed) {
        throw new RateLimitError(
          'Rate limit exceeded for LLM requests',
          result.retryAfterMs,
        );
      }
    }

    const primaryService =
      preferredProvider === 'anthropic' ? this.anthropic : this.openai;
    const fallbackService =
      preferredProvider === 'anthropic' ? this.openai : this.anthropic;

    // Try primary provider with retry
    if (primaryService.isAvailable()) {
      try {
        return await this.executeWithRetry(
          () => primaryService.complete(request),
          preferredProvider,
          maxRetries,
          baseDelayMs,
        );
      } catch (error) {
        this.logger.warn(
          `Primary provider (${preferredProvider}) failed: ${error.message}`,
        );

        if (!enableFallback) {
          throw error;
        }
      }
    }

    // Try fallback provider with retry
    if (enableFallback && fallbackService.isAvailable()) {
      const fallbackProviderName =
        preferredProvider === 'anthropic' ? 'openai' : 'anthropic';
      this.logger.log(`Attempting fallback to ${fallbackProviderName}`);

      try {
        return await this.executeWithRetry(
          () => fallbackService.complete(request),
          fallbackProviderName,
          maxRetries,
          baseDelayMs,
        );
      } catch (error) {
        this.logger.error(
          `Fallback provider (${fallbackProviderName}) also failed: ${error.message}`,
        );
        throw new LlmProviderError(
          `All providers failed: ${error.message}`,
          fallbackProviderName,
          false,
        );
      }
    }

    throw new LlmProviderError('No LLM providers available', 'none', false);
  }

  /**
   * Complete with tool use support
   */
  async completeWithTools(
    request: LlmCompletionWithToolsRequest,
    options: LlmClientOptions = {},
  ): Promise<LlmCompletionWithToolsResponse> {
    const {
      preferredProvider = this.primaryProvider,
      enableFallback = this.fallbackEnabled,
      rateLimitKey = 'llm:global',
      skipRateLimit = false,
      maxRetries = this.maxRetries,
      baseDelayMs = this.baseDelayMs,
    } = options;

    // Check rate limit
    if (!skipRateLimit) {
      const result = await this.rateLimiter.checkLimit(rateLimitKey, {
        maxRequests: this.rateLimitRequests,
        windowMs: this.rateLimitWindowMs,
      });

      if (!result.allowed) {
        throw new RateLimitError(
          'Rate limit exceeded for LLM requests',
          result.retryAfterMs,
        );
      }
    }

    const primaryService =
      preferredProvider === 'anthropic' ? this.anthropic : this.openai;
    const fallbackService =
      preferredProvider === 'anthropic' ? this.openai : this.anthropic;

    // Try primary provider with retry
    if (primaryService.isAvailable()) {
      try {
        return await this.executeWithRetry(
          () => primaryService.completeWithTools(request),
          preferredProvider,
          maxRetries,
          baseDelayMs,
        );
      } catch (error) {
        this.logger.warn(
          `Primary provider (${preferredProvider}) failed: ${error.message}`,
        );

        if (!enableFallback) {
          throw error;
        }
      }
    }

    // Try fallback provider with retry
    if (enableFallback && fallbackService.isAvailable()) {
      const fallbackProviderName =
        preferredProvider === 'anthropic' ? 'openai' : 'anthropic';
      this.logger.log(`Attempting fallback to ${fallbackProviderName}`);

      try {
        return await this.executeWithRetry(
          () => fallbackService.completeWithTools(request),
          fallbackProviderName,
          maxRetries,
          baseDelayMs,
        );
      } catch (error) {
        this.logger.error(
          `Fallback provider (${fallbackProviderName}) also failed: ${error.message}`,
        );
        throw new LlmProviderError(
          `All providers failed: ${error.message}`,
          fallbackProviderName,
          false,
        );
      }
    }

    throw new LlmProviderError('No LLM providers available', 'none', false);
  }

  /**
   * Stream a completion (uses primary provider only, no fallback during stream)
   */
  async *stream(
    request: LlmCompletionRequest,
    options: LlmClientOptions = {},
  ): AsyncGenerator<string> {
    const {
      preferredProvider = this.primaryProvider,
      rateLimitKey = 'llm:global',
      skipRateLimit = false,
    } = options;

    // Check rate limit
    if (!skipRateLimit) {
      const result = await this.rateLimiter.checkLimit(rateLimitKey, {
        maxRequests: this.rateLimitRequests,
        windowMs: this.rateLimitWindowMs,
      });

      if (!result.allowed) {
        throw new Error('Rate limit exceeded for LLM requests');
      }
    }

    const primaryService =
      preferredProvider === 'anthropic' ? this.anthropic : this.openai;
    const fallbackService =
      preferredProvider === 'anthropic' ? this.openai : this.anthropic;

    if (primaryService.isAvailable()) {
      yield* primaryService.stream(request);
      return;
    }

    if (fallbackService.isAvailable()) {
      yield* fallbackService.stream(request);
      return;
    }

    throw new Error('No LLM providers available for streaming');
  }

  /**
   * Convenience method for simple prompt completion
   */
  async prompt(
    userMessage: string,
    systemPrompt?: string,
    options: LlmClientOptions = {},
  ): Promise<string> {
    const messages: LlmMessage[] = [{ role: 'user', content: userMessage }];

    const response = await this.complete({ messages, systemPrompt }, options);

    return response.content;
  }

  /**
   * Convenience method for chat completion with history
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    options: LlmClientOptions = {},
  ): Promise<LlmCompletionResponse> {
    const llmMessages: LlmMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return this.complete({ messages: llmMessages, systemPrompt }, options);
  }

  /**
   * Get estimated token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Execute a function with exponential backoff retry for rate limits
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    provider: string,
    maxRetries: number,
    baseDelayMs: number,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable (rate limit or temporary)
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === maxRetries;

        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * baseDelayMs;
        const delay = Math.min(exponentialDelay + jitter, MAX_DELAY_MS);

        // Check for Retry-After header
        const retryAfter = this.extractRetryAfter(error);
        const effectiveDelay = retryAfter ? Math.max(delay, retryAfter) : delay;

        this.logger.warn(
          `Retryable error from ${provider}, attempt ${attempt + 1}/${maxRetries + 1}. ` +
            `Waiting ${Math.round(effectiveDelay)}ms before retry. Error: ${error.message}`,
        );

        await this.sleep(effectiveDelay);
      }
    }

    throw lastError || new Error('Unknown error during retry');
  }

  /**
   * Check if an error is retryable (rate limit, timeout, temporary failure)
   */
  private isRetryableError(error: any): boolean {
    // Rate limit errors (HTTP 429)
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }

    // Server errors (5xx) are often temporary
    if (error.status >= 500 || error.statusCode >= 500) {
      return true;
    }

    // Check error message for common retryable patterns
    const message = error.message?.toLowerCase() || '';
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      'overloaded',
      'timeout',
      'temporarily unavailable',
      'service unavailable',
      'connection',
      'econnreset',
      'etimedout',
    ];

    return retryablePatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Extract Retry-After value from error (in milliseconds)
   */
  private extractRetryAfter(error: any): number | undefined {
    // Check for Retry-After header in various formats
    const retryAfter =
      error.headers?.['retry-after'] ||
      error.response?.headers?.['retry-after'] ||
      error.retryAfter;

    if (!retryAfter) {
      return undefined;
    }

    // Parse as seconds if numeric, otherwise as date
    const parsed = parseInt(retryAfter, 10);
    if (!isNaN(parsed)) {
      return parsed * 1000; // Convert seconds to milliseconds
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return undefined;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

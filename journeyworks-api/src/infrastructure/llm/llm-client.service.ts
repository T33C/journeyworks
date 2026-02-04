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
}

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly primaryProvider: 'anthropic' | 'openai';
  private readonly fallbackEnabled: boolean;
  private readonly rateLimitRequests: number;
  private readonly rateLimitWindowMs: number;

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

    // Try primary provider
    if (primaryService.isAvailable()) {
      try {
        return await primaryService.complete(request);
      } catch (error) {
        this.logger.warn(
          `Primary provider (${preferredProvider}) failed: ${error.message}`,
        );

        if (!enableFallback) {
          throw error;
        }
      }
    }

    // Try fallback provider
    if (enableFallback && fallbackService.isAvailable()) {
      const fallbackProviderName =
        preferredProvider === 'anthropic' ? 'openai' : 'anthropic';
      this.logger.log(`Attempting fallback to ${fallbackProviderName}`);

      try {
        return await fallbackService.complete(request);
      } catch (error) {
        this.logger.error(
          `Fallback provider (${fallbackProviderName}) also failed: ${error.message}`,
        );
        throw error;
      }
    }

    throw new Error('No LLM providers available');
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

    // Try primary provider
    if (primaryService.isAvailable()) {
      try {
        return await primaryService.completeWithTools(request);
      } catch (error) {
        this.logger.warn(
          `Primary provider (${preferredProvider}) failed: ${error.message}`,
        );

        if (!enableFallback) {
          throw error;
        }
      }
    }

    // Try fallback provider
    if (enableFallback && fallbackService.isAvailable()) {
      const fallbackProviderName =
        preferredProvider === 'anthropic' ? 'openai' : 'anthropic';
      this.logger.log(`Attempting fallback to ${fallbackProviderName}`);

      try {
        return await fallbackService.completeWithTools(request);
      } catch (error) {
        this.logger.error(
          `Fallback provider (${fallbackProviderName}) also failed: ${error.message}`,
        );
        throw error;
      }
    }

    throw new Error('No LLM providers available');
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
}

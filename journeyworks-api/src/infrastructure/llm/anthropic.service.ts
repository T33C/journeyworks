/**
 * Anthropic Claude Service
 *
 * Implementation of LLM provider using Anthropic's Claude API.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  LlmMessage,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmCompletionWithToolsRequest,
  LlmCompletionWithToolsResponse,
  LlmToolDefinition,
  LlmToolCall,
} from './llm.types';

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.anthropic.apiKey');
    this.model =
      this.configService.get<string>('llm.anthropic.model') ||
      'claude-sonnet-4-20250514';
    this.maxTokens = this.configService.get<number>('llm.maxTokens') || 4096;
    this.temperature = this.configService.get<number>('llm.temperature') || 0.1;

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(`Anthropic client initialized with model: ${this.model}`);
    } else {
      this.logger.warn('Anthropic API key not configured');
    }
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Complete a message
   * Supports prompt caching when systemBlocks with cacheControl are provided
   */
  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const startTime = Date.now();

    // Build system content - prefer systemBlocks for caching support
    let systemContent: string | Anthropic.Messages.TextBlockParam[] | undefined;

    if (request.systemBlocks && request.systemBlocks.length > 0) {
      // Use content blocks with cache control for prompt caching
      systemContent = request.systemBlocks.map((block) => ({
        type: 'text' as const,
        text: block.text,
        ...(block.cacheControl && { cache_control: block.cacheControl }),
      }));
    } else {
      // Fall back to plain string system prompt
      systemContent =
        request.systemPrompt ||
        request.messages.find((m) => m.role === 'system')?.content;
    }

    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      // Use model override if provided, otherwise use default
      const modelToUse = request.model || this.model;

      const response = await this.client.messages.create({
        model: modelToUse,
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature ?? this.temperature,
        system: systemContent,
        messages,
        stop_sequences: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      // Extract cache usage if available
      const usage = response.usage as any; // SDK types may not include cache fields yet

      return {
        content: textContent,
        model: response.model,
        provider: 'anthropic',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
          cacheCreationInputTokens: usage.cache_creation_input_tokens,
          cacheReadInputTokens: usage.cache_read_input_tokens,
        },
        stopReason: response.stop_reason || 'end_turn',
        latencyMs,
      };
    } catch (error) {
      this.logger.error(`Anthropic API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete with tool use support
   */
  async completeWithTools(
    request: LlmCompletionWithToolsRequest,
  ): Promise<LlmCompletionWithToolsResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const startTime = Date.now();

    // Convert messages
    const systemPrompt =
      request.systemPrompt ||
      request.messages.find((m) => m.role === 'system')?.content;

    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Convert tools to Anthropic format
    const tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: (tool.inputSchema as any)?.properties || {},
        required: (tool.inputSchema as any)?.required || [],
      },
    }));

    // Convert tool choice
    const toolChoice = request.toolChoice
      ? this.convertToolChoice(request.toolChoice)
      : undefined;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature ?? this.temperature,
        system: systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? toolChoice : undefined,
      });

      const latencyMs = Date.now() - startTime;

      // Extract text and tool use content
      let textContent = '';
      const toolCalls: LlmToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content: textContent,
        model: response.model,
        provider: 'anthropic',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
        stopReason: response.stop_reason || 'end_turn',
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      this.logger.error(`Anthropic API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream a completion (returns async generator)
   */
  async *stream(request: LlmCompletionRequest): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const systemPrompt =
      request.systemPrompt ||
      request.messages.find((m) => m.role === 'system')?.content;

    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens || this.maxTokens,
      temperature: request.temperature ?? this.temperature,
      system: systemPrompt,
      messages,
      stop_sequences: request.stopSequences,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield delta.text;
        }
      }
    }
  }

  /**
   * Convert tool choice to Anthropic format
   */
  private convertToolChoice(
    choice?: 'auto' | 'any' | 'none' | { name: string },
  ):
    | { type: 'auto' }
    | { type: 'any' }
    | { type: 'tool'; name: string }
    | undefined {
    if (!choice) return { type: 'auto' };

    if (typeof choice === 'string') {
      if (choice === 'none') return undefined;
      if (choice === 'auto') return { type: 'auto' };
      if (choice === 'any') return { type: 'any' };
      return { type: 'auto' };
    }

    return { type: 'tool', name: choice.name };
  }
}

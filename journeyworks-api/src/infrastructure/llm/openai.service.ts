/**
 * OpenAI Service
 *
 * Implementation of LLM provider using OpenAI's API (fallback).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  LlmMessage,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmCompletionWithToolsRequest,
  LlmCompletionWithToolsResponse,
  LlmToolCall,
} from './llm.types';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.openai.apiKey');
    this.model = this.configService.get<string>('llm.openai.model') || 'gpt-4o';
    this.maxTokens = this.configService.get<number>('llm.maxTokens') || 4096;
    this.temperature = this.configService.get<number>('llm.temperature') || 0.1;

    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.logger.log(`OpenAI client initialized with model: ${this.model}`);
    } else {
      this.logger.warn('OpenAI API key not configured');
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
   */
  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const startTime = Date.now();

    // Convert messages to OpenAI format
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    // Add conversation messages
    for (const msg of request.messages) {
      if (msg.role === 'system' && !request.systemPrompt) {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature ?? this.temperature,
        messages,
        stop: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        model: response.model,
        provider: 'openai',
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        stopReason: choice.finish_reason || 'stop',
        latencyMs,
      };
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`);
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
      throw new Error('OpenAI client not initialized');
    }

    const startTime = Date.now();

    // Convert messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      if (msg.role === 'system' && !request.systemPrompt) {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Convert tools to OpenAI format
    const tools: OpenAI.ChatCompletionTool[] = request.tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: (tool.inputSchema || {}) as Record<string, unknown>,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature ?? this.temperature,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice:
          tools.length > 0
            ? this.convertToolChoice(request.toolChoice)
            : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      // Extract tool calls
      const toolCalls: LlmToolCall[] = [];
      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      return {
        content: choice.message.content || '',
        model: response.model,
        provider: 'openai',
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        stopReason: choice.finish_reason || 'stop',
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream a completion (returns async generator)
   */
  async *stream(request: LlmCompletionRequest): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      if (msg.role === 'system' && !request.systemPrompt) {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens || this.maxTokens,
      temperature: request.temperature ?? this.temperature,
      messages,
      stop: request.stopSequences,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  /**
   * Convert tool choice to OpenAI format
   */
  private convertToolChoice(
    choice?: 'auto' | 'any' | 'none' | { name: string },
  ): OpenAI.ChatCompletionToolChoiceOption | undefined {
    if (!choice) return 'auto';

    if (typeof choice === 'string') {
      if (choice === 'any') return 'required';
      return choice as 'auto' | 'none';
    }

    return { type: 'function', function: { name: choice.name } };
  }
}

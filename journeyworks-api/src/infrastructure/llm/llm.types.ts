/**
 * LLM Types and Interfaces
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Content block with optional cache control for prompt caching
 */
export interface LlmContentBlock {
  type: 'text';
  text: string;
  cacheControl?: {
    type: 'ephemeral';
  };
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  /**
   * Override the default model. Useful for using cheaper models for simple tasks.
   * e.g., 'claude-3-haiku-20240307' for contextual chunking
   */
  model?: string;
  /**
   * System prompt content blocks with cache control for prompt caching.
   * If provided, takes precedence over systemPrompt for Anthropic.
   */
  systemBlocks?: LlmContentBlock[];
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  provider: 'anthropic' | 'openai';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  stopReason: string;
  latencyMs: number;
}

export interface LlmStreamChunk {
  content: string;
  isComplete: boolean;
  stopReason?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface LlmCompletionWithToolsRequest extends LlmCompletionRequest {
  tools: LlmToolDefinition[];
  toolChoice?: 'auto' | 'any' | 'none' | { name: string };
}

export interface LlmCompletionWithToolsResponse extends LlmCompletionResponse {
  toolCalls?: LlmToolCall[];
}

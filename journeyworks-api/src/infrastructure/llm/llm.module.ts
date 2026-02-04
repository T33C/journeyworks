/**
 * LLM Module
 *
 * Provides unified LLM client with Anthropic (primary) and OpenAI (fallback).
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmClientService } from './llm-client.service';
import { AnthropicService } from './anthropic.service';
import { OpenAIService } from './openai.service';
import { PromptTemplateService } from './prompt-template.service';
import { RedisModule } from '../redis';

@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    LlmClientService,
    AnthropicService,
    OpenAIService,
    PromptTemplateService,
  ],
  exports: [LlmClientService, PromptTemplateService],
})
export class LlmModule {}

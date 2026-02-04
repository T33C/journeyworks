/**
 * Prompt Template Service
 *
 * Manages prompt templates for various LLM use cases.
 * Supports variable interpolation and template composition.
 *
 * Prompts are now organized in the ./prompts folder:
 * - system/    - LLM personas and behavioral guidelines
 * - analysis/  - Customer communication analysis
 * - rag/       - Retrieval-Augmented Generation
 * - rrg/       - Natural Language to DSL translation
 * - agent/     - Agentic AI workflows
 * - research/  - Deep customer intelligence analysis
 *
 * @see ./prompts/README.md for full documentation
 */

import { Injectable } from '@nestjs/common';

// System prompts
import {
  SYSTEM_ANALYST_PROMPT,
  SYSTEM_RESEARCHER_PROMPT,
  SYSTEM_RRG_PROMPT,
  SYSTEM_CUSTOMER_INTELLIGENCE_PROMPT,
} from './prompts/system';

// Analysis prompts
import {
  SENTIMENT_ANALYSIS_PROMPT,
  INTENT_ANALYSIS_PROMPT,
  ENTITY_EXTRACTION_PROMPT,
  SUMMARY_PROMPT,
  COMPREHENSIVE_ANALYSIS_PROMPT,
} from './prompts/analysis';

// RAG prompts
import {
  RAG_QUERY_PROMPT,
  RAG_ANSWER_PROMPT,
  CONTEXTUAL_EMBEDDING_PROMPT,
} from './prompts/rag';

// RRG prompts
import { NL_TO_DSL_PROMPT, DSL_REFINEMENT_PROMPT } from './prompts/rrg';

// Agent prompts
import { REACT_AGENT_PROMPT, RESEARCH_AGENT_PROMPT } from './prompts/agent';

// Research prompts
import {
  QUERY_ENHANCEMENT_PROMPT,
  RESEARCH_RESPONSE_PROMPT,
  INSIGHT_CARD_PROMPT,
  TREND_ANALYSIS_PROMPT,
  CUSTOMER_HEALTH_PROMPT,
  COMPARATIVE_ANALYSIS_PROMPT,
} from './prompts/research';

export interface PromptVariables {
  [key: string]: string | number | boolean | object | undefined;
}

@Injectable()
export class PromptTemplateService {
  private readonly templates: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Register a named template
   */
  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): string | undefined {
    return this.templates.get(name);
  }

  /**
   * Render a template with variables
   */
  render(template: string, variables: PromptVariables = {}): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      const stringValue =
        typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value ?? '');
      result = result.replace(placeholder, stringValue);
    }

    // Remove any remaining placeholders
    result = result.replace(/\{\{\s*\w+\s*\}\}/g, '');

    return result.trim();
  }

  /**
   * Render a named template
   */
  renderNamed(templateName: string, variables: PromptVariables = {}): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return this.render(template, variables);
  }

  /**
   * Register default templates for the application
   * Templates are imported from the ./prompts folder
   */
  private registerDefaultTemplates(): void {
    // System prompts
    this.registerTemplate('system:analyst', SYSTEM_ANALYST_PROMPT);
    this.registerTemplate('system:researcher', SYSTEM_RESEARCHER_PROMPT);
    this.registerTemplate('system:rrg', SYSTEM_RRG_PROMPT);
    this.registerTemplate(
      'system:customerIntelligence',
      SYSTEM_CUSTOMER_INTELLIGENCE_PROMPT,
    );

    // Analysis prompts
    this.registerTemplate('analysis:sentiment', SENTIMENT_ANALYSIS_PROMPT);
    this.registerTemplate('analysis:intent', INTENT_ANALYSIS_PROMPT);
    this.registerTemplate('analysis:entity', ENTITY_EXTRACTION_PROMPT);
    this.registerTemplate('analysis:summary', SUMMARY_PROMPT);
    this.registerTemplate(
      'analysis:comprehensive',
      COMPREHENSIVE_ANALYSIS_PROMPT,
    );

    // RAG prompts
    this.registerTemplate('rag:query', RAG_QUERY_PROMPT);
    this.registerTemplate('rag:answer', RAG_ANSWER_PROMPT);
    this.registerTemplate('rag:contextual', CONTEXTUAL_EMBEDDING_PROMPT);

    // RRG prompts
    this.registerTemplate('rrg:nl_to_dsl', NL_TO_DSL_PROMPT);
    this.registerTemplate('rrg:dsl_refinement', DSL_REFINEMENT_PROMPT);

    // Agent prompts
    this.registerTemplate('agent:react', REACT_AGENT_PROMPT);
    this.registerTemplate('agent:research', RESEARCH_AGENT_PROMPT);

    // Customer Intelligence Research prompts
    this.registerTemplate(
      'research:queryEnhancement',
      QUERY_ENHANCEMENT_PROMPT,
    );
    this.registerTemplate('research:response', RESEARCH_RESPONSE_PROMPT);
    this.registerTemplate('research:insightCard', INSIGHT_CARD_PROMPT);
    this.registerTemplate('research:trend', TREND_ANALYSIS_PROMPT);
    this.registerTemplate('research:customerHealth', CUSTOMER_HEALTH_PROMPT);
    this.registerTemplate('research:comparative', COMPARATIVE_ANALYSIS_PROMPT);
  }
}

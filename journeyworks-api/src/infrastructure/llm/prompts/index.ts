/**
 * Prompts Master Barrel Export
 *
 * @description
 * Central export point for all LLM prompts in the JourneyWorks system.
 *
 * @example
 * ```typescript
 * import {
 *   ANALYST_SYSTEM_PROMPT,
 *   SENTIMENT_ANALYSIS_PROMPT,
 *   RAG_QUERY_PROMPT,
 *   CUSTOMER_HEALTH_PROMPT
 * } from './prompts';
 * ```
 *
 * @see README.md for full documentation
 */

// System Prompts - LLM personas and behavioral guidelines
export * from './system';

// Analysis Prompts - Customer communication analysis
export * from './analysis';

// RAG Prompts - Retrieval-Augmented Generation
export * from './rag';

// RRG Prompts - Retrieval-Reranking-Generation (NL to DSL)
export * from './rrg';

// Agent Prompts - Agentic AI workflows
export * from './agent';

// Research Prompts - Deep customer intelligence analysis
export * from './research';

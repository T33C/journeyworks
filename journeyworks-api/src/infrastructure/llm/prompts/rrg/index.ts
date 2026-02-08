/**
 * RRG Prompts Barrel Export
 *
 * @description
 * Exports all Retrieval-Reranking-Generation prompts.
 * These prompts power the natural language to Elasticsearch DSL translation.
 *
 * @category rrg
 */

export { NL_TO_DSL_PROMPT } from './nl-to-dsl.prompt';
export { DSL_REFINEMENT_PROMPT } from './dsl-refinement.prompt';

// Glossary exports
export {
  SENTIMENT_MAPPINGS,
  CHANNEL_MAPPINGS,
  PRIORITY_MAPPINGS,
  INTENT_MAPPINGS,
  DOMAIN_SYNONYMS,
  FIELD_MAPPINGS,
  formatGlossaryForPrompt,
  formatCompactGlossary,
  getSynonyms,
  mapSentiment,
  mapChannel,
  mapPriority,
} from './glossary';

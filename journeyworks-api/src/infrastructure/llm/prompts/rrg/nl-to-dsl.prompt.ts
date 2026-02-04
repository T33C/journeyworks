/**
 * RRG Prompt: Natural Language to DSL Translation
 *
 * @description
 * Translates natural language queries into Elasticsearch DSL.
 * Core prompt for the Retrieval Reranking Generation pipeline.
 *
 * @rationale
 * The RRG (Retrieval-Reranking-Generation) pattern requires precise
 * translation of user intent into structured queries. This prompt is
 * the foundation of the entire search experience.
 *
 * **Why LLM-based Query Translation**
 *
 * 1. **Natural Language Understanding**
 *    - Users don't think in Boolean logic
 *    - "Angry customers about fees last month" → complex DSL
 *    - Intent extraction enables smart filtering
 *
 * 2. **Domain Knowledge Application**
 *    - LLM knows financial services terminology
 *    - Maps user language to index fields
 *    - Handles synonyms automatically
 *
 * 3. **Query Optimization**
 *    - Generates efficient Elasticsearch queries
 *    - Uses appropriate query types (match, term, range)
 *    - Applies boosting for relevance
 *
 * **Translation Strategy**
 *
 * The prompt provides:
 * - Index schema with field descriptions
 * - Example queries with expected DSL
 * - Rules for query construction
 * - Fallback patterns for ambiguous input
 *
 * **Schema Awareness**
 *
 * The prompt includes the full index schema so the LLM can:
 * - Map user terms to correct fields
 * - Apply appropriate query types per field
 * - Handle nested objects correctly
 *
 * @variables
 * - query: Natural language search query
 * - schema: Elasticsearch index mapping
 * - glossary: Domain terminology mappings (from glossary.ts)
 * - examples: Few-shot examples of NL → DSL
 *
 * @output Valid Elasticsearch DSL query
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const NL_TO_DSL_PROMPT = `You are an expert at translating natural language queries into Elasticsearch DSL.

Index Schema:
{{schema}}

Domain Glossary:
{{glossary}}

Examples:
{{examples}}

User Query: {{query}}

Generate a valid Elasticsearch DSL query that will retrieve relevant documents.

Rules:
1. Use bool queries for combining multiple conditions
2. Use match queries for text fields with analyzed content
3. Use term queries for exact matches on keyword fields
4. Use range queries for dates and numbers
5. Apply appropriate boosting for important terms
6. Include aggregations if the query asks for statistics or groupings
7. Set reasonable size limits (default 20)

Respond with ONLY the JSON DSL query, no explanation.`;

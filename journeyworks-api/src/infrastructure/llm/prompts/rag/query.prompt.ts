/**
 * RAG Prompt: Query Construction
 *
 * @description
 * Constructs optimized queries for retrieval-augmented generation.
 * Expands user queries with synonyms and related terms to improve recall.
 *
 * @rationale
 * User queries are often short and may not match the exact terminology
 * used in indexed documents. Query expansion is essential for:
 *
 * **Why Query Expansion Matters**
 *
 * 1. **Vocabulary Mismatch**
 *    - Users say "charge" but docs say "fee"
 *    - Users say "cancel" but docs say "terminate"
 *    - Domain jargon vs everyday language
 *
 * 2. **Implicit Context**
 *    - "Why was I charged?" implies complaint
 *    - "How do I..." implies procedural need
 *    - Emotional undertones affect relevance
 *
 * 3. **Query Decomposition**
 *    - Complex questions need multiple sub-queries
 *    - Each sub-query retrieves different context
 *    - Results are synthesized for complete answer
 *
 * **Expansion Strategy**
 *
 * - Synonyms: Direct word alternatives
 * - Related Terms: Conceptually connected words
 * - Domain Terms: Financial services vocabulary
 * - Intent Terms: Action words based on detected intent
 *
 * @variables
 * - query: Original user query
 * - conversationHistory: Previous turns for context
 * - domain: Domain context (e.g., "financial services")
 *
 * @output JSON with expanded query terms and sub-queries
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const RAG_QUERY_PROMPT = `You are a query optimization expert for a customer intelligence system.

Given a user's query, generate an expanded version that will improve retrieval results.

Original Query: {{query}}

Conversation History:
{{conversationHistory}}

Domain: {{domain}}

Generate:
1. An expanded query with synonyms and related terms
2. Key search terms that should definitely be included
3. Any filters that should be applied (date ranges, customer segments, channels)
4. Alternative phrasings of the query

Respond in JSON format:
{
  "expandedQuery": "the enhanced query with additional terms",
  "keyTerms": ["term1", "term2"],
  "suggestedFilters": {
    "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
    "channels": ["email", "call"],
    "sentiment": "negative"
  },
  "alternativeQueries": ["rephrased version 1", "rephrased version 2"],
  "intent": "the detected intent of the query"
}`;

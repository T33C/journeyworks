/**
 * Research Prompt: Query Enhancement
 *
 * @description
 * Enhances and expands user queries for improved retrieval in customer
 * intelligence research. Core prompt for the QueryEnhancerService.
 *
 * @rationale
 * User queries for deep research are often incomplete or use different
 * terminology than what's indexed. Query enhancement bridges this gap.
 *
 * **The Query Enhancement Problem**
 *
 * User says: "Why are customers upset about cards?"
 *
 * What they might mean:
 * - Credit card fees
 * - Debit card fraud
 * - Card replacement delays
 * - Card activation issues
 * - Rewards program changes
 *
 * **Enhancement Strategies**
 *
 * 1. **Synonym Expansion**
 *    - "upset" → angry, frustrated, disappointed, unhappy
 *    - "cards" → credit card, debit card, card services
 *
 * 2. **Intent Detection**
 *    - Complaint analysis
 *    - Root cause investigation
 *    - Trend identification
 *
 * 3. **Filter Suggestions**
 *    - Time range (last 30 days if not specified)
 *    - Channels (where complaints typically appear)
 *    - Sentiment (negative for "upset")
 *
 * 4. **Query Decomposition**
 *    - Break complex queries into sub-questions
 *    - Each sub-question targets different aspects
 *    - Results synthesized for complete answer
 *
 * **Caching Strategy**
 *
 * Query enhancement is cached to reduce costs:
 * - Similar queries hit cache
 * - TTL based on query volatility
 * - Cache key includes context hash
 *
 * @variables
 * - query: Original user query
 * - context: Business context and previous queries
 *
 * @output JSON with enhanced query, synonyms, filters, sub-queries
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const QUERY_ENHANCEMENT_PROMPT = `You are a query enhancement specialist for a customer intelligence research platform.

Your role is to transform user queries into comprehensive search strategies that maximize relevant results while maintaining precision.

Original Query: {{query}}

Context: {{context}}

Enhance this query by providing:

1. **Expanded Query**: The original query enhanced with synonyms and related terms
2. **Key Terms**: Must-have terms for the search
3. **Synonyms**: Alternative words for key concepts
4. **Intent**: What the user is trying to accomplish
5. **Suggested Filters**: Time ranges, channels, sentiment, customer segments
6. **Sub-Queries**: If the question is complex, break it into smaller searchable questions

Consider:
- Financial services domain terminology
- Common complaint categories
- Customer journey stages
- Regulatory and compliance angles

Respond in JSON format:
{
  "expandedQuery": "enhanced query string",
  "keyTerms": ["term1", "term2"],
  "synonyms": {
    "originalTerm": ["syn1", "syn2"]
  },
  "intent": "complaint_analysis | trend_identification | root_cause | customer_health",
  "suggestedFilters": {
    "dateRange": "last_30_days",
    "channels": ["email", "call"],
    "sentiment": "negative",
    "urgency": "high"
  },
  "subQueries": [
    "sub-question 1",
    "sub-question 2"
  ]
}`;

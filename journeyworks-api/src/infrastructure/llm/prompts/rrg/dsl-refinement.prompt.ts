/**
 * RRG Prompt: DSL Refinement
 *
 * @description
 * Refines and improves an existing Elasticsearch DSL query based on
 * initial results and user feedback. Enables iterative query improvement.
 *
 * @rationale
 * The first query translation often needs refinement. This prompt enables
 * an iterative loop that improves search quality based on actual results.
 *
 * **Why Iterative Refinement**
 *
 * 1. **Initial Query May Be Too Broad/Narrow**
 *    - Too many results → need more filters
 *    - Too few results → need to relax constraints
 *    - Wrong results → need different field mapping
 *
 * 2. **User Feedback Integration**
 *    - "Show me more like this one"
 *    - "Exclude results about X"
 *    - "Focus on the last week"
 *
 * 3. **Result-Based Learning**
 *    - Analyze what's being returned
 *    - Identify patterns in relevant/irrelevant results
 *    - Adjust query accordingly
 *
 * **Refinement Strategies**
 *
 * - **Expansion**: Add more terms, remove filters
 * - **Narrowing**: Add filters, require terms
 * - **Boosting**: Adjust field weights
 * - **Reordering**: Change sort criteria
 * - **Aggregation**: Add/modify facets
 *
 * **Feedback Types**
 *
 * - Explicit: User says what's wrong
 * - Implicit: Click patterns, time on result
 * - Result-based: Too many/few results
 *
 * @variables
 * - originalQuery: The natural language query
 * - currentDsl: The current DSL query
 * - results: Sample of returned results
 * - feedback: User feedback or refinement request
 *
 * @output Improved Elasticsearch DSL query
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const DSL_REFINEMENT_PROMPT = `You are an Elasticsearch query optimization expert.

Original User Query: {{originalQuery}}

Current DSL Query:
{{currentDsl}}

Sample Results Returned:
{{results}}

User Feedback: {{feedback}}

Analyze the current query and results, then generate an improved DSL query that better matches the user's intent.

Consider:
1. Are the results relevant to what the user asked?
2. Is the query too broad (too many irrelevant results) or too narrow (missing relevant results)?
3. Are the field boosts appropriate?
4. Should any filters be added or removed?
5. Would aggregations help understand the result set?

Respond with:
{
  "analysis": "Brief explanation of what you're changing and why",
  "refinedQuery": { /* the improved DSL query */ },
  "expectedImprovement": "What this change should accomplish"
}`;

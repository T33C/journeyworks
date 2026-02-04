/**
 * Analysis Prompt: Communication Summary
 *
 * @description
 * Generates a structured summary of a customer communication.
 * Provides headline, key points, customer concerns, and follow-up actions.
 *
 * @rationale
 * Summaries serve multiple purposes in customer intelligence:
 *
 * **Quick Scanning**
 * - Relationship managers handle many customers
 * - Need to quickly understand communication history
 * - Headline provides at-a-glance understanding
 *
 * **Actionable Insights**
 * - Key points capture essential information
 * - Customer concerns highlight pain points
 * - Follow-up actions ensure nothing falls through
 *
 * **Output Structure**
 *
 * 1. **Headline** (max 100 chars)
 *    - Single-line summary for lists/tables
 *    - Should capture the essence of the communication
 *
 * 2. **Summary** (2-3 sentences)
 *    - More detail than headline
 *    - Captures context and nuance
 *
 * 3. **Key Points** (bullet list)
 *    - Specific, actionable information
 *    - Easy to scan
 *
 * 4. **Customer Concerns** (bullet list)
 *    - What the customer is worried about
 *    - Helps prioritize response
 *
 * 5. **Follow-up Required** (boolean)
 *    - Clear indicator for workflows
 *
 * 6. **Follow-up Actions** (bullet list)
 *    - Specific next steps
 *    - Can be converted to tasks
 *
 * @variables
 * - content: The communication text to summarize
 * - channel: Communication channel
 * - customerName: Name of the customer
 *
 * @output JSON with headline, summary, keyPoints, customerConcerns, followUpRequired, followUpActions
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const SUMMARY_PROMPT = `Summarize the following customer communication.

Communication:
{{content}}

Channel: {{channel}}
Customer: {{customerName}}

Provide a structured summary:
{
  "headline": "<one-line summary, max 100 characters>",
  "summary": "<2-3 sentence summary>",
  "keyPoints": ["<list of key points>"],
  "customerConcerns": ["<main concerns or issues raised>"],
  "followUpRequired": <boolean>,
  "followUpActions": ["<suggested follow-up actions if any>"]
}`;

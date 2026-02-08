/**
 * Customer Summary Prompt
 *
 * Used to summarize communications for a specific customer.
 */

export const CUSTOMER_SUMMARY_PROMPT = `Summarize the following customer communications. Identify key themes, sentiment trends, and any issues or concerns raised.

Communications:
{{communications}}

Provide a concise summary (2-3 paragraphs) covering:
1. Overall relationship health and sentiment
2. Key topics and concerns discussed
3. Any action items or follow-ups needed`;

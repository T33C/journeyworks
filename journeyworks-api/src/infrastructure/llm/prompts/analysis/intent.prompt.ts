/**
 * Analysis Prompt: Intent Analysis
 *
 * @description
 * Identifies the primary and secondary intents of a customer communication.
 * Determines urgency level and suggests appropriate follow-up actions.
 *
 * @rationale
 * Understanding customer intent is critical for:
 *
 * **Routing & Prioritization**
 * - Complaints need different handling than inquiries
 * - Escalations require immediate attention
 * - Appreciation can be used for testimonials
 *
 * **Intent Categories**
 * - complaint: Customer expressing dissatisfaction
 * - inquiry: Seeking information
 * - request: Asking for specific action
 * - feedback: Providing unsolicited input
 * - escalation: Seeking higher authority
 * - appreciation: Expressing thanks or satisfaction
 *
 * **Urgency Levels**
 * - low: No time sensitivity
 * - medium: Should be addressed within normal SLAs
 * - high: Requires prompt attention
 * - critical: Immediate action required
 *
 * **Why Secondary Intents?**
 * Communications often have multiple purposes. A customer might:
 * - Complain about a fee AND request a refund
 * - Inquire about a product AND provide feedback
 *
 * @variables
 * - content: The communication text to analyze
 * - channel: Communication channel
 * - context: Previous communication history or relevant context
 *
 * @output JSON with primaryIntent, secondaryIntents, urgency, actionRequired, suggestedActions
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const INTENT_ANALYSIS_PROMPT = `Analyze the intent of the following customer communication.

Communication:
{{content}}

Channel: {{channel}}
Context: {{context}}

Identify the primary and secondary intents. Provide your analysis in JSON format:
{
  "primaryIntent": {
    "category": "<complaint | inquiry | request | feedback | escalation | appreciation>",
    "specific": "<specific intent description>",
    "confidence": <number between 0 and 1>
  },
  "secondaryIntents": [
    {
      "category": "<category>",
      "specific": "<specific intent>",
      "confidence": <number between 0 and 1>
    }
  ],
  "urgency": "low" | "medium" | "high" | "critical",
  "actionRequired": <boolean>,
  "suggestedActions": ["<list of suggested follow-up actions>"]
}`;

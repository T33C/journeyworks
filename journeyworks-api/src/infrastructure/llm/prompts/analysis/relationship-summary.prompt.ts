/**
 * Analysis Prompt: Relationship Summary
 *
 * @description
 * Generates a comprehensive summary of the relationship with a specific
 * customer based on their communication history. Provides an overview
 * of sentiment trajectory, key interactions, and relationship health.
 *
 * @rationale
 * Relationship summaries enable informed customer engagement:
 *
 * **Key Capabilities**
 * - Summarize communication history with a customer
 * - Track sentiment trajectory over time
 * - Highlight key interactions and turning points
 * - Assess overall relationship health
 *
 * **When to Use**
 * - Preparing for customer meetings
 * - Onboarding new relationship managers
 * - Quarterly business reviews
 * - Escalation context gathering
 *
 * @variables
 * - customerName: Name of the customer
 * - communicationCount: Total number of communications
 * - communications: JSON array of communications with date, channel, summary, and sentiment
 *
 * @output Narrative relationship summary with structured insights
 *
 * @version 1.0.0
 * @since 2026-02-09
 */
export const RELATIONSHIP_SUMMARY_PROMPT = `You are summarizing the relationship with a customer based on their communication history.

## Customer
{{customerName}}

## Communication History ({{communicationCount}} communications)
{{communications}}

## Instructions
Based on this communication history, provide a comprehensive relationship summary that includes:
1. **Overview**: Brief summary of the relationship
2. **Sentiment Trajectory**: How sentiment has evolved over time
3. **Key Interactions**: Most significant communications or turning points
4. **Active Issues**: Any unresolved concerns or ongoing matters
5. **Relationship Health**: Overall assessment of the relationship
6. **Recommendations**: Suggested next steps for the relationship manager

Write the summary as a clear, professional narrative that a relationship manager can quickly review before engaging with this customer. Include specific details from the communications where relevant.

After the narrative summary, provide structured data in the following JSON block:
\`\`\`json
{
  "relationshipHealth": "strong" | "stable" | "at-risk" | "critical",
  "healthScore": <number between 0 and 100>,
  "sentimentTrajectory": "improving" | "stable" | "declining",
  "activeIssueCount": <number>,
  "keyThemes": ["<main topics across communications>"],
  "lastInteractionSentiment": "positive" | "negative" | "neutral" | "mixed",
  "recommendations": [
    {
      "action": "<recommended action>",
      "priority": "high" | "medium" | "low",
      "rationale": "<why this is recommended>"
    }
  ]
}
\`\`\``;

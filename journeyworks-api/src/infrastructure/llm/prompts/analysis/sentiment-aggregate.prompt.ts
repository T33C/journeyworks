/**
 * Analysis Prompt: Aggregate Sentiment Analysis
 *
 * @description
 * Analyzes sentiment patterns across multiple customer communications.
 * Unlike the single-communication sentiment prompt, this operates on
 * aggregate sentiment data and sample communications to identify
 * patterns, trends, and actionable insights.
 *
 * @rationale
 * Aggregate sentiment analysis provides a macro-level view:
 *
 * **Key Capabilities**
 * - Interpret sentiment distribution across a corpus
 * - Identify drivers behind negative sentiment spikes
 * - Surface patterns in emotional tone across communications
 * - Provide strategic recommendations based on sentiment trends
 *
 * **When to Use**
 * - Analyzing sentiment across a time period
 * - Understanding overall customer satisfaction levels
 * - Identifying systemic issues driving negative sentiment
 * - Reporting on sentiment trends to stakeholders
 *
 * @variables
 * - sentimentBreakdown: JSON object with sentiment label counts
 * - averageScore: Average sentiment score (-1 to 1)
 * - sampleCommunications: JSON array of sample communications with content, sentiment, and channel
 *
 * @output JSON with patterns, drivers, insights, and recommendations
 *
 * @version 1.0.0
 * @since 2026-02-09
 */
export const SENTIMENT_ANALYSIS_AGGREGATE_PROMPT = `You are analyzing aggregate sentiment data across multiple customer communications.

## Sentiment Distribution
{{sentimentBreakdown}}

## Average Sentiment Score
{{averageScore}} (scale: -1 = very negative, 0 = neutral, +1 = very positive)

## Sample Communications
{{sampleCommunications}}

## Instructions
Analyze the sentiment distribution and sample communications to provide:
1. **Overall Assessment**: What is the general sentiment health?
2. **Key Drivers**: What is driving positive and negative sentiment?
3. **Patterns**: Are there patterns by channel, topic, or communication type?
4. **Concerns**: Any areas requiring immediate attention?
5. **Recommendations**: Actions to improve overall sentiment

Provide your analysis in the following JSON format:
{
  "overallAssessment": "<summary of sentiment health>",
  "dominantSentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentimentHealth": <number between 0 and 100>,
  "drivers": {
    "positive": ["<factors driving positive sentiment>"],
    "negative": ["<factors driving negative sentiment>"]
  },
  "patterns": [
    {
      "pattern": "<identified pattern>",
      "evidence": "<supporting evidence>",
      "significance": "high" | "medium" | "low"
    }
  ],
  "concerns": [
    {
      "issue": "<concern>",
      "severity": "high" | "medium" | "low",
      "recommendation": "<suggested action>"
    }
  ],
  "insights": [
    {
      "title": "<insight title>",
      "description": "<detailed insight>",
      "category": "concern" | "trend" | "opportunity" | "risk",
      "confidence": <number between 0 and 1>
    }
  ]
}`;

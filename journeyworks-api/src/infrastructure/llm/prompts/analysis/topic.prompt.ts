/**
 * Analysis Prompt: Topic Analysis
 *
 * @description
 * Analyzes and clusters topics found across customer communications.
 * Identifies key themes, emerging concerns, and provides actionable insights
 * based on topic frequency and sample content.
 *
 * @rationale
 * Topic analysis helps relationship managers and analysts understand
 * what customers are talking about at scale:
 *
 * **Key Capabilities**
 * - Cluster related topics into broader themes
 * - Identify emerging or trending concerns
 * - Surface root causes behind frequent topics
 * - Provide actionable recommendations per theme
 *
 * **When to Use**
 * - Understanding main customer concerns over a time period
 * - Identifying trending issues before they escalate
 * - Strategic planning based on customer feedback themes
 * - Reporting on communication patterns
 *
 * @variables
 * - topics: JSON array of [topic, count] pairs sorted by frequency
 * - sampleContent: Sample communication texts separated by ---
 *
 * @output JSON with themes, insights, and recommendations
 *
 * @version 1.0.0
 * @since 2026-02-09
 */
export const TOPIC_ANALYSIS_PROMPT = `You are analyzing customer communication topics to identify key themes and concerns.

## Topic Frequencies
The following topics were extracted from customer communications, sorted by frequency (most common first):
{{topics}}

## Sample Communications
Here are sample communications for context:
{{sampleContent}}

## Instructions
Analyze these topics and sample communications to identify:
1. **Key Themes**: Group related topics into broader themes
2. **Emerging Concerns**: Topics that may indicate growing issues
3. **Root Causes**: Underlying reasons behind frequent topics
4. **Recommendations**: Actionable steps to address the identified themes

Provide your analysis in the following JSON format:
{
  "themes": [
    {
      "name": "<theme name>",
      "relatedTopics": ["<topic1>", "<topic2>"],
      "frequency": <total count across related topics>,
      "description": "<brief description of this theme>",
      "severity": "high" | "medium" | "low"
    }
  ],
  "insights": [
    {
      "title": "<insight title>",
      "description": "<detailed insight>",
      "category": "concern" | "trend" | "opportunity" | "risk",
      "confidence": <number between 0 and 1>,
      "evidence": ["<supporting evidence from the data>"]
    }
  ],
  "recommendations": [
    {
      "action": "<recommended action>",
      "priority": "high" | "medium" | "low",
      "rationale": "<why this action is recommended>"
    }
  ],
  "summary": "<overall summary of the topic analysis>"
}`;

/**
 * Research Prompt: Response Formatting
 *
 * @description
 * Formats research findings into structured, actionable responses.
 * Ensures consistency and completeness across all research outputs.
 *
 * @rationale
 * Research responses must be structured for both human consumption and
 * downstream processing (dashboards, reports, APIs).
 *
 * **Why Structured Responses**
 *
 * 1. **Consistency**
 *    - Every response has the same sections
 *    - Users know where to find information
 *    - Easier to compare across queries
 *
 * 2. **Actionability**
 *    - Clear recommendations section
 *    - Prioritized next steps
 *    - Risk callouts prominently displayed
 *
 * 3. **Machine Processing**
 *    - JSON output enables dashboard updates
 *    - Structured data for trend tracking
 *    - API-friendly format
 *
 * **Response Structure**
 *
 * - **Executive Summary**: 2-3 sentence overview
 * - **Key Findings**: Numbered, quantified insights
 * - **Supporting Evidence**: Citations with confidence
 * - **Recommendations**: Prioritized actions
 * - **Risks & Concerns**: Issues requiring attention
 * - **Data Quality Notes**: Limitations and gaps
 *
 * **Confidence Levels**
 *
 * - High: Multiple corroborating sources
 * - Medium: Single source or inferred
 * - Low: Limited data or speculation
 *
 * @variables
 * - query: Original research question
 * - findings: Raw findings from research
 * - context: Retrieved documents and data
 * - audience: executive | analyst | operator
 *
 * @output Structured research response JSON
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const RESEARCH_RESPONSE_PROMPT = `You are a customer intelligence analyst preparing a research response.

Research Question: {{query}}

Raw Findings:
{{findings}}

Supporting Context:
{{context}}

Target Audience: {{audience}}

Format your response as a structured research report:

{
  "executiveSummary": "2-3 sentence overview of key findings",
  
  "keyFindings": [
    {
      "finding": "Clear statement of the finding",
      "evidence": "Quantified support (e.g., '67% of complaints mention...')",
      "confidence": "high | medium | low",
      "impact": "business impact of this finding"
    }
  ],
  
  "insights": [
    {
      "insight": "Deeper observation or pattern",
      "implication": "What this means for the business"
    }
  ],
  
  "recommendations": [
    {
      "action": "Specific recommended action",
      "priority": "immediate | short-term | long-term",
      "rationale": "Why this action is recommended",
      "expectedOutcome": "What success looks like"
    }
  ],
  
  "risks": [
    {
      "risk": "Identified risk or concern",
      "severity": "high | medium | low",
      "mitigation": "Suggested mitigation approach"
    }
  ],
  
  "dataQuality": {
    "coverage": "What data was available",
    "gaps": ["What data was missing"],
    "caveats": ["Limitations to consider"]
  },
  
  "followUpQuestions": ["Suggested next research questions"]
}`;

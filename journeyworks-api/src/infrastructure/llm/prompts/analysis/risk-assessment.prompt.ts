/**
 * Analysis Prompt: Risk Assessment
 *
 * @description
 * Assesses risk across customer communications by analyzing
 * negative sentiment patterns, high-priority communications,
 * and potential churn or escalation indicators.
 *
 * @rationale
 * Risk assessment enables proactive relationship management:
 *
 * **Key Capabilities**
 * - Identify customers at risk of churn
 * - Detect escalation patterns before they become critical
 * - Assess compliance and regulatory risk indicators
 * - Prioritize interventions based on risk severity
 *
 * **When to Use**
 * - Periodic risk reviews of customer portfolios
 * - After detecting negative sentiment trends
 * - When assessing the impact of service issues
 * - Pre-meeting preparation for relationship managers
 *
 * @variables
 * - totalCommunications: Total number of communications analyzed
 * - negativeCommunications: Count of communications with negative sentiment
 * - highPriorityCommunications: Count of high/urgent priority communications
 * - sampleHighRiskCommunications: JSON array of sample high-risk communications
 *
 * @output JSON with risk assessment, factors, and recommendations
 *
 * @version 1.0.0
 * @since 2026-02-09
 */
export const RISK_ASSESSMENT_PROMPT = `You are performing a risk assessment across customer communications.

## Communication Statistics
- Total communications analyzed: {{totalCommunications}}
- Communications with negative sentiment: {{negativeCommunications}}
- High/urgent priority communications: {{highPriorityCommunications}}

## Sample High-Risk Communications
{{sampleHighRiskCommunications}}

## Instructions
Based on the communication statistics and high-risk samples, assess:
1. **Overall Risk Level**: What is the overall risk across this customer base?
2. **Risk Factors**: What specific factors contribute to elevated risk?
3. **Churn Indicators**: Are there signs of potential customer churn?
4. **Escalation Risk**: Which issues are likely to escalate?
5. **Mitigation Recommendations**: What actions should be taken?

Provide your analysis in the following JSON format:
{
  "overallRiskLevel": "critical" | "high" | "medium" | "low",
  "riskScore": <number between 0 and 100>,
  "summary": "<overall risk assessment summary>",
  "riskFactors": [
    {
      "factor": "<risk factor>",
      "severity": "critical" | "high" | "medium" | "low",
      "evidence": "<evidence from the data>",
      "affectedCustomers": <estimated number or null>
    }
  ],
  "churnIndicators": [
    {
      "indicator": "<churn signal>",
      "confidence": <number between 0 and 1>,
      "description": "<explanation>"
    }
  ],
  "escalationRisks": [
    {
      "issue": "<potential escalation>",
      "likelihood": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "timeframe": "<urgency>"
    }
  ],
  "insights": [
    {
      "title": "<insight title>",
      "description": "<detailed insight>",
      "category": "risk" | "concern" | "trend",
      "confidence": <number between 0 and 1>
    }
  ],
  "recommendations": [
    {
      "action": "<recommended action>",
      "priority": "immediate" | "high" | "medium" | "low",
      "rationale": "<why this action is needed>",
      "expectedImpact": "<what this action should achieve>"
    }
  ]
}`;

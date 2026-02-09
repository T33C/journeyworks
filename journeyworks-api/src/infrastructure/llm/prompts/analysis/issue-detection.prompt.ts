/**
 * Analysis Prompt: Issue Detection
 *
 * @description
 * Detects and categorizes issues from customer communications,
 * focusing on negative sentiment and high-priority messages
 * to identify systemic problems and recurring complaints.
 *
 * @rationale
 * Automated issue detection helps surface problems early:
 *
 * **Key Capabilities**
 * - Identify recurring issues across communications
 * - Categorize issues by type and severity
 * - Detect systemic vs. one-off problems
 * - Estimate impact and affected customer count
 *
 * **When to Use**
 * - Monitoring for emerging issues
 * - Root cause analysis of customer complaints
 * - Quality assurance reviews
 * - Identifying patterns in escalations
 *
 * @variables
 * - totalCommunications: Total number of communications analyzed
 * - problematicCount: Number of problematic (negative/urgent) communications
 * - samples: JSON array of sample problematic communications
 *
 * @output JSON with detected issues, patterns, and recommendations
 *
 * @version 1.0.0
 * @since 2026-02-09
 */
export const ISSUE_DETECTION_PROMPT = `You are analyzing customer communications to detect and categorize issues.

## Communication Overview
- Total communications analyzed: {{totalCommunications}}
- Problematic communications (negative sentiment or high/urgent priority): {{problematicCount}}

## Sample Problematic Communications
{{samples}}

## Instructions
Analyze these communications to:
1. **Detect Issues**: Identify distinct issues or complaints
2. **Categorize**: Group issues by type (service, product, billing, process, etc.)
3. **Assess Severity**: Rate each issue's impact and urgency
4. **Find Patterns**: Determine if issues are systemic or isolated
5. **Recommend Actions**: Suggest resolution strategies

Provide your analysis in the following JSON format:
{
  "issueCount": <number of distinct issues detected>,
  "summary": "<overall summary of detected issues>",
  "issues": [
    {
      "title": "<issue title>",
      "description": "<detailed description>",
      "category": "service" | "product" | "billing" | "process" | "communication" | "compliance" | "other",
      "severity": "critical" | "high" | "medium" | "low",
      "frequency": "recurring" | "occasional" | "isolated",
      "affectedCustomers": ["<customer names if identifiable>"],
      "evidence": ["<specific quotes or indicators>"],
      "rootCause": "<likely root cause if identifiable>"
    }
  ],
  "patterns": [
    {
      "pattern": "<identified pattern>",
      "relatedIssues": ["<issue titles>"],
      "significance": "<why this pattern matters>"
    }
  ],
  "insights": [
    {
      "title": "<insight title>",
      "description": "<detailed insight>",
      "category": "concern" | "trend" | "risk",
      "confidence": <number between 0 and 1>
    }
  ],
  "recommendations": [
    {
      "action": "<recommended action>",
      "priority": "immediate" | "high" | "medium" | "low",
      "addressesIssues": ["<which issues this addresses>"],
      "rationale": "<why this action is recommended>"
    }
  ]
}`;

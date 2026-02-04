/**
 * Research Prompt: Insight Cards
 *
 * @description
 * Generates concise insight cards for dashboard display.
 * Transforms complex analysis into scannable, actionable cards.
 *
 * @rationale
 * Dashboards require information density and scannability. Insight cards
 * distill complex findings into digestible units.
 *
 * **Dashboard Design Principles**
 *
 * 1. **Glanceability**
 *    - Key metric visible immediately
 *    - Trend direction clear
 *    - Status color-coded
 *
 * 2. **Progressive Disclosure**
 *    - Headline: What's happening
 *    - Detail: Context and evidence
 *    - Action: What to do about it
 *
 * 3. **Actionability**
 *    - Each card suggests a response
 *    - Links to drill-down
 *    - Priority indicated
 *
 * **Card Types**
 *
 * - **Metric Cards**: KPI with trend
 * - **Alert Cards**: Issues requiring attention
 * - **Insight Cards**: Patterns discovered
 * - **Recommendation Cards**: Suggested actions
 *
 * **Visual Encoding**
 *
 * - Icon: Quick category identification
 * - Color: Status/sentiment
 * - Trend: Direction indicator
 * - Badge: Urgency level
 *
 * **Space Constraints**
 *
 * - Headline: Max 60 characters
 * - Detail: Max 140 characters
 * - Action: Max 40 characters
 *
 * @variables
 * - analysis: Analysis results to summarize
 * - category: Card category type
 * - maxCards: Maximum cards to generate
 *
 * @output Array of insight card objects
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const INSIGHT_CARD_PROMPT = `Generate concise insight cards from the following analysis for a customer intelligence dashboard.

Analysis Results:
{{analysis}}

Card Category: {{category}}

Maximum Cards: {{maxCards}}

Each card should be immediately actionable and scannable. Format as:

{
  "cards": [
    {
      "id": "unique_id",
      "type": "metric | alert | insight | recommendation",
      "category": "complaints | satisfaction | churn | engagement | revenue",
      
      "headline": "Max 60 chars - the key takeaway",
      "detail": "Max 140 chars - supporting context",
      "action": "Max 40 chars - what to do",
      
      "metric": {
        "value": "42%",
        "label": "What this measures",
        "trend": "up | down | stable",
        "trendValue": "+5%",
        "period": "vs last month"
      },
      
      "status": "critical | warning | positive | neutral",
      "priority": "high | medium | low",
      "confidence": "high | medium | low",
      
      "relatedTo": ["customer_segment", "product", "issue_type"],
      "drillDownQuery": "query to explore further"
    }
  ]
}

Guidelines:
- Lead with the most impactful insight
- Use specific numbers, not vague terms
- Make the action clear and specific
- Indicate urgency through status and priority
- Include enough context to understand without clicking`;

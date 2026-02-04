/**
 * Research Prompt: Customer Health Scoring
 *
 * @description
 * Calculates a comprehensive health score for customer relationships
 * based on multiple signals and dimensions.
 *
 * @rationale
 * A single health score enables prioritization and proactive intervention.
 * The score must be explainable and actionable.
 *
 * **Why Customer Health Scores**
 *
 * 1. **Prioritization**
 *    - Focus attention on at-risk customers
 *    - Identify expansion opportunities
 *    - Allocate resources effectively
 *
 * 2. **Early Warning**
 *    - Detect churn risk before it's too late
 *    - Identify satisfaction decline
 *    - Trigger proactive outreach
 *
 * 3. **Trend Tracking**
 *    - Monitor relationship trajectory
 *    - Measure intervention effectiveness
 *    - Set and track goals
 *
 * **Health Score Dimensions**
 *
 * 1. **Engagement**: Frequency and depth of interaction
 * 2. **Satisfaction**: Sentiment trends and explicit feedback
 * 3. **Product Usage**: Adoption and utilization patterns
 * 4. **Support Experience**: Issue resolution and effort
 * 5. **Financial Health**: Payment patterns, growth
 * 6. **Relationship Tenure**: Loyalty and history
 *
 * **Score Calculation**
 *
 * - Weighted combination of dimensions
 * - Normalized to 0-100 scale
 * - Categorized: Healthy, At-Risk, Critical
 * - Trend direction included
 *
 * **Explainability**
 *
 * Every score includes:
 * - Key contributing factors
 * - Dimension breakdowns
 * - Recent changes impacting score
 * - Specific improvement actions
 *
 * @variables
 * - customerId: Customer identifier
 * - signals: Available customer signals
 * - historicalScores: Previous health scores
 * - weights: Dimension weightings
 *
 * @output Health score with breakdown and recommendations
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const CUSTOMER_HEALTH_PROMPT = `Calculate a comprehensive health score for this customer relationship.

Customer ID: {{customerId}}

Available Signals:
{{signals}}

Historical Scores:
{{historicalScores}}

Dimension Weights:
{{weights}}

Analyze the customer's health across all dimensions and provide:

{
  "overallScore": 75,
  "category": "healthy | at-risk | critical",
  "trend": "improving | stable | declining",
  "trendMagnitude": "rapid | gradual",
  
  "dimensions": {
    "engagement": {
      "score": 80,
      "weight": 0.2,
      "signals": ["Recent email response", "Portal login frequency"],
      "assessment": "Good engagement patterns"
    },
    "satisfaction": {
      "score": 65,
      "weight": 0.25,
      "signals": ["Recent negative sentiment in calls", "No survey response"],
      "assessment": "Some concerns detected"
    },
    "productUsage": {
      "score": 70,
      "weight": 0.15,
      "signals": ["Feature adoption rate", "Usage frequency"],
      "assessment": "Moderate usage"
    },
    "supportExperience": {
      "score": 60,
      "weight": 0.2,
      "signals": ["Multiple open tickets", "Long resolution times"],
      "assessment": "Support friction present"
    },
    "financialHealth": {
      "score": 90,
      "weight": 0.1,
      "signals": ["On-time payments", "Account growth"],
      "assessment": "Strong financial indicators"
    },
    "relationshipTenure": {
      "score": 85,
      "weight": 0.1,
      "signals": ["3-year customer", "Multiple products"],
      "assessment": "Established relationship"
    }
  },
  
  "keyFactors": {
    "positive": ["Consistent payments", "Long tenure", "Recent feature adoption"],
    "negative": ["Unresolved support issues", "Declining communication sentiment"],
    "neutral": ["Stable usage patterns"]
  },
  
  "recentChanges": [
    {
      "change": "What changed",
      "impact": "+/- X points",
      "date": "When",
      "significance": "Why this matters"
    }
  ],
  
  "riskIndicators": [
    {
      "indicator": "Specific risk signal",
      "severity": "high | medium | low",
      "recommendation": "Mitigation action"
    }
  ],
  
  "opportunities": [
    {
      "opportunity": "Expansion or improvement opportunity",
      "potential": "Expected impact",
      "action": "Recommended next step"
    }
  ],
  
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "immediate | soon | planned",
      "owner": "Role responsible",
      "expectedImpact": "Score improvement expected"
    }
  ]
}`;

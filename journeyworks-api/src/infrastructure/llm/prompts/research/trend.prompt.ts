/**
 * Research Prompt: Trend Analysis
 *
 * @description
 * Analyzes temporal patterns in customer data to identify trends,
 * seasonality, and anomalies over time.
 *
 * @rationale
 * Understanding how metrics change over time is essential for proactive
 * customer management and early problem detection.
 *
 * **Why Trend Analysis Matters**
 *
 * 1. **Early Warning**
 *    - Detect problems before they escalate
 *    - Identify emerging complaint patterns
 *    - Spot satisfaction decline early
 *
 * 2. **Seasonality Understanding**
 *    - Plan for predictable peaks
 *    - Adjust staffing and resources
 *    - Set appropriate expectations
 *
 * 3. **Impact Measurement**
 *    - Before/after comparisons
 *    - Campaign effectiveness
 *    - Policy change effects
 *
 * **Trend Types**
 *
 * - **Direction**: Increasing, decreasing, stable
 * - **Velocity**: Rate of change
 * - **Acceleration**: Change in rate of change
 * - **Seasonality**: Recurring patterns
 * - **Anomalies**: Unexpected deviations
 *
 * **Statistical Considerations**
 *
 * - Sample size matters for confidence
 * - Account for data collection changes
 * - Distinguish signal from noise
 * - Consider confounding factors
 *
 * **Visualization Guidance**
 *
 * The prompt suggests appropriate visualizations:
 * - Line charts for trends
 * - Heat maps for seasonality
 * - Scatter plots for correlations
 *
 * @variables
 * - data: Time-series data to analyze
 * - metric: What's being measured
 * - timeRange: Analysis period
 * - granularity: daily | weekly | monthly
 *
 * @output Trend analysis with insights and projections
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const TREND_ANALYSIS_PROMPT = `Analyze the following time-series data to identify trends, patterns, and anomalies.

Data:
{{data}}

Metric: {{metric}}
Time Range: {{timeRange}}
Granularity: {{granularity}}

Provide a comprehensive trend analysis:

{
  "summary": "Overall trend description in 2-3 sentences",
  
  "trend": {
    "direction": "increasing | decreasing | stable | volatile",
    "strength": "strong | moderate | weak",
    "confidence": "high | medium | low",
    "percentChange": "+/- X% over period"
  },
  
  "patterns": [
    {
      "type": "seasonality | cyclical | anomaly | inflection",
      "description": "What the pattern is",
      "period": "When it occurs",
      "magnitude": "How significant",
      "possibleCause": "Hypothesized reason"
    }
  ],
  
  "anomalies": [
    {
      "date": "When it occurred",
      "value": "The anomalous value",
      "expected": "What was expected",
      "deviation": "How far from expected",
      "possibleCause": "Why this might have happened"
    }
  ],
  
  "correlations": [
    {
      "relatedMetric": "Another metric that moves together",
      "relationship": "positive | negative | lagging",
      "strength": "correlation coefficient or qualitative"
    }
  ],
  
  "projections": {
    "shortTerm": "Next 30 days expectation",
    "mediumTerm": "Next 90 days expectation",
    "confidence": "How reliable these projections are",
    "assumptions": ["Key assumptions for projections"]
  },
  
  "recommendations": [
    "Actions based on trend analysis"
  ],
  
  "visualizationSuggestions": [
    {
      "chartType": "line | bar | heatmap | scatter",
      "purpose": "What this visualization shows",
      "configuration": "Key settings"
    }
  ]
}`;

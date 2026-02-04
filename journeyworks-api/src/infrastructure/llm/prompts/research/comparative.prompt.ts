/**
 * Research Prompt: Comparative Analysis
 *
 * @description
 * Compares metrics, behaviors, or outcomes across different segments,
 * time periods, or cohorts to surface meaningful differences.
 *
 * @rationale
 * Comparison is fundamental to insight. Understanding how groups differ
 * reveals opportunities and explains outcomes.
 *
 * **Why Comparative Analysis**
 *
 * 1. **Segment Understanding**
 *    - How do high-value customers differ from others?
 *    - What distinguishes churned from retained customers?
 *    - How do complaint patterns vary by product?
 *
 * 2. **Benchmark Setting**
 *    - What does "good" look like?
 *    - Where are we vs. expectations?
 *    - How do we compare to best performers?
 *
 * 3. **Causal Inference**
 *    - Treatment vs. control analysis
 *    - Before/after comparisons
 *    - A/B test interpretation
 *
 * **Comparison Types**
 *
 * - **Cross-Sectional**: Different groups at same time
 * - **Longitudinal**: Same group across time
 * - **Cohort**: Groups by shared characteristic
 * - **Treatment/Control**: Intervention effects
 *
 * **Statistical Rigor**
 *
 * - Sample size considerations
 * - Statistical significance testing
 * - Effect size reporting
 * - Confidence intervals
 *
 * **Visualization**
 *
 * - Bar charts for categorical comparisons
 * - Dual-axis charts for different scales
 * - Scatter plots for correlations
 * - Tables for detailed breakdowns
 *
 * @variables
 * - groupA: First group to compare
 * - groupB: Second group to compare
 * - metrics: What to compare
 * - analysisType: cross-sectional | longitudinal | cohort
 *
 * @output Comparative analysis with statistical support
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const COMPARATIVE_ANALYSIS_PROMPT = `Perform a comparative analysis between the following groups.

Group A:
{{groupA}}

Group B:
{{groupB}}

Metrics to Compare:
{{metrics}}

Analysis Type: {{analysisType}}

Provide a comprehensive comparison:

{
  "summary": "Key differences in 2-3 sentences",
  
  "comparison": {
    "totalRecordsA": 1000,
    "totalRecordsB": 1200,
    "timePeriod": "Analysis period",
    "methodology": "How comparison was performed"
  },
  
  "metricComparisons": [
    {
      "metric": "Metric name",
      "groupAValue": "Value or average",
      "groupBValue": "Value or average",
      "difference": "Absolute difference",
      "percentDifference": "+/- X%",
      "direction": "A higher | B higher | Equal",
      "statisticalSignificance": "p-value or confidence",
      "practicalSignificance": "Is this difference meaningful?",
      "insight": "What this difference tells us"
    }
  ],
  
  "keyDifferences": [
    {
      "dimension": "Where the difference is",
      "observation": "What's different",
      "magnitude": "How big is the difference",
      "hypothesis": "Why this might be",
      "implication": "What to do about it"
    }
  ],
  
  "similarities": [
    {
      "dimension": "Where groups are similar",
      "observation": "What's the same",
      "implication": "What this tells us"
    }
  ],
  
  "segmentBreakdowns": [
    {
      "segment": "Sub-segment within groups",
      "groupAPattern": "How A behaves",
      "groupBPattern": "How B behaves",
      "notable": "What stands out"
    }
  ],
  
  "confoundingFactors": [
    "Factors that might explain differences besides the grouping"
  ],
  
  "recommendations": [
    {
      "target": "Which group this applies to",
      "action": "What to do",
      "rationale": "Why based on the comparison",
      "expectedImpact": "What improvement is expected"
    }
  ],
  
  "furtherAnalysis": [
    "Suggested follow-up analyses to deepen understanding"
  ],
  
  "visualizationSuggestions": [
    {
      "chartType": "Chart type",
      "purpose": "What it would show",
      "data": "What data to plot"
    }
  ]
}`;

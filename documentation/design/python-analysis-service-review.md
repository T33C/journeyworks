# Python Analysis Service Review

## Overview

The `analysis-service` is a Python/FastAPI microservice that provides **statistical analysis** and **data card generation** capabilities. It was imported from another project and provides complementary functionality to the LLM-based insights.

## Current Capabilities

### What It Does

| Capability               | Description                                            | Python Libraries |
| ------------------------ | ------------------------------------------------------ | ---------------- |
| **Schema Inference**     | Auto-detects numeric, categorical, and temporal fields | pandas           |
| **Numeric Statistics**   | Mean, median, std, quartiles, skewness, kurtosis       | pandas, scipy    |
| **Outlier Detection**    | Z-score and IQR methods                                | scipy            |
| **Correlation Analysis** | Pearson correlation matrix                             | pandas, scipy    |
| **Categorical Analysis** | Frequency distributions, concentration risk (HHI)      | pandas           |
| **Temporal Analysis**    | Date ranges, gaps, hourly/daily distributions          | pandas           |
| **Anomaly Detection**    | Statistical outliers, concentration risks              | scipy            |
| **Chart Data**           | Histogram and bar chart data generation                | numpy            |

### API Endpoints

```
GET  /health                    - Health check
POST /api/v1/analyze/dataset    - Full dataset analysis (DataCard)
```

### Current Integration

The NestJS backend already has integration:

```
journeyworks-api/
  └── src/infrastructure/analysis-service/
      ├── analysis-service.client.ts    # HTTP client
      ├── analysis-service.types.ts     # TypeScript types
      └── analysis-service.module.ts    # NestJS module
```

Exposed via: `POST /api/analysis/data-card`

## Suitability Assessment for JourneyWorks

### ✅ Highly Suitable For

| Use Case                     | Why It's Good                                                    | Example Question                                                  |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Volume Anomaly Detection** | Z-score/IQR detects unusual spikes or drops in complaint volumes | "Are there any unusual patterns in today's complaint volume?"     |
| **Concentration Risk**       | HHI index identifies over-reliance on single categories          | "Is there a disproportionate volume from one product or channel?" |
| **Statistical Outliers**     | Finds unusual sentiment scores, resolution times                 | "Which cases have abnormally long resolution times?"              |
| **Trend Analysis**           | Time series analysis for patterns                                | "Is complaint volume trending up or down this month?"             |
| **Data Quality Checks**      | Missing values, completeness scores                              | "How complete is our data for the selected period?"               |
| **Distribution Analysis**    | Understand the shape of data                                     | "What's the distribution of NPS scores across products?"          |
| **Correlation Discovery**    | Find relationships between metrics                               | "Is there a correlation between resolution time and NPS?"         |

### ⚠️ Overlap with LLM Insights

Some capabilities overlap with what the LLM already does:

| Capability           | Python Service          | LLM Insights         | Recommendation           |
| -------------------- | ----------------------- | -------------------- | ------------------------ |
| Summary statistics   | ✅ Precise calculations | ✅ Can describe      | Use Python for accuracy  |
| Trend interpretation | ❌ No interpretation    | ✅ Natural language  | Use LLM                  |
| Outlier detection    | ✅ Statistical methods  | ⚠️ Can spot obvious  | Use Python, LLM explains |
| Recommendations      | ❌ No recommendations   | ✅ Actionable advice | Use LLM                  |

### ❌ Not Suitable For

- **Natural language Q&A** - Use LLM insights instead
- **Qualitative analysis** - Can't understand verbatims/sentiment context
- **Root cause analysis** - Finds correlations, not causation
- **Customer journey narrative** - No understanding of business context

## Recommended Integration Pattern

### Hybrid Approach: Python Stats + LLM Interpretation

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Question                                │
│  "Are there any unusual patterns in complaint volumes this week?"    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    1. Fetch Raw Data (ES)                           │
│  Query: journeyworks_communications for time period                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 2. Statistical Analysis (Python)                     │
│                                                                      │
│  POST /api/v1/analyze/dataset                                       │
│  {                                                                   │
│    "data": [communications...],                                     │
│    "options": {                                                     │
│      "outlier_method": "zscore",                                    │
│      "include_distributions": true                                  │
│    }                                                                │
│  }                                                                  │
│                                                                      │
│  Returns:                                                           │
│  - Detected outliers (Jan 15: 3.2σ above mean)                     │
│  - Distribution stats (mean: 45/day, std: 12)                       │
│  - Concentration risks (Payment Issues: 67% of volume)              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 3. LLM Interpretation (Claude)                       │
│                                                                      │
│  System: "You are a CX analyst. Here is statistical analysis..."    │
│  User: "Explain these findings and recommend actions"               │
│                                                                      │
│  Response:                                                          │
│  "**Anomaly Detected:** January 15th saw a 3.2σ spike in            │
│   complaints (156 vs normal 45/day). This coincides with the        │
│   payment system outage recorded in the events data.                │
│                                                                      │
│   **Concentration Risk:** 67% of complaints relate to               │
│   Payment Issues, indicating over-dependence on payment             │
│   processing reliability.                                           │
│                                                                      │
│   **Recommended Actions:**                                          │
│   1. Review payment system redundancy                               │
│   2. Implement proactive communication for outages..."              │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Recommendations

### Phase 1: Enable for Specific Question Types

Modify `research.service.ts` to route certain questions to Python service:

```typescript
// Detect statistical questions
const statisticalPatterns = [
  /unusual|anomaly|outlier|abnormal/i,
  /correlation|relationship between/i,
  /distribution|spread|variance/i,
  /concentration|dominated by/i,
  /trend|trending|pattern over time/i,
  /data quality|missing|incomplete/i,
];

if (statisticalPatterns.some((p) => p.test(question))) {
  // Fetch data from ES
  const rawData = await this.fetchCommunicationsForAnalysis(context);

  // Call Python service for statistical analysis
  const stats = await this.analysisClient.analyzeDataset({
    data: rawData,
    options: {
      outlier_method: 'zscore',
      outlier_threshold: 2.5,
      compute_correlations: true,
    },
  });

  // Include stats in LLM prompt
  const enhancedPrompt = this.buildPromptWithStats(
    context,
    data,
    stats,
    question,
  );
  return this.generateLlmInsightWithData(context, data, enhancedPrompt);
}
```

### Phase 2: Add Dedicated Statistical Endpoints

```
POST /api/analysis/detect-anomalies
POST /api/analysis/correlations
POST /api/analysis/distribution/{field}
POST /api/analysis/data-quality-report
```

### Phase 3: UI Integration

Add statistical visualizations to the Research Panel:

- Anomaly markers on timeline
- Correlation heatmap
- Distribution histograms
- Data quality indicators

## Questions That Would Benefit from Python Service

### Anomaly Detection

- "Are there any unusual patterns in complaint volumes?"
- "Which days had abnormally high/low NPS scores?"
- "Detect any outliers in resolution time"
- "Are there any statistical anomalies in the data?"

### Correlation Analysis

- "Is there a correlation between wait time and NPS?"
- "What factors correlate with high detractor rates?"
- "Does channel type affect resolution satisfaction?"
- "Find relationships between complaint themes and outcomes"

### Distribution & Concentration

- "What's the distribution of complaints across products?"
- "Is our complaint volume concentrated in specific areas?"
- "Show me the breakdown of sentiment scores"
- "Are certain categories dominating the data?"

### Trend Analysis

- "Is complaint volume trending up or down?"
- "How has sentiment changed over the last month?"
- "Identify seasonal patterns in complaints"
- "Compare this week's stats to the monthly average"

### Data Quality

- "How complete is our NPS data?"
- "Are there gaps in our communication records?"
- "Check data quality for the selected period"
- "Which fields have missing values?"

## Current Status

| Component                      | Status      | Notes                           |
| ------------------------------ | ----------- | ------------------------------- |
| Python service code            | ✅ Ready    | Imported and functional         |
| Docker configuration           | ✅ Ready    | In docker-compose.yml           |
| NestJS client                  | ✅ Ready    | AnalysisServiceClient exists    |
| Data card endpoint             | ✅ Working  | POST /api/analysis/data-card    |
| Research panel integration     | ❌ Not done | Would need to add routing logic |
| Statistical question detection | ❌ Not done | Need to implement patterns      |

## Configuration

### Environment Variables

```bash
# In .env or docker-compose.yml
ANALYSIS_SERVICE_URL=http://localhost:8081
ANALYSIS_SERVICE_TIMEOUT=120000
```

### Starting the Service

```bash
# Development (standalone)
cd python/analysis-service
./start.sh

# Docker
docker-compose up analysis-service

# Verify
curl http://localhost:8081/health
```

## Summary

The Python analysis service is **suitable and valuable** for JourneyWorks, particularly for:

1. **Precise statistical calculations** that the LLM might approximate
2. **Anomaly detection** using proven statistical methods (z-score, IQR)
3. **Correlation analysis** to find relationships in the data
4. **Data quality assessment** before analysis

The recommended approach is a **hybrid model** where:

- Python service provides **statistical rigor** and **quantitative analysis**
- LLM provides **interpretation**, **context**, and **recommendations**

This gives users both precise numbers and actionable insights.

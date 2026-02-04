# Analysis Service

Statistical analysis service for generating DataCards from Elasticsearch query results.

## Features

- **Automatic schema inference** - detects numeric, categorical, and temporal fields
- **Comprehensive statistics** - mean, median, std, quartiles, skewness, kurtosis
- **Outlier detection** - z-score and IQR methods
- **Correlation analysis** - Pearson correlation matrix
- **Categorical analysis** - frequency distributions, concentration risk
- **Temporal analysis** - date ranges, gaps, distributions
- **Anomaly detection** - statistical outliers, concentration risks
- **Chart data generation** - histogram and bar chart data

## API Endpoints

### POST /api/v1/analyze/dataset

Analyze a dataset and return comprehensive statistics.

**Request:**

```json
{
  "data": [
    { "amount": 1500000, "trader": "JDoe", "product": "EQUITY" },
    { "amount": 2300000, "trader": "ASmith", "product": "BOND" }
  ],
  "schema": {
    "numeric": ["amount"],
    "categorical": ["trader", "product"],
    "temporal": ["trade_date"]
  },
  "options": {
    "compute_correlations": true,
    "outlier_method": "zscore",
    "outlier_threshold": 3.0,
    "top_n": 10,
    "include_distributions": true
  }
}
```

**Response:**

```json
{
  "summary": {
    "record_count": 247,
    "total_notional": 425000000,
    "time_range": { "start": "2025-11-21T00:00:00", "end": "2025-11-21T16:00:00" }
  },
  "numeric_stats": {
    "amount": {
      "mean": 1720445.34,
      "median": 1500000,
      "std": 523456.78,
      "outliers": { "count": 12, "method": "zscore" }
    }
  },
  "categorical_stats": {
    "trader": {
      "unique_count": 45,
      "top_n": [{ "value": "JDoe", "count": 25, "percent": 10.1 }],
      "concentration_risk": 0.15
    }
  },
  "correlations": {
    "pearson": { "amount_volume": 0.85 },
    "significant": [{ "field1": "amount", "field2": "volume", "r": 0.85 }]
  },
  "anomalies": [
    {
      "type": "statistical_outlier",
      "field": "amount",
      "severity": "medium",
      "description": "12 outliers detected",
      "affected_records": [5, 12, 34]
    }
  ],
  "chart_data": [
    {
      "type": "histogram",
      "field": "amount",
      "data": { "bins": [...], "counts": [...] }
    }
  ]
}
```

## Docker

### Build

```bash
docker build -t analysis-service .
```

### Run

```bash
docker run -p 8002:8002 analysis-service
```

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with hot reload
uvicorn app.main:app --reload --port 8002
```

## Testing

```bash
# Unit tests
pytest

# With coverage
pytest --cov=app
```

## Integration with trade-search

The trade-search service calls this service via HTTP to analyze query results:

```typescript
// In NestJS
const response = await axios.post(
  'http://analysis-service:8002/api/v1/analyze/dataset',
  {
    data: elasticsearchResults,
    options: { compute_correlations: true },
  }
);
```

# Real Data Integration Plan

## Replace Mock Data with Elasticsearch Data for Dashboard Charts

**Created:** 2026-02-02  
**Status:** Planning

---

## 1. Overview

The demo-app dashboard currently uses hardcoded mock data in both:

- **Frontend:** `demo-app/src/app/core/services/analysis-data.service.ts`
- **Backend:** `journeyworks-api/src/modules/analysis/analysis.service.ts`

This plan outlines how to replace mock data with real Elasticsearch data.

---

## 2. Data Availability Assessment

### Elasticsearch Indices

| Index                         | Documents | Key Fields for Charts                                                                    |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `journeyworks_communications` | 1,296     | timestamp, sentiment.score, aiClassification.product, aiClassification.category, channel |
| `journeyworks_events`         | 50        | startDate, type, label, product, severity, status, estimatedImpact, sentimentDuringEvent |
| `journeyworks_social`         | 100       | timestamp, sentiment, platform, content, mentionedProducts                               |
| `journeyworks_cases`          | 29        | status (open/in_progress/pending/resolved/closed), priority, category                    |

### Data Date Range

- Communications: 2024-01-01 to 2026-02-01
- Events: Scattered across 2024-2025

---

## 3. Chart-by-Chart Implementation

### 3.1 Timeline Events Chart ✅ Ready

**Current:** Hardcoded 5 events  
**Target:** Query `journeyworks_events` index

**ES → Chart Mapping:**
| ES Field | Chart Field |
|----------|-------------|
| `id` | `id` |
| `startDate` | `date` |
| `type` | `type` |
| `label` | `label` |
| `product` | `product` |
| `severity` | `severity` |
| `description` | `description` |

**Query Strategy:**

```json
{
  "query": {
    "bool": {
      "filter": [
        { "range": { "startDate": { "gte": "start", "lte": "end" } } },
        { "term": { "product.keyword": "product-filter" } }
      ]
    }
  },
  "sort": [{ "startDate": "asc" }],
  "size": 100
}
```

---

### 3.2 Sentiment Bubbles (Daily Aggregation) ✅ Ready

**Current:** Generated 31-day mock data  
**Target:** Aggregate from `journeyworks_communications`

**ES Aggregation Strategy:**

```json
{
  "size": 0,
  "query": { "range": { "timestamp": { "gte": "start", "lte": "end" } } },
  "aggs": {
    "by_day": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "day"
      },
      "aggs": {
        "avg_sentiment": { "avg": { "field": "sentiment.score" } },
        "products": {
          "terms": { "field": "aiClassification.product.keyword" }
        },
        "categories": {
          "terms": { "field": "aiClassification.category.keyword", "size": 5 }
        }
      }
    }
  }
}
```

**Computed Fields:**

- `volume` = doc_count per day
- `sentiment` = avg_sentiment
- `themes` = top 3 categories as array
- `product` = most common product that day
- `npsScore`, `promoterPct`, etc. = derived from sentiment using existing `sentimentToNPS()` function

---

### 3.3 Quadrant Chart (Topic Analysis) ✅ Ready

**Current:** Hardcoded 10 topics  
**Target:** Aggregate by `aiClassification.category`

**ES Aggregation Strategy:**

```json
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "aiClassification.category.keyword", "size": 20 },
      "aggs": {
        "avg_sentiment": { "avg": { "field": "sentiment.score" } },
        "by_product": {
          "terms": { "field": "aiClassification.product.keyword" }
        }
      }
    }
  }
}
```

**Quadrant Assignment Logic:**

- Critical: sentiment < -0.3 AND volume > 100
- Watch: sentiment < -0.3 AND volume ≤ 100
- Strength: sentiment ≥ -0.3 AND volume > 50
- Noise: sentiment ≥ -0.3 AND volume ≤ 50

---

### 3.4 Journey Waterfall ⚠️ Requires Mapping

**Current:** 5 hardcoded stages (initial-contact, triage, investigation, resolution, post-resolution)  
**Target:** Derive from case status OR communications metadata

**Option A: Map Case Status → Journey Stage**
| Case Status | Journey Stage |
|-------------|---------------|
| `open` | initial-contact |
| `pending` | triage |
| `in_progress` | investigation |
| `resolved` | resolution |
| `closed` | post-resolution |

**Option B: Use Communications Linked to Cases**

- Join communications to cases via `communicationIds`
- Group sentiment by case status
- Calculate stage-level sentiment

**Recommended:** Option A for PoC, then enhance with Option B

---

### 3.5 Social Sentiment Band ✅ Ready

**Current:** Included in mock bubbles  
**Target:** Parallel aggregation from `journeyworks_social`

**ES Aggregation Strategy:**

```json
{
  "size": 0,
  "query": { "range": { "timestamp": { "gte": "start", "lte": "end" } } },
  "aggs": {
    "by_day": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "day"
      },
      "aggs": {
        "avg_sentiment": { "avg": { "field": "sentiment.score" } }
      }
    }
  }
}
```

Merge with bubble data to add `socialSentiment` field.

---

## 4. Implementation Tasks

### Phase 1: Backend API (analysis.service.ts)

| #   | Task                                                      | Estimate |
| --- | --------------------------------------------------------- | -------- |
| 1.1 | Inject ElasticsearchClient into AnalysisService           | 15m      |
| 1.2 | Implement `getTimelineEvents()` with ES query             | 30m      |
| 1.3 | Implement `getSentimentBubbles()` with date_histogram agg | 45m      |
| 1.4 | Implement `getQuadrantItems()` with category agg          | 30m      |
| 1.5 | Implement `getJourneyStages()` with case status mapping   | 45m      |
| 1.6 | Add social sentiment to bubbles endpoint                  | 30m      |
| 1.7 | Add error handling & fallback to mock data                | 20m      |

### Phase 2: Frontend Integration (demo-app)

| #   | Task                                             | Estimate |
| --- | ------------------------------------------------ | -------- |
| 2.1 | Create `ApiService` with HttpClient              | 20m      |
| 2.2 | Update `AnalysisDataService` to call API         | 30m      |
| 2.3 | Add loading states to chart components           | 20m      |
| 2.4 | Add error handling with fallback                 | 15m      |
| 2.5 | Update date range picker to use real data bounds | 15m      |

### Phase 3: Testing & Polish

| #   | Task                                       | Estimate |
| --- | ------------------------------------------ | -------- |
| 3.1 | Test all charts with real data             | 30m      |
| 3.2 | Verify drill-down links work with real IDs | 20m      |
| 3.3 | Performance test with full dataset         | 15m      |

---

## 5. API Endpoint Summary

All endpoints already exist, just need implementation updates:

| Endpoint                             | Method                   | Purpose          |
| ------------------------------------ | ------------------------ | ---------------- |
| `GET /api/analysis/timeline/events`  | Query ES events          | Timeline markers |
| `GET /api/analysis/timeline/bubbles` | Aggregate communications | Bubble chart     |
| `GET /api/analysis/journey/stages`   | Aggregate by case status | Waterfall chart  |
| `GET /api/analysis/quadrant/items`   | Aggregate by category    | Quadrant scatter |

**New Endpoint Needed:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/analysis/social/sentiment` | Aggregate social mentions | Sentiment band overlay |

---

## 6. Product Name Mapping

Frontend uses simplified names, ES uses full names:

```typescript
const PRODUCT_MAP = {
  cards: 'credit-card',
  savings: 'savings-account',
  current: 'current-account',
  loans: 'personal-loan',
  payments: 'online-banking',
  mortgage: 'mortgage',
  insurance: 'insurance',
  app: 'mobile-app',
};
```

---

## 7. Risk Mitigation

| Risk                            | Mitigation                                      |
| ------------------------------- | ----------------------------------------------- |
| ES unavailable                  | Fallback to mock data with warning              |
| Empty date ranges               | Show "No data" message, not empty chart         |
| Performance with large datasets | Add ES query caching, limit aggregation sizes   |
| Field mapping changes           | Abstract ES queries into separate query builder |

---

## 8. Success Criteria

- [ ] All 4 charts display real ES data
- [ ] Clicking events/bubbles shows real document IDs
- [ ] Date range filtering works correctly
- [ ] Product filtering works correctly
- [ ] Social sentiment band shows real social data
- [ ] Graceful fallback when ES is unavailable
- [ ] No console errors in browser

---

## 9. Execution Order

1. **Start with Timeline Events** - simplest, direct ES query
2. **Then Sentiment Bubbles** - core chart, uses aggregation
3. **Then Quadrant Items** - similar aggregation pattern
4. **Then Journey Stages** - requires case join logic
5. **Finally Social Sentiment** - enhancement to bubbles
6. **Last: Frontend integration** - wire up all endpoints

Ready to proceed? Start with Task 1.1 → 1.2 (Timeline Events).

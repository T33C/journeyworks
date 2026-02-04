# JourneyWorks Backend Implementation Plan

## Executive Summary

The JourneyWorks backend (NestJS API) has a solid architectural foundation with modules for communications, analysis, research, RAG, RRG, and synthetic data generation. However, several gaps exist between what the frontend expects and what the backend currently provides. This plan outlines the work needed to achieve a fully functional PoC.

---

## Current State Assessment

### ✅ What's Already Implemented

| Component                     | Status   | Notes                                                  |
| ----------------------------- | -------- | ------------------------------------------------------ |
| **NestJS Framework**          | Complete | Well-structured with modules, controllers, services    |
| **Elasticsearch Integration** | Complete | Repository pattern, bulk indexing, search              |
| **Redis Caching**             | Complete | Cache service with TTL support                         |
| **LLM Integration**           | Complete | Anthropic Claude, prompt templates                     |
| **Communications CRUD**       | Complete | Create, search, semantic search, aggregations          |
| **Synthetic Data Generators** | Partial  | Customer, communication, case, social generators exist |
| **Research Module**           | Partial  | Agent executor, tools service, conversation support    |
| **Analysis Module**           | Partial  | Basic analysis types defined                           |
| **Model Service Client**      | Complete | Integration with Python model service                  |
| **Configuration**             | Complete | Environment-based config, CORS, ports                  |

### ❌ Gaps Identified

| Gap                         | Priority | Frontend Expectation                        | Backend Reality              |
| --------------------------- | -------- | ------------------------------------------- | ---------------------------- |
| **Timeline Data API**       | High     | `GET /analysis/timeline/events`             | Not implemented              |
| **Sentiment Bubbles API**   | High     | `GET /analysis/timeline/bubbles`            | Not implemented              |
| **Journey Stages API**      | High     | `GET /analysis/journey/stages`              | Not implemented              |
| **Quadrant Data API**       | High     | `GET /analysis/quadrant/items`              | Not implemented              |
| **Research Insights API**   | High     | `POST /research/insight` for context        | Returns structured insight   |
| **Customer Endpoints**      | Medium   | `GET /customers/:id`                        | Not implemented              |
| **Communication Stats**     | Medium   | `GET /communications/stats`                 | Partially implemented        |
| **Recent Communications**   | Medium   | `GET /communications/recent`                | Not implemented              |
| **Customer Communications** | Medium   | `GET /communications/customer/:id`          | Not implemented              |
| **Status Updates**          | Medium   | `PATCH /communications/:id/status`          | Not implemented              |
| **Retail Customer Data**    | High     | Individual customers (James Morrison, etc.) | Corporate-focused generators |

---

## Implementation Plan

### Phase 1: Analysis Dashboard APIs (Priority: Critical)

These endpoints power the main analysis dashboard with the D3.js visualizations.

#### 1.1 Timeline Events Endpoint

```
GET /analysis/timeline/events
Query: dateRange, products[], channels[]
Response: TimelineEvent[]
```

**Tasks:**

- [ ] Create `TimelineEventsDto` for query params
- [ ] Add `getTimelineEvents()` to AnalysisService
- [ ] Store/generate realistic banking events (outages, launches, announcements)
- [ ] Filter by date range and products

#### 1.2 Sentiment Bubbles Endpoint

```
GET /analysis/timeline/bubbles
Query: dateRange, products[], channels[], granularity
Response: SentimentBubble[]
```

**Tasks:**

- [ ] Create `SentimentBubblesDto` for query params
- [ ] Aggregate communications by time period (day/week)
- [ ] Calculate sentiment, volume, NPS metrics per bubble
- [ ] Include social sentiment from social mentions

#### 1.3 Journey Stages Endpoint

```
GET /analysis/journey/stages
Query: dateRange, products[], channels[], context (event/bubble/quadrant)
Response: JourneyStage[]
```

**Tasks:**

- [ ] Define 5 journey stages: initial-contact, triage, investigation, resolution, post-resolution
- [ ] Calculate sentiment progression and NPS per stage
- [ ] Support contextual filtering (filter by related event/time period)

#### 1.4 Quadrant Items Endpoint

```
GET /analysis/quadrant/items
Query: dateRange, products[], channels[]
Response: QuadrantItem[]
```

**Tasks:**

- [ ] Aggregate issues by topic/category
- [ ] Calculate volume and average sentiment per issue
- [ ] Assign quadrant (critical/watch/strength/noise) based on thresholds
- [ ] Include NPS breakdown per quadrant item

---

### Phase 2: Research Panel APIs (Priority: High)

Powers the AI Research panel with contextual insights.

#### 2.1 Context-Aware Insights Endpoint

```
POST /research/insight
Body: { context: AnalysisContext }
Response: ResearchInsight
```

**Tasks:**

- [ ] Accept context (timeWindow, event, bubble, quadrant, journeyStage)
- [ ] Query relevant communications from Elasticsearch
- [ ] Use LLM to generate structured insight with:
  - Summary
  - Key drivers
  - Evidence items
  - Timeline reasoning
  - Suggested actions
  - Suggested follow-up Q&A
- [ ] Return confidence level

#### 2.2 Chat/Follow-up Endpoint

```
POST /research/chat
Body: { conversationId, message, context }
Response: { response, citations }
```

**Tasks:**

- [ ] Maintain conversation context in Redis
- [ ] Query relevant communications for RAG
- [ ] Generate response with LLM
- [ ] Include evidence citations

---

### Phase 3: Communications Enhancements (Priority: Medium)

#### 3.1 Additional Endpoints

```
GET /communications/recent?limit=10
GET /communications/customer/:customerId?limit=10
GET /communications/stats
PATCH /communications/:id/status
PATCH /communications/:id/assign
```

**Tasks:**

- [ ] Add `getRecent()` method - sort by timestamp desc
- [ ] Add `getByCustomer()` method - filter by customerId
- [ ] Add `getStats()` method - aggregations for dashboard KPIs
- [ ] Add `updateStatus()` method
- [ ] Add `assignTo()` method

---

### Phase 4: Customer Module (Priority: Medium)

#### 4.1 New Customer Module

```
GET /customers/:id
GET /customers/:id/health
GET /customers/:id/communications
GET /customers/search
```

**Tasks:**

- [ ] Create CustomersModule with controller, service, repository
- [ ] Define Customer entity matching frontend model
- [ ] Implement customer health calculation based on:
  - Recent sentiment trend
  - Open cases
  - Communication frequency
  - NPS scores
- [ ] Store customers in Elasticsearch

---

### Phase 5: Synthetic Data Updates (Priority: High)

Update generators to produce retail banking customer data instead of institutional/corporate.

#### 5.1 Retail Customer Generator

**Tasks:**

- [ ] Update customer names to individuals (James Morrison, Emma Richardson, etc.)
- [ ] Update email patterns to personal domains
- [ ] Remove company field or set as empty
- [ ] Update tiers to retail: standard, premium (not enterprise)
- [ ] Adjust communication patterns for retail (simpler subjects, personal tone)

#### 5.2 Retail Communication Content

**Tasks:**

- [ ] Update subject lines to retail: "Mobile app login issue", "Direct debit query", etc.
- [ ] Update content to personal tone (I/my vs we/our)
- [ ] Include retail-specific topics: mortgage, overdraft, cards, savings
- [ ] Remove corporate/trading references

#### 5.3 Retail Events

**Tasks:**

- [ ] Update timeline events to retail banking scenarios
- [ ] Payment outages affecting individual customers
- [ ] Mobile app updates
- [ ] Fee structure changes
- [ ] Branch announcements

---

### Phase 6: Data Seeding & Demo Mode (Priority: Medium)

#### 6.1 Seed Script

**Tasks:**

- [ ] Create `npm run seed` command
- [ ] Generate 100+ retail customers
- [ ] Generate 1000+ communications over 90 days
- [ ] Generate timeline events
- [ ] Generate social mentions

#### 6.2 Demo Mode

**Tasks:**

- [ ] Add `DEMO_MODE=true` environment variable
- [ ] When API starts in demo mode, auto-seed if indices empty
- [ ] Use fixed seed for reproducible demo data

---

## API Endpoint Summary

### New Endpoints Required

| Method | Endpoint                       | Module          | Priority |
| ------ | ------------------------------ | --------------- | -------- |
| GET    | `/analysis/timeline/events`    | Analysis        | Critical |
| GET    | `/analysis/timeline/bubbles`   | Analysis        | Critical |
| GET    | `/analysis/journey/stages`     | Analysis        | Critical |
| GET    | `/analysis/quadrant/items`     | Analysis        | Critical |
| POST   | `/research/insight`            | Research        | High     |
| POST   | `/research/chat`               | Research        | High     |
| GET    | `/communications/recent`       | Communications  | Medium   |
| GET    | `/communications/customer/:id` | Communications  | Medium   |
| GET    | `/communications/stats`        | Communications  | Medium   |
| PATCH  | `/communications/:id/status`   | Communications  | Medium   |
| GET    | `/customers/:id`               | Customers (new) | Medium   |
| GET    | `/customers/:id/health`        | Customers (new) | Medium   |
| POST   | `/synthetic/seed`              | Synthetic       | Medium   |

---

## Technical Considerations

### Elasticsearch Indices Needed

1. `journeyworks_communications` - exists
2. `journeyworks_customers` - new
3. `journeyworks_events` - configured but needs data
4. `journeyworks_social` - configured but needs data

### Environment Variables to Add

```env
DEMO_MODE=true
SEED_ON_STARTUP=false
RETAIL_DATA_MODE=true
```

### Dependencies Already Installed

- @nestjs/elasticsearch ✓
- ioredis ✓
- @anthropic-ai/sdk ✓
- uuid ✓

---

## Estimated Effort

| Phase                    | Effort   | Dependencies               |
| ------------------------ | -------- | -------------------------- |
| Phase 1: Analysis APIs   | 2-3 days | Elasticsearch aggregations |
| Phase 2: Research APIs   | 2 days   | LLM integration, RAG       |
| Phase 3: Communications  | 1 day    | Existing module            |
| Phase 4: Customer Module | 1-2 days | New module                 |
| Phase 5: Synthetic Data  | 1 day    | Generator updates          |
| Phase 6: Seeding         | 0.5 days | All above                  |

**Total: ~8-10 days**

---

## Recommended Execution Order

1. **Phase 5: Synthetic Data Updates** - Foundation for realistic demo data
2. **Phase 1.1-1.2: Timeline APIs** - Powers the main chart
3. **Phase 1.3-1.4: Journey & Quadrant APIs** - Completes dashboard
4. **Phase 2: Research APIs** - AI-powered insights
5. **Phase 3: Communications Enhancements** - Detail views
6. **Phase 4: Customer Module** - Customer context
7. **Phase 6: Seeding** - Reproducible demo

---

## Next Steps

1. **Confirm priorities** - Are there specific features needed for upcoming demos?
2. **Start with Phase 5** - Update synthetic generators for retail data
3. **Implement Phase 1** - Get the analysis dashboard working with real API calls
4. **Iterate** - Connect frontend to backend incrementally

Would you like me to start implementing any specific phase?

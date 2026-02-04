# LLM-Powered Insights Architecture

This document explains how the AI Research Panel generates data-driven insights using Large Language Models (LLMs) combined with real-time Elasticsearch queries.

## Overview

The insight system provides contextual analysis of customer experience data by:

1. Querying real data from Elasticsearch based on user selections
2. Building structured prompts with metrics, journey data, and customer verbatims
3. Using Claude (Anthropic) or GPT-4 (OpenAI) to generate natural language insights
4. Caching results for performance optimization

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Angular)                              │
│                                                                              │
│  ┌─────────────────────┐    ┌──────────────────┐    ┌───────────────────┐   │
│  │ research-panel      │───▶│ analysis-data    │───▶│ analysis-api      │   │
│  │ .component.ts       │    │ .service.ts      │    │ .service.ts       │   │
│  └─────────────────────┘    └──────────────────┘    └───────────────────┘   │
│                                                              │               │
│  User clicks bubble or asks question                         │               │
│                                                              ▼               │
│                                              POST /api/research/insight      │
└─────────────────────────────────────────────────────────────────────────────┘
                                                               │
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                │
│                                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────────────────┐    │
│  │ research.controller │───▶│ research.service.ts                      │    │
│  │ .ts                 │    │                                          │    │
│  └─────────────────────┘    │  getInsight(request)                     │    │
│                             │    │                                     │    │
│                             │    ├─▶ Check Redis cache                 │    │
│                             │    │                                     │    │
│                             │    ├─▶ Fetch data from ES                │    │
│                             │    │   (via InsightDataService)          │    │
│                             │    │                                     │    │
│                             │    ├─▶ Build enhanced prompt             │    │
│                             │    │                                     │    │
│                             │    ├─▶ Call LLM API                      │    │
│                             │    │   (via LlmClientService)            │    │
│                             │    │                                     │    │
│                             │    └─▶ Cache & return response           │    │
│                             └──────────────────────────────────────────┘    │
│                                              │                               │
│                    ┌─────────────────────────┼─────────────────────────┐    │
│                    ▼                         ▼                         ▼    │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐│
│  │ insight-data        │    │ llm-client          │    │ Redis Cache      ││
│  │ .service.ts         │    │ .service.ts         │    │ (10 min TTL)     ││
│  │                     │    │                     │    │                  ││
│  │ Queries ES for:     │    │ • Anthropic Claude  │    │ Caches insights  ││
│  │ • Communications    │    │   (primary)         │    │ by context key   ││
│  │ • Social mentions   │    │ • OpenAI GPT-4      │    │                  ││
│  │ • Time series       │    │   (fallback)        │    │                  ││
│  │ • Journey stages    │    │ • Rate limiting     │    │                  ││
│  │ • Event correlations│    │                     │    │                  ││
│  └─────────────────────┘    └─────────────────────┘    └──────────────────┘│
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         ELASTICSEARCH                                │    │
│  │                                                                      │    │
│  │  journeyworks_communications  │  journeyworks_cases  │  journeyworks │    │
│  │  (complaints, calls, emails)  │  (support cases)     │  _nps_surveys │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Statistical Analysis Integration

For questions involving statistical concepts (outliers, correlations, distributions, trends), the system routes through the **Python Analysis Service** before calling the LLM. This hybrid approach provides:

- **Numerical precision** from pandas/scipy statistical methods
- **Business interpretation** from LLM natural language generation

### Statistical Question Detection

The system detects statistical questions using pattern matching:

```typescript
const STATISTICAL_PATTERNS = [
  /\b(outlier|anomal|unusual|abnormal)\b/i,
  /\b(correlat|relationship|associated with)\b/i,
  /\b(distribution|spread|concentration)\b/i,
  /\b(trend|increas|decreas|growing|declining)\b/i,
  /\b(average|mean|median|std|deviation|variance)\b/i,
  /\b(significant|statistic)\b/i,
];
```

### Example Statistical Questions

| Question Type     | Example                                                  | Python Analysis Provided                                      |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| **Outliers**      | "Are there any unusual patterns in this data?"           | Z-score and IQR outlier detection on sentiment, NPS, severity |
| **Correlations**  | "Is there a correlation between sentiment and NPS?"      | Pearson correlation coefficients between numeric fields       |
| **Distributions** | "What's the distribution of complaints across products?" | Categorical frequency analysis with concentration risk (HHI)  |
| **Trends**        | "Is complaint volume trending up or down?"               | Time series trend detection with change point identification  |

### Statistical Analysis Flow

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ User Question   │────▶│ isStatisticalQuestion│────▶│ Python Service  │
│ "Any outliers?" │     │ Pattern Detection    │     │ Port 8081       │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                               │
                        ┌──────────────────────┐               │
                        │ Statistical Results  │◀──────────────┘
                        │ • outliers[]         │
                        │ • correlations[]     │
                        │ • distributions[]    │
                        │ • temporalPatterns{} │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │ Enhanced LLM Prompt  │
                        │ Includes formatted   │
                        │ statistical section  │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │ LLM Response         │
                        │ Interprets stats in  │
                        │ business terms       │
                        └──────────────────────┘
```

### Statistical Analysis Result Structure

```typescript
interface StatisticalAnalysisResult {
  outliers: Array<{
    field: string; // e.g., "sentiment", "npsScore"
    count: number; // Number of outliers detected
    method: string; // "z-score" or "iqr"
    details: string; // Human-readable description
  }>;
  correlations: Array<{
    fields: [string, string]; // Field pair
    coefficient: number; // Pearson r (-1 to 1)
    strength: string; // "strong", "moderate", "weak"
  }>;
  distributions: Array<{
    field: string;
    topValues: Array<{ value: string; count: number; percentage: number }>;
    concentrationRisk: string; // HHI-based assessment
  }>;
  temporalPatterns: {
    trend: string; // "increasing", "decreasing", "stable"
    changePoints: Array<{ date: string; type: string; magnitude: number }>;
  } | null;
}
```

### Formatted Statistical Section in Prompt

When statistical analysis is available, it's included in the LLM prompt:

```
## Statistical Analysis (from Python service)

### Outlier Detection
- sentiment: Found 3 outliers via z-score method
- npsScore: Found 1 outliers via iqr method

### Correlations
- sentiment ↔ npsScore: 0.85 (strong positive)
- volume ↔ severity: -0.42 (moderate negative)

### Distributions
- product: mortgage (45%), credit-card (30%), savings (25%) - moderate concentration
- channel: phone (60%), email (25%), chat (15%) - high concentration

### Temporal Patterns
- Trend: increasing
- Change Points: 2026-01-15 (spike, 2.3x average), 2026-01-28 (drop, 0.4x average)
```

---

## RAG Integration (Semantic Search)

For questions seeking **specific communications or examples**, the system routes through the **RAG Service** which performs semantic (vector) search combined with keyword matching. This provides:

- **Relevant document retrieval** via hybrid search (BM25 + embeddings)
- **Cross-encoder reranking** for precision
- **LLM synthesis** of retrieved documents into coherent answers

### RAG Question Detection

The system detects RAG questions using pattern matching:

```typescript
const RAG_PATTERNS = [
  /\b(what (are|do|did) customers? (say|saying|said|complain|mention))\b/i,
  /\b(show me|find|search for|look for|examples? of)\b/i,
  /\b(specific|exactly|verbatim|quote|actual)\b/i,
  /\b(similar (to|cases?|issues?|complaints?))\b/i,
  /\b(customer.{1,20}(history|communications?|interactions?))\b/i,
  /\b(mention|mentioned|mentions|mentioning)\b/i,
  /\b(who (said|complained|mentioned|reported))\b/i,
  /\bcase (#?\d+|number)\b/i,
];
```

### Example RAG Questions

| Question Type          | Example                                                | What Happens                                        |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| **Customer verbatims** | "What are customers saying about our fees?"            | Semantic search for fee-related communications      |
| **Specific examples**  | "Show me examples of complaints about mobile app"      | Finds top matching complaints with excerpts         |
| **Similar cases**      | "Find cases similar to the card replacement issue"     | Vector similarity search for related communications |
| **Quote finding**      | "What specifically did customers mention about delays" | Returns actual customer quotes with context         |
| **Customer history**   | "What has this customer complained about before?"      | Retrieves customer's communication history          |

### Dashboard Filter Integration

**Critical**: RAG queries respect the dashboard's context filters:

```typescript
// Filters applied from AnalysisContext
const filters = {
  startDate: context.timeWindow?.start, // Date range from dashboard
  endDate: context.timeWindow?.end,
  channels: context.channel ? [context.channel] : undefined, // Channel filter
  product: context.product, // Product filter
};
```

This ensures that when a user asks "What are customers saying about fees?" while viewing:

- **Product**: Mortgage
- **Channel**: Phone
- **Date range**: Jan 1-31, 2026

...the RAG search only returns mortgage-related phone communications from January 2026.

### RAG Flow

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ User Question       │────▶│ isRagQuestion()     │────▶│ performRagQuery()   │
│ "Show me examples   │     │ Pattern Detection   │     │ with context filters│
│  of fee complaints" │     └─────────────────────┘     └──────────┬──────────┘
└─────────────────────┘                                            │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG Service Pipeline                               │
│                                                                              │
│  1. Hybrid Search (BM25 + Vector)  ──▶  2. Cross-Encoder Rerank  ──▶  3. LLM │
│     - Elasticsearch kNN                  - Python model-service       Answer │
│     - Respects date/product/channel      - Top K results                     │
│       filters                            - Precision boost                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                   │
                                                                   ▼
                        ┌─────────────────────────────────────────────────────┐
                        │ ResearchInsight Response                            │
                        │ • summary: LLM-synthesized answer                   │
                        │ • evidence: Actual communications found             │
                        │ • suggestedQuestions: Context-aware follow-ups      │
                        └─────────────────────────────────────────────────────┘
```

### RAG vs Statistical Questions

| Aspect           | Statistical Questions                   | RAG Questions                           |
| ---------------- | --------------------------------------- | --------------------------------------- |
| **Purpose**      | Aggregate analysis, patterns            | Specific lookups, examples              |
| **Data source**  | Python pandas/scipy                     | Elasticsearch vector search             |
| **Output**       | Numbers, trends, correlations           | Actual customer verbatims               |
| **Example**      | "Is there a trend in complaint volume?" | "What are customers complaining about?" |
| **Filter aware** | Yes (via aggregated data)               | Yes (via ES query filters)              |

---

## Data Flow

### Step 1: User Interaction

When a user clicks on a bubble in the timeline or asks a follow-up question:

```typescript
// Frontend: research-panel.component.ts
onChatSubmit() {
  this.dataService.askFollowUpQuestion(ctx, userMessage).subscribe({
    next: (insight) => {
      // Display formatted response
    }
  });
}
```

### Step 2: API Request

The frontend sends a POST request to `/api/research/insight`:

```json
{
  "context": {
    "timeWindow": {
      "start": "2026-01-29T00:00:00.000Z",
      "end": "2026-01-29T23:59:59.999Z"
    },
    "product": "mortgage",
    "channel": "chat",
    "selectedBubble": {
      "id": "bubble-28",
      "date": "2026-01-29T00:00:00.000Z",
      "themes": ["account-access", "communication"],
      "sentiment": 0.38,
      "npsScore": 30,
      "volume": 10
    }
  },
  "question": "Why did NPS drop in the post-resolution phase?",
  "useCache": false
}
```

### Step 3: Data Aggregation (InsightDataService)

The `InsightDataService` queries Elasticsearch to gather all relevant data:

```typescript
// insight-data.service.ts
async getInsightData(context: AnalysisContext): Promise<AggregatedInsightData> {
  const [
    communications,      // Customer complaints, calls, emails
    socialMentions,      // Twitter, Reddit, forum posts
    timeSeries,          // Daily NPS, sentiment, volume trends
    resolutionJourney,   // NPS by journey stage
    eventCorrelations,   // Before/during/after event impact
    summary,             // Aggregated statistics
  ] = await Promise.all([
    this.getRelevantCommunications(context, evidenceLimit),
    this.getRelevantSocialMentions(context, 5),
    this.getTimeSeriesMetrics(context),
    this.getResolutionJourney(context),
    this.getEventCorrelations(context),
    this.getSummaryMetrics(context),
  ]);

  return { communications, socialMentions, timeSeries, resolutionJourney, eventCorrelations, summary };
}
```

#### Data Retrieved

| Data Type              | Source                                       | Description                                                                              |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Communications**     | `journeyworks_communications`                | Actual customer verbatims (complaints, calls, emails) with sentiment scores              |
| **Social Mentions**    | `journeyworks_communications` (type: social) | Twitter, Reddit, forum posts about the brand                                             |
| **Time Series**        | Aggregated from communications               | Daily NPS, sentiment avg, volume, promoter/detractor percentages                         |
| **Resolution Journey** | Aggregated by `journeyStage` field           | NPS progression: Initial Contact → Triage → Investigation → Resolution → Post-Resolution |
| **Event Correlations** | Cross-referenced with events                 | Before/during/after metrics for incidents (outages, announcements)                       |
| **Summary Metrics**    | Aggregated                                   | Total counts, averages, top themes, top products                                         |

### Step 4: Prompt Construction (ResearchService)

The `buildEnhancedPrompt()` method creates a structured prompt with all the data:

```
## Summary Metrics for January 29, 2026
- Total Communications: 2
- Total Social Mentions: 0
- Average Sentiment: 0.50
- Average NPS: 50
- Promoter Rate: 50.0% | Passive Rate: 0.0% | Detractor Rate: 0.0%

## Top Themes
- account-access: 1 occurrences
- product-feature: 1 occurrences

## Resolution Journey Progression
| Stage | Sentiment | NPS | Volume | Avg Days | Promoter Conv. |
|-------|-----------|-----|--------|----------|----------------|
| Post-Resolution | -1.00 | -100 | 1 | 0.0 | 0.0% |

## Event Impact Analysis (Before/After)
### Third-Party Service Disruption (2026-01-25)
- Severity: medium
- Before: NPS -56, Sentiment 0.00, Volume 4
- During: NPS -34, Sentiment 0.25, Volume 17
- After: NPS 50, Sentiment 0.50, Volume 2
- **NPS Delta: +22**

## Sample Customer Communications
- [COMPLAINT] Case #9876 (Sentiment: 0.50): "The mortgage application process was straightforward..."

## User Question
What specific actions occur in the post-resolution phase that cause NPS to drop from 0 to -100?

## Required Output Format
{
  "summary": "2-3 sentence executive summary with specific numbers",
  "confidence": "high|medium|low",
  "keyDrivers": ["driver 1", "driver 2", "driver 3"],
  "timelineReasoning": "Explain temporal patterns...",
  "suggestedActions": ["action 1", "action 2", "action 3"],
  "suggestedQuestions": ["follow-up question 1", "follow-up question 2", "follow-up question 3"],
  "suggestedFollowUp": { "question": "...", "answer": "..." }
}
```

### Step 5: LLM Call (LlmClientService)

The prompt is sent to the LLM with a system prompt that establishes the analyst persona:

```typescript
// llm-client.service.ts
const systemPrompt = `You are an expert customer experience analyst for a financial services company.
You analyze customer feedback, complaints, and social media sentiment to provide actionable insights.
Always focus on NPS (Net Promoter Score) trends, Detractor/Promoter conversion, and early warning signals.
Be specific with numbers and percentages from the data provided. Recommend concrete actions.`;

const response = await this.llmClient.prompt(userPrompt, systemPrompt, {
  rateLimitKey: 'llm:insight',
});
```

#### LLM Provider Configuration

| Provider      | Model           | Role              |
| ------------- | --------------- | ----------------- |
| **Anthropic** | Claude Sonnet 4 | Primary provider  |
| **OpenAI**    | GPT-4o          | Fallback provider |

The system automatically falls back to OpenAI if Anthropic is unavailable or rate-limited.

### Step 6: Response Parsing

The LLM response (JSON) is parsed and combined with real evidence:

```typescript
const parsed = JSON.parse(jsonMatch[0]);

return {
  summary: parsed.summary,
  confidence: parsed.confidence || 'medium',
  keyDrivers: parsed.keyDrivers || [],
  evidence: [...data.communications, ...data.socialMentions], // Real data!
  timelineReasoning: parsed.timelineReasoning || '',
  suggestedActions: parsed.suggestedActions || [],
  suggestedQuestions: parsed.suggestedQuestions || [], // For next interaction
  suggestedFollowUp: parsed.suggestedFollowUp,
};
```

### Step 7: Caching

Results are cached in Redis with a 10-minute TTL:

```typescript
await this.cache.set(cacheKey, llmInsight, 600); // 600 seconds = 10 minutes
```

Cache keys are built from the context to ensure unique caching:

- Time window
- Selected bubble/event
- Product and channel filters

## Key Components

### Frontend

| File                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `research-panel.component.ts` | UI component with chat interface                             |
| `analysis-data.service.ts`    | Facade for API calls                                         |
| `analysis-api.service.ts`     | HTTP client for `/api/research/insight`                      |
| `analysis.model.ts`           | TypeScript interfaces (`ResearchInsight`, `AnalysisContext`) |

### Backend

| File                      | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `research.controller.ts`  | REST endpoint `/api/research/insight`                  |
| `research.service.ts`     | Orchestrates data fetching, prompt building, LLM calls |
| `insight-data.service.ts` | Elasticsearch queries for all data types               |
| `llm-client.service.ts`   | Unified LLM client with fallback                       |
| `anthropic.service.ts`    | Anthropic Claude API integration                       |
| `openai.service.ts`       | OpenAI GPT API integration                             |

## Integrated Services

| Service                                          | Usage                                                 | When Called                                |
| ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------ |
| **Python Analysis Service** (`analysis-service`) | Statistical analysis (outliers, correlations, trends) | When question matches statistical patterns |
| **RAG Service** (`rag.service.ts`)               | Semantic search for specific lookups and examples     | When question matches RAG patterns         |
| **Python Model Service** (`model-service`)       | Embeddings for vector search, cross-encoder reranking | During RAG hybrid search and reranking     |
| **Elasticsearch**                                | All customer data queries + vector search             | Every insight request                      |
| **LLM (Claude/GPT-4)**                           | Natural language insight generation                   | Every insight request                      |
| **Redis**                                        | Caching and rate limiting                             | Every insight request                      |

## What This System Does NOT Use

- **Pre-computed insights** - All insights are generated on-demand from real data

## Example Output

When a user asks "What specific actions occur in the post-resolution phase that cause NPS to drop from 0 to -100?":

```json
{
  "summary": "The post-resolution phase shows a catastrophic NPS drop from 0 to -100 with 1 communication recorded, indicating a complete customer satisfaction failure after case closure.",
  "confidence": "high",
  "keyDrivers": [
    "Post-resolution NPS collapse from 0 to -100 with negative sentiment (-1.00)",
    "Resolution journey shows -100 point NPS deterioration across phases",
    "Zero promoter conversion rate (0.0%) throughout entire customer journey",
    "Single post-resolution communication suggests inadequate follow-up processes"
  ],
  "timelineReasoning": "The resolution journey data reveals a critical failure pattern where customers experience complete satisfaction breakdown after case closure...",
  "suggestedActions": [
    "Implement mandatory 48-72 hour post-resolution satisfaction surveys",
    "Establish post-resolution monitoring protocols with automatic escalation triggers",
    "Review and redesign case closure procedures"
  ],
  "suggestedQuestions": [
    "What is the typical content of post-resolution communications that leads to such negative sentiment?",
    "Are there specific case types or products where post-resolution NPS drops are most severe?",
    "How does our post-resolution follow-up compare to industry best practices?"
  ]
}
```

## Performance Considerations

1. **Caching**: 10-minute TTL prevents redundant LLM calls for the same context
2. **Parallel Queries**: All Elasticsearch queries run in parallel via `Promise.all()`
3. **Rate Limiting**: Redis-based rate limiting prevents LLM API abuse
4. **Evidence Limiting**: Only top N communications/mentions are included (configurable)
5. **Fallback**: Automatic provider fallback ensures availability

## Configuration

Environment variables in `.env`:

```bash
# LLM Configuration
LLM_PRIMARY_PROVIDER=anthropic
LLM_FALLBACK_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9280

# Redis (for caching and rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6380
```

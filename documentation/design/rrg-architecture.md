# RRG (Retrieval-Reranking-Generation) Architecture

This document explains how the RRG service translates natural language queries into Elasticsearch DSL for the JourneyWorks customer intelligence platform.

## Overview

RRG (Retrieval-Reranking-Generation) enables users to search customer data using natural language instead of constructing complex queries manually. The system:

1. Parses natural language queries using an LLM to extract intent and entities
2. Maps user terminology to index fields using a domain glossary
3. Builds optimized Elasticsearch DSL queries
4. Optionally executes and summarizes results

**Example Transformation:**

```
User: "Show me angry customers who called about fees last month"
         ↓
Elasticsearch DSL:
{
  "bool": {
    "must": [
      { "match": { "content": "fee charge cost" } },
      { "term": { "sentiment.label": "negative" } },
      { "term": { "channel": "phone" } },
      { "range": { "timestamp": { "gte": "now-1M/M", "lt": "now/M" } } }
    ]
  }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Angular)                              │
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │ Search Bar /        │───▶  POST /api/rrg/query                           │
│  │ Research Panel      │      { query: "angry customers about fees" }       │
│  └─────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                │
│                                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────────────────┐    │
│  │ rrg.controller.ts   │───▶│ rrg.service.ts                           │    │
│  │                     │    │                                          │    │
│  │ POST /rrg/query     │    │  query(request)                          │    │
│  │ POST /rrg/explain   │    │    │                                     │    │
│  │ POST /rrg/refine    │    │    ├─▶ Check Redis cache                 │    │
│  └─────────────────────┘    │    │                                     │    │
│                             │    ├─▶ Parse NL with LLM                 │    │
│                             │    │   (system:rrg prompt + glossary)    │    │
│                             │    │                                     │    │
│                             │    ├─▶ Build DSL via QueryBuilder        │    │
│                             │    │                                     │    │
│                             │    ├─▶ Execute (optional)                │    │
│                             │    │                                     │    │
│                             │    └─▶ Summarize results (optional)      │    │
│                             └──────────────────────────────────────────┘    │
│                                              │                               │
│                    ┌─────────────────────────┼─────────────────────────┐    │
│                    ▼                         ▼                         ▼    │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐│
│  │ query-builder       │    │ LlmClientService    │    │ Redis Cache      ││
│  │ .service.ts         │    │                     │    │ (5 min TTL)      ││
│  │                     │    │ Uses prompts:       │    │                  ││
│  │ • Schema-aware      │    │ • system:rrg        │    │ Caches parsed    ││
│  │ • Builds bool/match │    │ • rrg:nl_to_dsl     │    │ intents by query ││
│  │ • Adds aggregations │    │ • rrg:dsl_refinement│    │                  ││
│  │ • Validates DSL     │    │                     │    │                  ││
│  └─────────────────────┘    └─────────────────────┘    └──────────────────┘│
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Domain Glossary                              │    │
│  │                     prompts/rrg/glossary.ts                          │    │
│  │                                                                      │    │
│  │  Sentiment: angry→negative | Channel: call→phone | Synonyms: fee    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELASTICSEARCH                                   │
│                                                                              │
│  journeyworks_communications  │  journeyworks_cases  │  social-mentions     │
│  (emails, calls, chats)       │  (support tickets)   │  (twitter, reddit)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## RRG Pipeline

### Step 1: Parse Natural Language Query

The LLM extracts structured intent from the user's query:

```typescript
// Input
{ query: "angry customers who called about fees last month" }

// LLM Output (ParsedIntent)
{
  "intent": "search",
  "entities": {
    "sentiments": ["negative"],
    "channels": ["phone"],
    "topics": ["fees", "charges"]
  },
  "timeRange": {
    "relative": "last month"
  },
  "filters": [],
  "aggregations": [],
  "confidence": 0.92
}
```

### Step 2: Apply Domain Glossary

The glossary maps user language to index values:

| User Says                      | Maps To                          |
| ------------------------------ | -------------------------------- |
| "angry", "upset", "frustrated" | `sentiment.label: negative`      |
| "called", "phone", "voice"     | `channel: phone`                 |
| "fees", "charges", "costs"     | Expanded search terms            |
| "last month"                   | `timestamp: { gte: "now-1M/M" }` |

```typescript
// Glossary applied during prompt construction
const glossary = formatGlossaryForPrompt();
// Includes: sentiment mappings, channel mappings, domain synonyms
```

### Step 3: Build Elasticsearch DSL

The `QueryBuilder` converts parsed intent to valid DSL:

```typescript
// Generated DSL
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "fee fees charge charges cost costs",
            "fields": ["content^2", "subject", "summary"],
            "type": "best_fields"
          }
        }
      ],
      "filter": [
        { "term": { "sentiment.label": "negative" } },
        { "term": { "channel": "phone" } },
        {
          "range": {
            "timestamp": {
              "gte": "now-1M/M",
              "lt": "now/M"
            }
          }
        }
      ]
    }
  },
  "size": 20,
  "sort": [{ "timestamp": "desc" }],
  "_source": ["id", "content", "sentiment", "channel", "timestamp", "customerName"]
}
```

### Step 4: Execute & Summarize (Optional)

If `execute: true`, the query runs and results are summarized:

```typescript
{
  "dsl": { /* the generated query */ },
  "results": {
    "total": 47,
    "hits": [ /* matching documents */ ]
  },
  "executionTime": 23,
  "summary": "Found 47 phone communications from customers expressing
              frustration about fees and charges in January 2026.
              The most common issues were overdraft fees (18) and
              late payment charges (12)."
}
```

---

## Domain Glossary

The glossary (`prompts/rrg/glossary.ts`) provides domain-specific mappings:

### Sentiment Mappings

```typescript
SENTIMENT_MAPPINGS = {
  positive: ['happy', 'pleased', 'satisfied', 'grateful', 'delighted', ...],
  negative: ['angry', 'upset', 'frustrated', 'annoyed', 'disappointed', ...],
  neutral:  ['okay', 'fine', 'normal', 'standard', ...],
  mixed:    ['conflicted', 'ambivalent', ...]
}
```

### Channel Mappings

```typescript
CHANNEL_MAPPINGS = {
  email: ['email', 'e-mail', 'mail', 'inbox'],
  phone: ['phone', 'call', 'calls', 'telephone', 'voice', 'rang'],
  chat: ['chat', 'live chat', 'webchat', 'instant message'],
  letter: ['letter', 'mail', 'post', 'postal', 'correspondence'],
  social: ['social', 'twitter', 'x', 'facebook', 'linkedin', 'tweet'],
};
```

### Domain Synonyms (Financial Services)

```typescript
DOMAIN_SYNONYMS = {
  fee: ['fee', 'charge', 'cost', 'rate', 'price'],
  fraud: ['fraud', 'unauthorized', 'stolen', 'scam', 'phishing'],
  transfer: ['transfer', 'wire', 'send', 'payment', 'remittance'],
  churn: ['churn', 'leaving', 'cancelled', 'closed account', 'attrition'],
  // ... more
};
```

### Time Expressions

```typescript
TIME_EXPRESSIONS = {
  today: { unit: 'day', value: 0 },
  yesterday: { unit: 'day', value: 1 },
  'last week': { unit: 'week', value: 1 },
  'last month': { unit: 'month', value: 1 },
  'past 30 days': { unit: 'day', value: 30 },
  // ... more
};
```

---

## Query Builder

The `QueryBuilder` service converts parsed intents to DSL with schema awareness:

### Schema Awareness

```typescript
// Known index schemas
schemas = {
  communications: {
    fields: [
      { name: 'content', type: 'text', searchable: true },
      { name: 'channel', type: 'keyword', values: ['email', 'phone', 'chat'] },
      {
        name: 'sentiment.label',
        type: 'keyword',
        values: ['positive', 'negative', 'neutral'],
      },
      { name: 'timestamp', type: 'date' },
      // ...
    ],
  },
};
```

### Query Type Selection

| Field Type | Query Type              | Example            |
| ---------- | ----------------------- | ------------------ |
| `text`     | `match` / `multi_match` | Content search     |
| `keyword`  | `term` / `terms`        | Exact value filter |
| `date`     | `range`                 | Time range filter  |
| `nested`   | `nested` query          | Complex objects    |

### Aggregation Support

When the query implies statistics, aggregations are added:

```typescript
// User: "How many complaints per channel?"
{
  "aggs": {
    "channel_breakdown": {
      "terms": { "field": "channel", "size": 10 }
    }
  }
}
```

---

## Prompt Templates

### System Prompt: RRG Translator

```
prompts/system/rrg.prompt.ts
```

Establishes the LLM persona for query translation:

```
You are an expert at translating natural language queries into
structured search queries. Your role is to:

1. Understand the user's intent from their natural language query
2. Identify relevant fields, filters, and search parameters
3. Generate optimized query structures
4. Handle ambiguity by including relevant alternatives
```

### NL to DSL Prompt

```
prompts/rrg/nl-to-dsl.prompt.ts
```

The main translation prompt with:

- Index schema context
- Domain glossary
- Few-shot examples
- Output format specification

### DSL Refinement Prompt

```
prompts/rrg/dsl-refinement.prompt.ts
```

Used for iterative query improvement based on:

- Initial results
- User feedback
- Too few/too many results

---

## API Endpoints

### POST /api/rrg/query

Main endpoint for NL to DSL translation:

```typescript
// Request
{
  "query": "angry customers about fees last month",
  "index": "communications",
  "execute": true,
  "validate": true
}

// Response
{
  "dsl": {
    "interpretation": "Search for negative sentiment phone communications about fees",
    "query": { /* Elasticsearch DSL */ },
    "explanation": "Added sentiment filter for 'angry', channel filter for 'phone'"
  },
  "results": { /* if execute: true */ },
  "summary": "Found 47 matching communications..."
}
```

### POST /api/rrg/explain

Explains a generated query in natural language:

```typescript
// Request
{ "dsl": { /* query to explain */ } }

// Response
{
  "explanation": "This query searches for communications where:\n
                  - Content contains 'fee' or related terms\n
                  - Sentiment is negative\n
                  - Channel is phone\n
                  - Date is within last month"
}
```

### POST /api/rrg/refine

Refines a query based on feedback:

```typescript
// Request
{
  "originalQuery": "angry customers about fees",
  "currentDsl": { /* current query */ },
  "feedback": "Include email as well, not just phone"
}

// Response
{
  "refinedDsl": { /* updated query with email included */ },
  "changes": ["Added 'email' to channel filter"],
  "explanation": "Expanded channel filter to include both phone and email"
}
```

---

## Caching Strategy

### Parsed Intent Cache

```typescript
// Cache key: base64 of query (truncated)
cacheKey = `rrg:parse:${base64(query).substring(0, 50)}`;

// TTL: 5 minutes
// Rationale: Same query = same intent, but user may want fresh results
```

### When Cache is Bypassed

- Query includes time-relative terms ("today", "this week")
- User explicitly requests fresh results
- Query context has changed

---

## Error Handling

### Graceful Fallbacks

```typescript
// If LLM fails to parse
return {
  intent: 'search',
  entities: {},
  filters: [],
  aggregations: [],
  confidence: 0.5, // Low confidence signals fallback
};
```

### Query Validation

```typescript
const validation = queryBuilder.validateQuery(dsl, index);
if (!validation.valid) {
  logger.warn(`Query validation warnings: ${validation.errors.join(', ')}`);
  // Continue but log issues
}
```

---

## Performance Considerations

| Aspect              | Strategy                                   |
| ------------------- | ------------------------------------------ |
| **LLM Latency**     | Cache parsed intents for 5 min             |
| **Token Usage**     | Compact glossary format for prompts        |
| **Prompt Size**     | Schema + glossary + examples ≈ 1500 tokens |
| **Query Execution** | Optional via `execute` flag                |

---

## Integration Points

### With RAG Service

RRG can pre-filter documents before semantic search:

```typescript
// RRG provides structured filters
const rrgFilters = await rrgService.parseFilters(query);

// RAG uses filters for scoped vector search
const results = await ragService.query({
  question: query,
  filters: rrgFilters, // Scope vector search
});
```

### With Research Service

RRG powers the natural language search in the research panel:

```typescript
// Research panel uses RRG for query translation
const { dsl, results } = await rrgService.query({
  query: userQuestion,
  execute: true,
});
```

---

## Future Enhancements

1. **Learning from Feedback**: Store successful query patterns for improved translations
2. **Query Suggestions**: Auto-complete based on index content
3. **Multi-Index Queries**: Search across communications, cases, and social simultaneously
4. **Saved Queries**: Save and share NL→DSL translations
5. **Query History**: Track and replay previous searches

---

## Related Documentation

- [LLM Insights Architecture](./llm-insights-architecture.md) - Overall LLM integration
- [Prompts Documentation](../../journeyworks-api/src/infrastructure/llm/prompts/README.md) - Prompt templates
- [RAG Service Design](./rag-service-design.md) - Semantic search integration

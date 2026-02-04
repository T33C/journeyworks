# RAG Service Documentation

This document describes the Retrieval-Augmented Generation (RAG) service used in JourneyWorks for intelligent document search and question answering.

## Overview

The RAG service enables semantic search and intelligent question answering over customer communications. It implements a multi-stage retrieval pipeline with:

1. **Hybrid Search** - Combines BM25 (keyword) and vector (semantic) search
2. **Cross-Encoder Reranking** - Improves precision using a reranker model
3. **LLM Generation** - Synthesizes answers from retrieved documents
4. **Contextual Chunking** - Adds context to document chunks for better retrieval

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RAG Query Flow                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Query ──▶ Hybrid Search ──▶ Rerank ──▶ Generate Answer                │
│              │                  │              │                        │
│              ▼                  ▼              ▼                        │
│        ┌──────────┐      ┌──────────┐   ┌──────────┐                   │
│        │ BM25     │      │ Cross-   │   │ Claude   │                   │
│        │ +        │      │ Encoder  │   │ LLM      │                   │
│        │ kNN      │      │ Model    │   │          │                   │
│        └──────────┘      └──────────┘   └──────────┘                   │
│             │                                                           │
│             ▼                                                           │
│     ┌───────────────┐                                                   │
│     │ Elasticsearch │                                                   │
│     │ (vectors +    │                                                   │
│     │  full-text)   │                                                   │
│     └───────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### RagService

**Location:** `journeyworks-api/src/modules/rag/rag.service.ts`

Main service orchestrating the RAG pipeline.

**Key Methods:**

| Method                                        | Description                                |
| --------------------------------------------- | ------------------------------------------ |
| `query(request)`                              | Full RAG query with retrieval + generation |
| `semanticSearch(query, topK, filters)`        | Search only, no generation                 |
| `findSimilar(documentId, topK)`               | Find documents similar to a given document |
| `askAboutCustomer(customerId, question)`      | Customer-specific Q&A                      |
| `summarizeCustomerCommunications(customerId)` | Generate customer summary                  |

**Configuration:**

| Config Key       | Default | Description                                                |
| ---------------- | ------- | ---------------------------------------------------------- |
| `rag.topK`       | 20      | Number of documents to retrieve (per Anthropic's research) |
| `rag.rerankTopK` | 10      | Documents to keep after reranking                          |
| `rag.minScore`   | 0.5     | Minimum relevance score threshold                          |

### ContextualChunker

**Location:** `journeyworks-api/src/modules/rag/contextual-chunker.service.ts`

Implements Anthropic's contextual retrieval approach by adding context prefixes to document chunks.

**Key Methods:**

| Method                                          | Description                |
| ----------------------------------------------- | -------------------------- |
| `chunkDocument(id, content, metadata)`          | Split document into chunks |
| `contextualizeChunks(chunks, fullDoc, summary)` | Add contextual prefixes    |

**Configuration:**

| Config Key         | Default | Description                 |
| ------------------ | ------- | --------------------------- |
| `rag.chunkSize`    | 512     | Target chunk size in tokens |
| `rag.chunkOverlap` | 50      | Overlap between chunks      |
| `rag.minChunkSize` | 100     | Minimum chunk size          |

### Hybrid Search

**Location:** `journeyworks-api/src/modules/communications/communications.repository.ts`

Combines:

- **Dense kNN**: Semantic similarity using 768-dim embeddings (all-MiniLM-L6-v2)
- **SPLADE sparse**: Learned sparse embeddings (naver/splade-cocondenser-ensembledistil)

**Weights:** 30% text, 70% vector (configurable)

Unlike traditional BM25, SPLADE provides:

- Exact keyword matching
- Semantic term expansion (learned synonyms)
- Query expansion for better recall

---

## API Endpoints

### POST /api/rag/query

Full RAG query with answer generation.

**Request:**

```json
{
  "query": "What issues have customers reported about mobile app crashes?",
  "topK": 10,
  "filters": {
    "channels": ["email", "chat"],
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  },
  "useReranking": true
}
```

**Response:**

```json
{
  "query": "What issues have customers reported...",
  "answer": "Based on the communications, customers have reported...",
  "confidence": 0.85,
  "results": [
    {
      "document": {
        "id": "comm-123",
        "content": "...",
        "metadata": {...}
      },
      "score": 0.92,
      "rerankScore": 0.88
    }
  ],
  "sources": [
    {
      "id": "comm-123",
      "relevance": "Describes mobile app crash",
      "excerpt": "..."
    }
  ],
  "processingTime": 1250
}
```

### POST /api/rag/search

Semantic search without generation.

**Request:**

```json
{
  "query": "billing disputes",
  "topK": 20,
  "filters": {
    "sentiments": ["negative", "very_negative"]
  }
}
```

### GET /api/rag/similar/:documentId

Find similar documents.

**Parameters:**

- `documentId` (path): Source document ID
- `topK` (query, optional): Number of results (default 5)

### POST /api/rag/customer/:customerId/ask

Ask a question about a specific customer.

**Request:**

```json
{
  "question": "What are this customer's main concerns?"
}
```

### GET /api/rag/customer/:customerId/summary

Get a summary of customer communications.

**Parameters:**

- `customerId` (path): Customer ID
- `maxCommunications` (query, optional): Max docs to consider

---

## Pipeline Details

### 1. Retrieval Stage

The hybrid search combines two approaches:

**BM25 (Keyword Matching)**

```javascript
{
  multi_match: {
    query: "mobile app crashes",
    fields: ["content^2", "subject^1.5", "summary"],
    type: "best_fields"
  }
}
```

**kNN (Semantic Similarity)**

```javascript
{
  field: "embedding",
  query_vector: [0.1, 0.2, ...], // 768 dimensions
  k: 10,
  num_candidates: 100
}
```

Elasticsearch combines results using rank fusion.

### 2. Reranking Stage

When `useReranking: true`, results are passed through a cross-encoder model for more accurate relevance scoring.

**Process:**

1. Take top-N candidates from hybrid search (default: 2x final count)
2. Score each (query, document) pair with cross-encoder
3. Return top-K by rerank score

**Model:** Uses the model service's reranker endpoint (`POST /rerank`)

### 3. Generation Stage

Retrieved documents are formatted with metadata and passed to the LLM:

```
Document 1 [ID: comm-123]:
Source: communication | Channel: email | Customer: John Smith
Date: 2026-01-15 | Sentiment: negative
Content:
I've been experiencing repeated crashes in the mobile app...
---

Document 2 [ID: comm-456]:
...
```

The LLM generates a structured response with:

- Answer to the query
- Confidence score
- Source citations

---

## Conformance to Anthropic's Contextual RAG

This section analyzes how the JourneyWorks RAG implementation aligns with [Anthropic's Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) best practices.

### ✅ Implemented Principles

| Principle                          | Status  | Implementation                                                            |
| ---------------------------------- | ------- | ------------------------------------------------------------------------- |
| **Hybrid Search (Dense + Sparse)** | ✅ Full | Elasticsearch combines kNN (dense) with SPLADE sparse embeddings          |
| **SPLADE over BM25**               | ✅ Full | Uses learned sparse embeddings (SPLADE) which outperform traditional BM25 |
| **Reranking**                      | ✅ Full | Cross-encoder reranking via model service                                 |
| **Top-20 Retrieval**               | ✅ Full | Default topK=20, rerankTopK=10 per Anthropic's research                   |
| **Contextual Chunking**            | ✅ Full | `ContextualChunker` generates LLM-powered context prefixes                |
| **Prompt Caching**                 | ✅ Full | Uses Claude's prompt caching for efficient multi-chunk contextualization  |
| **Metadata Preservation**          | ✅ Full | Source, channel, customer, timestamp, sentiment tracked                   |

### Cost Efficiency with Prompt Caching

When contextualizing multiple chunks from the same document, the full document is cached after the first API call:

```
First chunk:  Full document sent → Cached (cache_creation_input_tokens)
Second chunk: Cached document reused → 90% cost reduction (cache_read_input_tokens)
Third chunk:  Cached document reused → 90% cost reduction
...
```

For a document with 10 chunks:

- **Without caching**: 10× document tokens sent
- **With caching**: 1× document tokens + 9× cache reads (90% cheaper)

### Configuration

Per Anthropic's research findings:

```typescript
// In rag.service.ts
this.topK = 20; // Top-20 performs best
this.rerankTopK = 10; // Keep top-10 after reranking
```

### Why SPLADE over BM25?

JourneyWorks uses SPLADE (Sparse Lexical and Expansion) instead of traditional BM25:

| Feature                | BM25 | SPLADE                         |
| ---------------------- | ---- | ------------------------------ |
| Exact matching         | ✅   | ✅                             |
| Term expansion         | ❌   | ✅ (learned synonyms)          |
| Semantic understanding | ❌   | ✅ (trained on semantic tasks) |
| Query expansion        | ❌   | ✅ (adds related terms)        |
| Elasticsearch native   | ✅   | ✅ (sparse_vector field)       |

SPLADE provides the keyword matching benefits of BM25 while also understanding semantic relationships, making it superior for hybrid search.

---

## Performance Considerations

### Latency Breakdown

| Stage           | Typical Time | Notes                      |
| --------------- | ------------ | -------------------------- |
| Embedding query | ~50ms        | Single text embedding      |
| Hybrid search   | ~100-200ms   | Elasticsearch query        |
| Reranking       | ~200-500ms   | Depends on candidate count |
| LLM generation  | ~1-3s        | Varies by response length  |

### Optimization Tips

1. **Batch Reranking**: Process all candidates in one API call
2. **Cache Embeddings**: Query embeddings can be cached for repeated queries
3. **Pre-filter**: Use Elasticsearch filters to reduce candidate set before kNN
4. **Limit Rerank Candidates**: Default 2x topK, can reduce for speed

---

## Testing

### Manual Testing

```bash
# Full RAG query
curl -X POST http://localhost:3080/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the most common customer complaints?",
    "topK": 10,
    "useReranking": true
  }'

# Semantic search only
curl -X POST http://localhost:3080/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "payment processing issues", "topK": 20}'

# Similar documents
curl http://localhost:3080/api/rag/similar/comm-123?topK=5

# Customer Q&A
curl -X POST http://localhost:3080/api/rag/customer/cust-456/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What products is this customer interested in?"}'
```

---

## Dependencies

| Service       | Port | Purpose                |
| ------------- | ---- | ---------------------- |
| Elasticsearch | 9280 | Vector + text storage  |
| Model Service | 8080 | Embeddings + reranking |
| LLM Service   | -    | Answer generation      |

---

## Related Documentation

- [Data Population Guide](data-population.md) - Generating embeddings
- [Model Service](../python/model-service/README.md) - Embedding models
- [LLM Insights Architecture](design/llm-insights-architecture.md) - System design

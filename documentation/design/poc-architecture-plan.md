# JourneyWorks PoC Architecture Plan

## Executive Summary

This document outlines the high-level architecture and implementation plan for the JourneyWorks Proof of Concept (PoC) - an AI-powered Customer Communications Analysis Platform for investment banking. The system will analyze customer communications (direct and indirect via social media) to provide intelligent insights into customer relationships, enabling the bank to improve customer journeys.

**Repository:** https://github.com/T33C/journeyworks

### Key Decisions

- **LLM Provider:** Anthropic Claude (primary), OpenAI GPT-4o (fallback)
- **Synthetic Data:** 2000-5000 communications across 300-500 cases
- **Communication Formats:** Email, phone transcripts, chat app, occasional letters
- **Social Media:** Included (Twitter/X, etc.)
- **UI Migration:** Direct migration from demo-app (demo-app folder is READ-ONLY)
- **Authentication:** Not required for PoC
- **Caching:** Redis for aggregations and LLM rate limiting
- **Observability:** OpenTelemetry for distributed tracing

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              JOURNEYWORKS PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────┐     ┌──────────────────────────────────────────────┐   │
│  │   journeyworks-ui   │────▶│             journeyworks-api                 │   │
│  │   (Angular 19)      │     │               (NestJS)                        │   │
│  │   Port: 4200        │     │             Port: 3000                        │   │
│  └─────────────────────┘     └──────────────────────────────────────────────┘   │
│                                          │                                        │
│                    ┌─────────────────────┼─────────────────────┐                 │
│                    │                     │                     │                  │
│                    ▼                     ▼                     ▼                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────────┐  │
│  │   Elasticsearch      │  │   analysis-service   │  │   model-service       │  │
│  │   Port: 9200         │  │   (FastAPI/Python)   │  │   (FastAPI/Python)    │  │
│  │   - Documents        │  │   Port: 8001         │  │   Port: 8000          │  │
│  │   - Vectors          │  │   - Data Cards       │  │   - Dense Embeddings  │  │
│  │   - Aggregations     │  │   - Statistics       │  │   - Sparse Embeddings │  │
│  └──────────────────────┘  └──────────────────────┘  │   - Reranking         │  │
│                                                       └───────────────────────┘  │
│                                                                                   │
│  ┌───────────────────────┐                                                     │
│  │       Redis           │                                                     │
│  │   Port: TBD           │                                                     │
│  │   - Query caching     │                                                     │
│  │   - Rate limiting     │                                                     │
│  │   - Session state     │                                                     │
│  └───────────────────────┘                                                     │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │              LLM Integration (Anthropic Claude / OpenAI GPT-4o)            │   │
│  │  - ReAct Agent Loop                                                        │   │
│  │  - Contextual RAG (via model-service embeddings + Elasticsearch vectors)  │   │
│  │  - RRG (NL → DSL for Elasticsearch queries)                                │   │
│  │  - Data Card Reasoning (via analysis-service)                              │   │
│  │  - OpenTelemetry tracing for observability                                 │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 journeyworks-ui (Angular Frontend)

**Purpose:** Interactive analysis dashboard for customer intelligence

**Key Features (from demo-app):**

- Global filters bar (date range, product, channel, event overlay)
- Three coordinated charts:
  - Sentiment-Weighted Event Timeline (bubbles + events)
  - Sentiment Journey Waterfall (customer journey stages)
  - Volume vs Sentiment Quadrant (risk identification)
- AI Research Panel (right side):
  - Research summary with confidence scoring
  - Evidence section (expandable)
  - Timeline reasoning
  - Conversational chat input

### 2.2 journeyworks-api (NestJS Backend)

**Purpose:** API gateway orchestrating all services and AI capabilities

**Key Responsibilities:**

- REST API endpoints for UI
- WebSocket support for streaming AI responses
- ReAct agent orchestration
- RAG/RRG skill coordination
- Elasticsearch query building
- Service integration (model-service, analysis-service)

### 2.3 Elasticsearch

**Purpose:** Primary data store and vector search engine

**Indices:**

- `communications` - Customer communications with metadata
- `communications_vectors` - Dense/sparse embeddings for RAG
- `events` - Bank events (outages, launches, etc.)
- `social_mentions` - Social media mentions

### 2.4 model-service (Python/FastAPI) - EXISTING

**Purpose:** Embedding and reranking for Contextual RAG

**Endpoints (already implemented):**

- `POST /embed/dense` - Single dense embedding (BGE)
- `POST /embed/dense/batch` - Batch dense embeddings
- `POST /embed/sparse` - Single sparse embedding (SPLADE)
- `POST /embed/sparse/batch` - Batch sparse embeddings
- `POST /rerank` - Cross-encoder reranking

### 2.5 analysis-service (Python/FastAPI) - EXISTING

**Purpose:** Statistical analysis and data card generation

**Endpoints (already implemented):**

- `POST /api/v1/analyze/dataset` - Generate DataCard with statistics

---

## 3. Data Models & DTOs

### 3.1 Core Communication Entity

```typescript
// Shared between frontend and backend

interface Communication {
  id: string;
  externalId: string; // Original system ID

  // Customer info
  customerId: string;
  customerName: string;
  customerSegment: CustomerSegment; // retail | wealth | corporate

  // Communication metadata
  channel: ChannelType; // email | phone | chat | letter | social
  direction: 'inbound' | 'outbound';
  timestamp: Date;

  // Content
  subject?: string;
  content: string;
  contentSummary?: string; // LLM-generated summary

  // Classification (LLM-extracted)
  classification: CommunicationClassification;

  // Sentiment
  sentiment: SentimentAnalysis;

  // Relationships
  threadId?: string; // For conversation threading
  parentId?: string; // For replies
  caseId?: string; // Link to complaint case

  // Vectors (stored in ES)
  denseEmbedding?: number[];
  sparseEmbedding?: Record<string, number>;

  // Contextual RAG chunks
  contextualChunks?: ContextualChunk[];

  // Audit
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  processingStatus: ProcessingStatus;
}

interface CommunicationClassification {
  product: ProductType;
  productConfidence: number;

  category: CategoryType;
  categoryConfidence: number;

  issueType: string;
  issueTypeConfidence: number;

  urgency: 'low' | 'medium' | 'high' | 'critical';

  regulatoryFlags: RegulatoryFlag[];

  rootCause?: string;
  suggestedAction?: string;

  topics: string[]; // Extracted topics/themes
  entities: ExtractedEntity[]; // Named entities

  // LLM metadata
  modelUsed: string;
  classifiedAt: Date;
}

interface SentimentAnalysis {
  overall: number; // -1 to +1
  confidence: number;

  // Aspect-based sentiment
  aspects: AspectSentiment[];

  // Emotion detection
  emotions: EmotionScore[];

  // NPS prediction (if applicable)
  npsCategory?: 'promoter' | 'passive' | 'detractor';
  npsPredictedScore?: number;
}

interface AspectSentiment {
  aspect: string; // e.g., "customer service", "pricing", "app usability"
  sentiment: number;
  mentions: number;
}

interface EmotionScore {
  emotion: 'anger' | 'frustration' | 'satisfaction' | 'confusion' | 'neutral';
  score: number;
}

// Contextual RAG chunk (Anthropic's approach)
interface ContextualChunk {
  chunkId: string;
  content: string;
  context: string; // LLM-generated context explaining chunk
  position: number;
  denseEmbedding?: number[];
  sparseEmbedding?: Record<string, number>;
}
```

### 3.2 Case/Complaint Entity

```typescript
interface Case {
  id: string;
  externalId: string;

  // Customer
  customerId: string;
  customerName: string;
  customerSegment: CustomerSegment;

  // Case details
  status: CaseStatus;
  severity: SeverityType;
  priority: number;

  // Classification
  product: ProductType;
  category: CategoryType;
  issueType: string;

  // Content
  summary: string;
  rootCause?: string;
  resolution?: string;

  // Assignment
  assignedTo?: string;
  team?: string;

  // Sentiment journey
  sentimentJourney: JourneySentiment[];
  currentSentiment: number;
  sentimentTrend: 'improving' | 'stable' | 'declining';

  // Regulatory
  regulatoryFlags: RegulatoryFlag[];
  isEscalated: boolean;
  escalationReason?: string;

  // Related
  communications: string[]; // Communication IDs
  relatedCases?: string[];
  relatedEvents?: string[];

  // Timelines
  createdAt: Date;
  updatedAt: Date;
  targetResolutionDate?: Date;
  resolvedAt?: Date;

  // AI analysis
  aiInsight?: AIInsight;
}

interface JourneySentiment {
  stage: JourneyStage;
  sentiment: number;
  timestamp: Date;
  communicationCount: number;
}

type JourneyStage =
  | 'initial-contact'
  | 'triage'
  | 'investigation'
  | 'resolution'
  | 'post-resolution';

interface AIInsight {
  summary: string;
  keyDrivers: string[];
  riskFactors: string[];
  suggestedActions: string[];
  confidence: 'high' | 'medium' | 'low';
  generatedAt: Date;
}
```

### 3.3 Timeline Event Entity

```typescript
interface TimelineEvent {
  id: string;

  // Event details
  type: EventType;
  label: string;
  description: string;

  // Timing
  startDate: Date;
  endDate?: Date; // For events with duration

  // Scope
  product?: ProductType;
  channels?: ChannelType[];
  affectedRegions?: string[];

  // Impact
  severity: SeverityType;
  estimatedImpact?: {
    customersAffected: number;
    communicationIncrease: number; // Percentage
    sentimentImpact: number; // Expected sentiment change
  };

  // Status
  status: 'active' | 'resolved' | 'monitoring';

  // Correlation
  correlatedCommunications?: number; // Count of related comms
  sentimentDuringEvent?: number; // Avg sentiment

  // Metadata
  source: string; // How was this event registered
  createdAt: Date;
  updatedAt: Date;
}

type EventType =
  | 'outage'
  | 'launch'
  | 'issue'
  | 'resolution'
  | 'announcement'
  | 'regulatory'
  | 'maintenance';
```

### 3.4 Analysis & Dashboard DTOs

```typescript
// Request to analysis canvas
interface AnalysisRequest {
  filters: FilterState;

  // Specific analysis type
  analysisType: 'timeline' | 'journey' | 'quadrant' | 'overview';

  // Optional focus context
  context?: AnalysisContext;
}

interface FilterState {
  dateRange: {
    start: Date;
    end: Date;
  };
  products: ProductType[];
  channels: ChannelType[];
  categories?: CategoryType[];
  severities?: SeverityType[];
  customerSegments?: CustomerSegment[];
  showEvents: boolean;
}

// Timeline chart data
interface TimelineAnalysis {
  bubbles: SentimentBubble[];
  events: TimelineEvent[];
  socialBand: SocialSentimentBand[];
  summary: TimelineSummary;
}

interface SentimentBubble {
  id: string;
  date: Date;

  // Volume & sentiment
  volume: number;
  sentiment: number;
  socialSentiment: number;

  // Breakdown
  channelBreakdown: Record<ChannelType, number>;
  productBreakdown: Record<ProductType, number>;

  // Themes
  themes: ThemeSummary[];

  // NPS
  nps: {
    score: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
  };
}

interface ThemeSummary {
  theme: string;
  count: number;
  sentiment: number;
  trend: 'rising' | 'stable' | 'falling';
}

// Journey waterfall data
interface JourneyAnalysis {
  stages: JourneyStageData[];
  overallSentimentChange: number;
  criticalDropPoints: string[];
}

interface JourneyStageData {
  stage: JourneyStage;
  label: string;
  sentiment: number;
  previousSentiment: number;
  change: number;
  communicationCount: number;
  avgResolutionTime?: number;
  nps: {
    score: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
  };
}

// Quadrant chart data
interface QuadrantAnalysis {
  items: QuadrantItem[];
  quadrantSummary: Record<QuadrantType, QuadrantSummary>;
}

interface QuadrantItem {
  id: string;
  label: string;

  sentiment: number;
  volume: number;

  category: CategoryType;
  product: ProductType;

  quadrant: QuadrantType;

  topIssues: string[];
  trend: 'improving' | 'stable' | 'worsening';
}

type QuadrantType = 'critical' | 'watch' | 'strength' | 'noise';

interface QuadrantSummary {
  itemCount: number;
  totalVolume: number;
  avgSentiment: number;
  topCategories: string[];
}
```

### 3.5 AI Research Panel DTOs

```typescript
// Context sent to AI when user interacts with charts
interface AnalysisContext {
  // Selection info
  selectionType: 'bubble' | 'stage' | 'quadrant' | 'event' | 'range';

  // Time context
  timeWindow?: {
    start: Date;
    end: Date;
  };

  // Filter context
  activeFilters: FilterState;

  // Selection details
  selectedBubble?: SentimentBubble;
  selectedStage?: JourneyStageData;
  selectedQuadrant?: QuadrantType;
  selectedEvent?: TimelineEvent;
  selectedItems?: string[];

  // Derived signals
  signals: AnalysisSignal[];
}

interface AnalysisSignal {
  type:
    | 'sentiment_drop'
    | 'volume_spike'
    | 'theme_emergence'
    | 'event_correlation';
  severity: SeverityType;
  description: string;
  affectedPeriod?: { start: Date; end: Date };
}

// AI Research response
interface ResearchInsight {
  // Core insight
  summary: string;
  confidence: 'high' | 'medium' | 'low';

  // Analysis
  keyDrivers: KeyDriver[];
  rootCauses: string[];

  // Evidence
  evidence: EvidenceItem[];

  // Reasoning
  timelineReasoning: string;
  causalAnalysis?: string;

  // Recommendations
  suggestedActions: SuggestedAction[];

  // Follow-up
  suggestedQuestions: string[];

  // Metadata
  processingTime: number;
  sourcesUsed: number;
}

interface KeyDriver {
  driver: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  supportingEvidence: string[];
}

interface EvidenceItem {
  id: string;
  type: 'communication' | 'social' | 'event' | 'news';
  source: string;
  timestamp: Date;
  excerpt: string;
  sentiment: number;
  relevanceScore: number;
  highlightedTerms?: string[];
}

interface SuggestedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  expectedImpact: string;
}

// Chat interaction
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  // Context at time of message
  context?: AnalysisContext;

  // For assistant responses
  insight?: ResearchInsight;

  // Streaming
  isStreaming?: boolean;
}
```

### 3.6 RAG & RRG DTOs

```typescript
// RAG (Retrieval Augmented Generation)
interface RAGRequest {
  query: string;
  filters?: FilterState;
  topK?: number; // Number of chunks to retrieve
  useHybrid?: boolean; // Dense + Sparse search
  includeContext?: boolean; // Use contextual chunks
}

interface RAGResponse {
  chunks: RetrievedChunk[];
  query: string;
  searchType: 'dense' | 'sparse' | 'hybrid';
  totalResults: number;
  processingTime: number;
}

interface RetrievedChunk {
  id: string;
  communicationId: string;
  content: string;
  context?: string; // Contextual RAG context

  // Scoring
  denseScore?: number;
  sparseScore?: number;
  combinedScore: number;
  rerankerScore?: number;

  // Source metadata
  source: {
    channel: ChannelType;
    timestamp: Date;
    customerId: string;
    product?: ProductType;
  };

  // Highlighting
  highlights?: string[];
}

// RRG (Retrieval-Refined Generation) for NL → DSL
interface RRGRequest {
  naturalLanguageQuery: string;
  targetDSL: 'elasticsearch' | 'aggregation';
  context?: {
    availableFields: string[];
    indexName: string;
    currentFilters?: FilterState;
  };
}

interface RRGResponse {
  originalQuery: string;

  // Generated DSL
  dsl: object; // Elasticsearch query DSL

  // Explanation
  explanation: string;

  // Confidence
  confidence: number;

  // Suggestions for refinement
  suggestedRefinements?: string[];

  // Validation
  isValid: boolean;
  validationErrors?: string[];
}
```

### 3.7 Agent/Tool Definitions

```typescript
// ReAct Agent structure
interface AgentState {
  conversationId: string;
  messages: ChatMessage[];
  currentContext: AnalysisContext;
  availableTools: AgentTool[];
  executionHistory: ToolExecution[];
}

interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: 'rag' | 'rrg' | 'analysis' | 'data';
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

interface ToolExecution {
  toolName: string;
  input: Record<string, any>;
  output: any;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// Available tools for the ReAct agent
const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'search_communications',
    description: 'Search customer communications using semantic search (RAG)',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Natural language search query',
        required: true,
      },
      {
        name: 'filters',
        type: 'object',
        description: 'Optional filters',
        required: false,
      },
      {
        name: 'topK',
        type: 'number',
        description: 'Number of results',
        required: false,
        default: 10,
      },
    ],
    category: 'rag',
  },
  {
    name: 'query_analytics',
    description:
      'Execute an analytics query against Elasticsearch (converts NL to DSL)',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Natural language analytics query',
        required: true,
      },
      {
        name: 'aggregationType',
        type: 'string',
        description: 'Type of aggregation needed',
        required: false,
      },
    ],
    category: 'rrg',
  },
  {
    name: 'analyze_data',
    description: 'Generate statistical analysis and data cards for a dataset',
    parameters: [
      {
        name: 'data',
        type: 'array',
        description: 'Data to analyze',
        required: true,
      },
      {
        name: 'analysisType',
        type: 'string',
        description: 'Type of analysis',
        required: false,
      },
    ],
    category: 'analysis',
  },
  {
    name: 'get_timeline_events',
    description: 'Retrieve bank events within a time period',
    parameters: [
      {
        name: 'startDate',
        type: 'string',
        description: 'Start date',
        required: true,
      },
      {
        name: 'endDate',
        type: 'string',
        description: 'End date',
        required: true,
      },
      {
        name: 'eventTypes',
        type: 'array',
        description: 'Filter by event types',
        required: false,
      },
    ],
    category: 'data',
  },
  {
    name: 'get_case_details',
    description: 'Retrieve detailed information about a specific case',
    parameters: [
      {
        name: 'caseId',
        type: 'string',
        description: 'Case ID',
        required: true,
      },
    ],
    category: 'data',
  },
  {
    name: 'compare_periods',
    description: 'Compare sentiment and volume between two time periods',
    parameters: [
      {
        name: 'period1',
        type: 'object',
        description: 'First period (start, end)',
        required: true,
      },
      {
        name: 'period2',
        type: 'object',
        description: 'Second period (start, end)',
        required: true,
      },
      {
        name: 'metrics',
        type: 'array',
        description: 'Metrics to compare',
        required: false,
      },
    ],
    category: 'analysis',
  },
];
```

---

## 4. Elasticsearch Index Schemas

### 4.1 Communications Index

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "externalId": { "type": "keyword" },
      "customerId": { "type": "keyword" },
      "customerName": { "type": "text" },
      "customerSegment": { "type": "keyword" },
      "channel": { "type": "keyword" },
      "direction": { "type": "keyword" },
      "timestamp": { "type": "date" },
      "subject": { "type": "text" },
      "content": { "type": "text", "analyzer": "english" },
      "contentSummary": { "type": "text" },

      "classification": {
        "type": "object",
        "properties": {
          "product": { "type": "keyword" },
          "productConfidence": { "type": "float" },
          "category": { "type": "keyword" },
          "categoryConfidence": { "type": "float" },
          "issueType": { "type": "keyword" },
          "urgency": { "type": "keyword" },
          "topics": { "type": "keyword" },
          "rootCause": { "type": "text" },
          "suggestedAction": { "type": "text" }
        }
      },

      "sentiment": {
        "type": "object",
        "properties": {
          "overall": { "type": "float" },
          "confidence": { "type": "float" },
          "npsCategory": { "type": "keyword" }
        }
      },

      "threadId": { "type": "keyword" },
      "caseId": { "type": "keyword" },

      "denseEmbedding": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },

      "sparseEmbedding": {
        "type": "sparse_vector"
      },

      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "processedAt": { "type": "date" },
      "processingStatus": { "type": "keyword" }
    }
  }
}
```

### 4.2 Contextual Chunks Index (for RAG)

```json
{
  "mappings": {
    "properties": {
      "chunkId": { "type": "keyword" },
      "communicationId": { "type": "keyword" },
      "content": { "type": "text" },
      "context": { "type": "text" },
      "position": { "type": "integer" },

      "denseEmbedding": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },

      "sparseEmbedding": {
        "type": "sparse_vector"
      },

      "metadata": {
        "type": "object",
        "properties": {
          "channel": { "type": "keyword" },
          "timestamp": { "type": "date" },
          "customerId": { "type": "keyword" },
          "product": { "type": "keyword" },
          "category": { "type": "keyword" }
        }
      }
    }
  }
}
```

---

## 5. API Endpoints Structure

### 5.1 journeyworks-api Routes

```
# Health & Status
GET  /health
GET  /api/status

# Communications
GET  /api/communications
GET  /api/communications/:id
POST /api/communications/search           # RAG-powered search
POST /api/communications/bulk-process     # Bulk LLM processing

# Cases
GET  /api/cases
GET  /api/cases/:id
GET  /api/cases/:id/journey               # Sentiment journey

# Events
GET  /api/events
GET  /api/events/:id
POST /api/events                          # Create event

# Analysis (for dashboard)
POST /api/analysis/timeline               # Timeline bubbles + events
POST /api/analysis/journey                # Waterfall data
POST /api/analysis/quadrant               # Scatter plot data
POST /api/analysis/kpis                   # Dashboard KPIs

# AI Research
POST /api/research/insight                # Get AI insight for context
POST /api/research/chat                   # Chat interaction
WS   /api/research/stream                 # WebSocket for streaming

# RAG/RRG
POST /api/rag/search                      # Semantic search
POST /api/rrg/translate                   # NL to DSL

# Data Processing
POST /api/processing/classify             # LLM classification
POST /api/processing/embed                # Generate embeddings
POST /api/processing/chunk                # Contextual chunking

# Synthetic Data (PoC only)
POST /api/synthetic/generate              # Generate synthetic data
GET  /api/synthetic/status                # Generation status
```

---

## 6. Service Integration Flow

### 6.1 Document Ingestion Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Raw Document │────▶│ journeyworks-api │────▶│ LLM (Anthropic) │
│              │     │                  │     │                 │
└──────────────┘     │ 1. Receive doc   │     │ - Classify      │
                     │ 2. Extract text  │     │ - Extract meta  │
                     │ 3. Send to LLM   │     │ - Summarize     │
                     │                  │     │ - Sentiment     │
                     └────────┬─────────┘     └─────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ model-service    │
                     │                  │
                     │ - Dense embed    │
                     │ - Sparse embed   │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Elasticsearch   │
                     │                  │
                     │ - Store document │
                     │ - Index vectors  │
                     └──────────────────┘
```

### 6.2 Contextual RAG Flow (Anthropic's Approach)

```
┌─────────────────┐
│ Document/Comm   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ 1. Chunk document into segments              │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ 2. For each chunk, generate context:         │
│    LLM prompt: "Given the full document,     │
│    explain what this chunk is about and      │
│    how it relates to the overall context"    │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ 3. Concatenate: context + chunk              │
│    "This chunk discusses a payment failure   │
│    complaint from a credit card customer     │
│    who experienced issues after an outage.   │
│    [CHUNK CONTENT]"                          │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ 4. Generate embeddings (dense + sparse)      │
│    for the contextualized chunk              │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ 5. Store in Elasticsearch with metadata      │
└─────────────────────────────────────────────┘
```

### 6.3 Query Flow (RAG + RRG)

```
┌──────────────┐
│ User Query   │
│ (NL)         │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│           ReAct Agent                 │
│  (Decides which tools to use)         │
└──────┬──────────────┬────────────────┘
       │              │
       ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ RAG Tool     │  │ RRG Tool         │
│              │  │                  │
│ Semantic     │  │ NL → ES DSL      │
│ search for   │  │ for analytics    │
│ evidence     │  │ queries          │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────────┐
│           Elasticsearch               │
│  - Vector search (kNN)                │
│  - Aggregations                       │
│  - Filters                            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│           model-service               │
│  - Rerank results                     │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│     analysis-service (optional)       │
│  - Generate data cards for stats      │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│           LLM (Anthropic)             │
│  - Reason over evidence               │
│  - Generate insight                   │
│  - Answer user query                  │
└──────────────────────────────────────┘
```

---

## 7. Docker Services Configuration

### 7.1 Port Allocation

| Service           | Port | Description             |
| ----------------- | ---- | ----------------------- |
| journeyworks-ui   | TBD  | Angular dev server      |
| journeyworks-api  | TBD  | NestJS API              |
| model-service     | TBD  | Embeddings & reranking  |
| analysis-service  | TBD  | Statistical analysis    |
| Elasticsearch     | TBD  | Search & storage        |
| Kibana (optional) | TBD  | ES visualization        |
| Redis             | TBD  | Caching & rate limiting |

> **⚠️ PORTS TO BE CONFIRMED** - All standard ports conflict with existing projects. Awaiting confirmation of alternative ports.

### 7.2 Docker Compose Structure (Draft)

```yaml
# docker-compose.yml structure (to be created after port confirmation)

services:
  elasticsearch:
    image: elasticsearch:8.11.0
    ports:
      - '9200:9200'
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - es_data:/usr/share/elasticsearch/data

  model-service:
    build: ./python/model-service
    ports:
      - '8000:8000'
    depends_on:
      - elasticsearch

  analysis-service:
    build: ./python/analysis-service
    ports:
      - '8001:8001'

  journeyworks-api:
    build: ./journeyworks-api
    ports:
      - '3000:3000'
    depends_on:
      - elasticsearch
      - model-service
      - analysis-service
    environment:
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - MODEL_SERVICE_URL=http://model-service:8000
      - ANALYSIS_SERVICE_URL=http://analysis-service:8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

  journeyworks-ui:
    build: ./journeyworks-ui
    ports:
      - '4200:80'
    depends_on:
      - journeyworks-api

volumes:
  es_data:
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Confirm Docker port allocation
- [ ] Set up Docker Compose with all services
- [ ] Configure Elasticsearch indices
- [ ] Set up NestJS project structure with modules
- [ ] Create shared TypeScript types/interfaces
- [ ] Basic API endpoints for CRUD operations

### Phase 2: Data Pipeline (Week 2-3)

- [ ] Synthetic data generation script
- [ ] LLM classification pipeline (Anthropic)
- [ ] Contextual chunking implementation
- [ ] Embedding generation pipeline
- [ ] Data ingestion into Elasticsearch

### Phase 3: RAG & RRG (Week 3-4)

- [ ] RAG implementation with hybrid search
- [ ] Reranking integration
- [ ] RRG (NL → DSL) implementation
- [ ] Query endpoint integration

### Phase 4: ReAct Agent (Week 4-5)

- [ ] Agent loop implementation
- [ ] Tool definitions and execution
- [ ] Streaming response support
- [ ] Context management

### Phase 5: UI Integration (Week 5-6)

- [ ] Port chart components from demo-app
- [ ] Connect to real API endpoints
- [ ] AI Research Panel integration
- [ ] WebSocket streaming

### Phase 6: Polish & Demo (Week 6)

- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Demo preparation

---

## 9. Decisions Made

### Confirmed Decisions:

1. **Port Conflicts:** All standard ports conflict - using alternative ports (TBD)

2. **LLM Provider:** Anthropic Claude (primary), OpenAI GPT-4o (fallback)
   - Models: `claude-sonnet-4-20250514`, `gpt-4o`

3. **Synthetic Data Volume:** 2000-5000 communications across 300-500 cases
   - Formats: Email, phone transcripts, chat app, occasional letters

4. **Social Media:** Included - Twitter/X and other platforms

5. **Authentication:** Not required for PoC (internal demo)

6. **UI Migration:** Direct migration from demo-app to journeyworks-ui
   - **⚠️ IMPORTANT: demo-app folder is READ-ONLY - no modifications allowed**

7. **Data Persistence:** Use Docker volumes for persistence

8. **Additional Features Approved:**
   - Redis for caching and rate limiting
   - OpenTelemetry for distributed tracing
   - Data Quality Dashboard
   - Comparative Analysis feature

---

## 10. Approved Enhancements

### Architecture Enhancements (Confirmed):

1. ✅ **Redis Caching Layer:** For frequently accessed aggregations and LLM rate limiting

2. ✅ **OpenTelemetry:** Distributed tracing across all services

3. ✅ **Rate Limiting:** Via Redis for LLM API calls

### Feature Enhancements (Confirmed):

1. ✅ **Data Quality Dashboard:** Classification confidence scores, flagging low-confidence items

2. ✅ **Comparative Analysis:** Compare current period metrics against historical baselines

### Future Considerations (Not in PoC Scope):

1. **Alerting:** Real-time alerts when sentiment drops below threshold

2. **Export:** PDF/Excel report generation

3. **Saved Queries:** Allow users to save and share research queries

---

## Next Steps

1. Review this plan and provide feedback
2. Confirm port allocations for Docker
3. Answer open questions above
4. Begin Phase 1 implementation

---

_Document Version: 1.0_
_Created: February 2026_

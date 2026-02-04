/\*\*

- JourneyWorks API - Module Structure Overview
-
- This README describes the modular architecture of the NestJS backend.
  \*/

# JourneyWorks API Structure

## Module Organization

```
src/
├── main.ts                     # Application entry point
├── app.module.ts               # Root module
├── app.controller.ts           # Health check & root endpoints
├── app.service.ts              # Root service
│
├── config/                     # Configuration
│   └── configuration.ts        # Environment configuration loader
│
├── shared/                     # Shared utilities & types
│   ├── types/                  # TypeScript interfaces (shared with UI)
│   │   └── index.ts
│   ├── decorators/             # Custom decorators
│   ├── filters/                # Exception filters
│   ├── guards/                 # Guards (if auth needed later)
│   ├── interceptors/           # Logging, transform interceptors
│   └── pipes/                  # Validation pipes
│
├── infrastructure/             # Infrastructure adapters
│   ├── elasticsearch/          # Elasticsearch client & repository
│   ├── redis/                  # Redis caching
│   ├── llm/                    # LLM client (Anthropic/OpenAI)
│   ├── model-service/          # HTTP client for model-service
│   └── analysis-service/       # HTTP client for analysis-service
│
└── modules/                    # Feature modules
    ├── communications/         # Customer communications
    ├── cases/                  # Cases/complaints
    ├── events/                 # Timeline events
    ├── social/                 # Social media mentions
    ├── analysis/               # Dashboard analytics
    ├── research/               # AI research panel & agent
    ├── rag/                    # RAG implementation
    ├── rrg/                    # RRG (NL to DSL)
    └── synthetic/              # Synthetic data generation
```

## Module Descriptions

### Infrastructure Modules

#### `elasticsearch/`

- Elasticsearch client configuration
- Base repository with common operations
- Index management and mapping

#### `redis/`

- Redis client configuration
- Caching service with TTL management
- Rate limiting utilities

#### `llm/`

- Unified LLM client interface
- Anthropic Claude implementation
- OpenAI fallback implementation
- Prompt templates

#### `model-service/`

- HTTP client for Python model-service
- Dense/sparse embedding requests
- Reranking requests

#### `analysis-service/`

- HTTP client for Python analysis-service
- Data card generation requests

### Feature Modules

#### `communications/`

- CRUD operations for communications
- Search with filtering
- Bulk processing pipeline

#### `cases/`

- CRUD operations for cases
- Journey tracking
- Sentiment journey analysis

#### `events/`

- Timeline event management
- Event correlation with communications

#### `social/`

- Social media mention storage
- Social sentiment aggregation
- Platform-specific handling

#### `analysis/`

- Dashboard KPIs calculation
- Timeline bubble aggregation
- Journey waterfall data
- Quadrant analysis
- Comparative analysis

#### `research/`

- ReAct agent implementation
- Context management
- Streaming responses (WebSocket)
- Chat history

#### `rag/`

- Hybrid search (dense + sparse)
- Contextual chunking
- Reranking integration

#### `rrg/`

- Natural language to Elasticsearch DSL
- Query validation
- Aggregation generation

#### `synthetic/`

- Synthetic communication generation
- LLM-powered content creation
- Batch processing

## Creating a New Module

```bash
# Using NestJS CLI
nest generate module modules/my-feature
nest generate controller modules/my-feature
nest generate service modules/my-feature

# Module structure
modules/my-feature/
├── my-feature.module.ts
├── my-feature.controller.ts
├── my-feature.service.ts
├── dto/
│   ├── create-my-feature.dto.ts
│   └── update-my-feature.dto.ts
├── entities/
│   └── my-feature.entity.ts
└── my-feature.repository.ts
```

## API Conventions

### Endpoints

- Use kebab-case for URLs: `/api/communications/search`
- Use plural nouns for resources: `/api/cases` not `/api/case`
- Nest sub-resources: `/api/cases/:id/journey`

### DTOs

- Use `Create*Dto` for creation
- Use `Update*Dto` for updates (partial)
- Use `*ResponseDto` for responses if different from entity

### Error Handling

- Use NestJS built-in exceptions
- Return consistent error format
- Log errors with context

## Next Steps

1. Implement infrastructure modules (elasticsearch, redis, llm)
2. Implement core feature modules (communications, cases)
3. Implement analytics module
4. Implement research/agent module
5. Implement synthetic data generation

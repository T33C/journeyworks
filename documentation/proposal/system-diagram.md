# AI-Enhanced Customer Complaints Research & Insight Platform

## High-Level System Architecture

```mermaid
flowchart TB
    subgraph Sources["📥 Data Sources"]
        EMAIL[📧 Email]
        LETTERS[📄 Letters]
        CALLS[📞 Phone Calls]
        SOCIAL[📱 Social Media<br/>Twitter/X, Reddit, Trustpilot]
        NEWS[📰 News & APIs]
    end

    subgraph Ingestion["🔄 Ingestion Layer"]
        OCR[OCR Processing]
        ASR[Speech-to-Text ASR]
        CLEAN[Pre-cleaning]
        PII[PII Masking]
        CHUNK[Chunking & Vectorisation]
    end

    subgraph Processing["⚙️ Processing & Classification Layer"]
        LLM[LLM Engine]
        CLASS[Regulatory & Internal<br/>Classification]
        META[Metadata Extraction<br/>Product, Issue, Urgency]
        SENT[Sentiment Analysis]
        ENTITY[Entity Extraction]
        JOURNEY[Journey Sentiment<br/>Modelling]
    end

    subgraph Storage["💾 Storage Layer"]
        VECTOR[(Vector Store)]
        DB[(Database /<br/>Data Lake)]
    end

    subgraph RAG["🔍 RAG Query Engine"]
        EMBED[Embeddings]
        SEARCH[Vector Search]
        RERANK[Re-ranking]
        CONTEXT[Context Assembly]
        DECOMP[Query Decomposition]
        MEMORY[Conversation Memory]
    end

    subgraph Analytics["📊 Analytics & Insight Layer"]
        TIMELINE[Sentiment Timelines]
        CLUSTER[Root Cause Clusters]
        TREND[Trend Detection]
        TOPIC[Topic Modelling]
        CARDS[Data Cards & KPIs]
        COMMENTARY[LLM Commentary]
    end

    subgraph Agent["🤖 Agentic Research Module"]
        PLANNER[Task Planner]
        SUBQUERY[Sub-query Executor]
        ANALYSIS[Analysis Engine]
        REPORT[Report Generator]
    end

    subgraph Governance["🔒 Governance & Security"]
        AUDIT[Audit Trails]
        EXPLAIN[Explainable Outputs]
        VERSION[Version Control]
        BENCH[Benchmarking]
    end

    subgraph UI["👤 User Interface"]
        DASH[Dashboards<br/>QlikSense / Modern UI]
        NLQ[Natural Language<br/>Query Interface]
        REPORTS[Research Reports]
    end

    %% Data Flow
    EMAIL --> OCR
    LETTERS --> OCR
    CALLS --> ASR
    SOCIAL --> CLEAN
    NEWS --> CLEAN
    OCR --> CLEAN
    ASR --> CLEAN
    CLEAN --> PII
    PII --> CHUNK

    CHUNK --> LLM
    LLM --> CLASS
    LLM --> META
    LLM --> SENT
    LLM --> ENTITY
    SENT --> JOURNEY

    CHUNK --> VECTOR
    CLASS --> DB
    META --> DB
    SENT --> DB
    ENTITY --> DB
    JOURNEY --> DB

    VECTOR --> SEARCH
    SEARCH --> RERANK
    RERANK --> CONTEXT
    DECOMP --> SEARCH
    CONTEXT --> MEMORY

    DB --> Analytics
    MEMORY --> Analytics

    Analytics --> CARDS
    Analytics --> COMMENTARY

    PLANNER --> SUBQUERY
    SUBQUERY --> SEARCH
    SUBQUERY --> Analytics
    ANALYSIS --> REPORT

    RAG --> Agent
    Analytics --> Agent

    Governance -.-> Processing
    Governance -.-> RAG
    Governance -.-> Agent

    CARDS --> DASH
    COMMENTARY --> DASH
    MEMORY --> NLQ
    REPORT --> REPORTS

    DASH --> UI
    NLQ --> UI
    REPORTS --> UI
```

## Component Summary

| Layer                | Components                                                  | Purpose                                               |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Data Sources**     | Email, Letters, Calls, Social Media, News                   | Multi-channel complaint and context ingestion         |
| **Ingestion**        | OCR, ASR, Pre-cleaning, PII Masking, Chunking               | Transform raw data into processable, compliant format |
| **Processing**       | LLM, Classification, Metadata, Sentiment, Entity Extraction | AI-powered understanding and categorisation           |
| **Storage**          | Vector Store, Database/Data Lake                            | Persist embeddings and structured data                |
| **RAG Engine**       | Search, Re-ranking, Context Assembly, Query Decomposition   | Natural language querying over complaint data         |
| **Analytics**        | Timelines, Clusters, Trends, Data Cards, LLM Commentary     | Generate insights and KPIs                            |
| **Agentic Research** | Task Planner, Sub-query Executor, Analysis, Reports         | Deep multi-step investigation capability              |
| **Governance**       | Audit Trails, Explainability, Versioning, Benchmarks        | Compliance, security, and quality assurance           |
| **User Interface**   | Dashboards, NL Query, Research Reports                      | Analyst and stakeholder interaction layer             |

## Data Flow Overview

```mermaid
flowchart LR
    A[Raw Data] --> B[Ingest & Clean]
    B --> C[Classify & Extract]
    C --> D[Store & Index]
    D --> E[Query & Analyse]
    E --> F[Insights & Reports]
    F --> G[Action & Decision]

    style A fill:#e1f5fe
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fff8e1
    style F fill:#fce4ec
    style G fill:#e0f2f1
```

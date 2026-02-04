# AI-Enhanced Customer Complaints Platform

## Hybrid Architecture Design

> **Approach:** Data processing and storage on-premises, cloud AI APIs for LLM inference, OCR, and speech-to-text.

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph External["External Data Sources"]
        EMAIL[📧 Email Systems]
        LETTERS[📄 Document Scanning]
        CALLS[📞 Telephony/Call Recording]
        SOCIAL[📱 Social Media APIs]
        NEWS[📰 News Feeds]
    end

    subgraph OnPrem["On-Premises Infrastructure"]
        subgraph DMZ["DMZ / Edge"]
            NGINX[NGINX<br/>Reverse Proxy & WAF]
            CONNECTORS[API Connectors<br/>Social & News Ingestion]
        end

        subgraph Ingest["Ingestion Layer"]
            KAFKA[Apache Kafka<br/>Message Streaming]
            MINIO[MinIO<br/>Object Storage]
            AIRFLOW[Apache Airflow<br/>Workflow Orchestration]
        end

        subgraph Process["Processing Layer"]
            SPARK[Apache Spark<br/>ETL & Batch Processing]
            PRESIDIO[Microsoft Presidio<br/>PII Detection & Masking]
            QUEUE[Task Queue<br/>Celery / Redis Queue]
        end

        subgraph Data["Data Layer"]
            POSTGRES[(PostgreSQL<br/>+ pgvector)]
            ELASTIC[(Elasticsearch<br/>Full-Text Search)]
            REDIS[(Redis<br/>Cache & Sessions)]
            TIMESCALE[(TimescaleDB<br/>Time-Series Metrics)]
        end

        subgraph App["Application Layer"]
            FASTAPI[FastAPI<br/>Backend Services]
            LANGCHAIN[LangChain<br/>RAG Orchestration]
            AGENTS[LangGraph<br/>Agentic Workflows]
        end

        subgraph Analytics["Analytics Layer"]
            SUPERSET[Apache Superset<br/>Dashboards & BI]
            JUPYTER[JupyterHub<br/>Data Science]
            DBT[dbt<br/>Data Transforms]
        end

        subgraph Frontend["Presentation Layer"]
            ANGULAR[Angular 17+<br/>SPA Application]
            MATERIAL[Angular Material<br/>UI Components]
            D3[D3.js<br/>Visualizations]
        end
    end

    subgraph Cloud["Cloud AI Services (via API)"]
        subgraph GCP["Google Cloud"]
            GEMINI[Gemini Pro API<br/>Classification, Sentiment,<br/>Extraction, Generation]
            EMBED_GCP[Text Embeddings API]
            DOCAI[Document AI<br/>OCR & Form Parsing]
            STT_GCP[Speech-to-Text API]
        end

        subgraph Fallback["Fallback / Alternative"]
            OPENAI[OpenAI API<br/>GPT-4o]
            ANTHROPIC[Anthropic API<br/>Claude 3.5]
            AZURE_OAI[Azure OpenAI]
        end
    end

    subgraph Security["Security & Governance"]
        VAULT[HashiCorp Vault<br/>Secrets Management]
        KEYCLOAK[Keycloak<br/>Identity & SSO]
        AUDIT[Audit Logging<br/>Elasticsearch]
    end

    %% Data Flow
    EMAIL --> KAFKA
    LETTERS --> MINIO
    CALLS --> MINIO
    SOCIAL --> CONNECTORS
    NEWS --> CONNECTORS
    CONNECTORS --> KAFKA

    KAFKA --> AIRFLOW
    MINIO --> AIRFLOW
    AIRFLOW --> SPARK
    SPARK --> PRESIDIO

    PRESIDIO -->|PII-Masked Data| QUEUE
    QUEUE -->|OCR Request| DOCAI
    QUEUE -->|Transcription| STT_GCP
    QUEUE -->|Classification| GEMINI
    QUEUE -->|Embeddings| EMBED_GCP

    DOCAI -->|Text| QUEUE
    STT_GCP -->|Transcript| QUEUE
    GEMINI -->|Results| QUEUE
    EMBED_GCP -->|Vectors| QUEUE

    QUEUE --> POSTGRES
    QUEUE --> ELASTIC

    POSTGRES --> LANGCHAIN
    ELASTIC --> LANGCHAIN
    REDIS --> LANGCHAIN
    LANGCHAIN --> AGENTS
    LANGCHAIN <-->|LLM Calls| GEMINI

    LANGCHAIN --> FASTAPI
    AGENTS --> FASTAPI
    FASTAPI --> ANGULAR

    POSTGRES --> DBT
    DBT --> SUPERSET
    TIMESCALE --> SUPERSET

    Security -.-> OnPrem
    VAULT -.-> QUEUE
    KEYCLOAK -.-> ANGULAR
```

---

## Layered Architecture View

```mermaid
block-beta
    columns 1

    block:presentation["Presentation Layer (On-Prem)"]
        columns 4
        angular["Angular 17+"] material["Angular Material"] d3["D3.js Charts"] superset["Apache Superset"]
    end

    space

    block:api["API Layer (On-Prem)"]
        columns 3
        fastapi["FastAPI Services"] langchain["LangChain RAG"] agents["LangGraph Agents"]
    end

    space

    block:cloud["Cloud AI Services (API Calls)"]
        columns 4
        gemini["Gemini Pro"] embeddings["Text Embeddings"] docai["Document AI"] stt["Speech-to-Text"]
    end

    space

    block:data["Data Layer (On-Prem)"]
        columns 4
        postgres["PostgreSQL<br/>+ pgvector"] elastic["Elasticsearch"] redis["Redis Cache"] timescale["TimescaleDB"]
    end

    space

    block:processing["Processing Layer (On-Prem)"]
        columns 4
        spark["Apache Spark"] presidio["Presidio PII"] celery["Celery Tasks"] airflow["Airflow"]
    end

    space

    block:ingestion["Ingestion Layer (On-Prem)"]
        columns 3
        kafka["Apache Kafka"] minio["MinIO Storage"] connectors["API Connectors"]
    end

    presentation --> api
    api --> cloud
    api --> data
    cloud --> data
    data --> processing
    processing --> ingestion
```

---

## Component Architecture

### Ingestion Components

```mermaid
flowchart LR
    subgraph Sources["Data Sources"]
        E[Email<br/>IMAP/API]
        D[Documents<br/>SFTP/Scanner]
        C[Calls<br/>SIP/Recording]
        S[Social<br/>REST APIs]
    end

    subgraph Kafka["Apache Kafka"]
        T1[complaints.raw]
        T2[documents.pending]
        T3[calls.pending]
        T4[social.mentions]
    end

    subgraph Storage["MinIO Object Storage"]
        B1[/raw-documents/]
        B2[/audio-files/]
        B3[/processed/]
    end

    E --> T1
    D --> T2
    D --> B1
    C --> T3
    C --> B2
    S --> T4

    T2 --> B1
    T3 --> B2
```

### Processing Pipeline

```mermaid
flowchart TB
    subgraph Input["Input Queue"]
        RAW[Raw Message<br/>Kafka Topic]
    end

    subgraph Orchestration["Airflow DAG"]
        DETECT[Detect Type<br/>Email/Doc/Call]
        ROUTE[Route to Processor]
    end

    subgraph Processing["Spark Jobs"]
        CLEAN[Clean & Normalize]
        PII[Presidio PII Scan]
        MASK[Mask Sensitive Data]
    end

    subgraph CloudCalls["Cloud AI Calls"]
        OCR_CALL[Document AI<br/>if PDF/Image]
        STT_CALL[Speech-to-Text<br/>if Audio]
        CLASS_CALL[Gemini Classification]
        EMBED_CALL[Generate Embeddings]
    end

    subgraph Output["Output"]
        STORE[Store Results<br/>PostgreSQL + pgvector]
        INDEX[Index for Search<br/>Elasticsearch]
        NOTIFY[Notify Downstream<br/>Kafka Event]
    end

    RAW --> DETECT
    DETECT --> ROUTE
    ROUTE --> CLEAN
    CLEAN --> PII
    PII --> MASK

    MASK -->|If Document| OCR_CALL
    MASK -->|If Audio| STT_CALL
    OCR_CALL --> CLASS_CALL
    STT_CALL --> CLASS_CALL
    MASK -->|If Text| CLASS_CALL

    CLASS_CALL --> EMBED_CALL
    EMBED_CALL --> STORE
    STORE --> INDEX
    INDEX --> NOTIFY
```

### RAG Query Flow

```mermaid
sequenceDiagram
    participant User as Angular App
    participant API as FastAPI
    participant LC as LangChain
    participant PG as PostgreSQL/pgvector
    participant ES as Elasticsearch
    participant Redis as Redis Cache
    participant Gemini as Gemini Pro API

    User->>API: Natural language query
    API->>Redis: Check cache

    alt Cache Hit
        Redis-->>API: Cached response
        API-->>User: Return cached result
    else Cache Miss
        API->>LC: Process query
        LC->>LC: Query decomposition

        par Vector Search
            LC->>PG: Semantic search (pgvector)
            PG-->>LC: Similar chunks
        and Keyword Search
            LC->>ES: Full-text search
            ES-->>LC: Matching documents
        end

        LC->>LC: Re-rank & merge results
        LC->>LC: Build context window
        LC->>Gemini: Generate response
        Gemini-->>LC: LLM response
        LC->>LC: Extract citations
        LC-->>API: Formatted response
        API->>Redis: Cache result
        API-->>User: Return response
    end
```

### Agentic Research Flow

```mermaid
flowchart TB
    subgraph Input["Research Request"]
        QUERY[Complex Query<br/>"Investigate drivers behind<br/>negative mobile app sentiment"]
    end

    subgraph Planner["LangGraph Planner"]
        DECOMPOSE[Decompose into<br/>Sub-questions]
        PLAN[Create Execution Plan]
    end

    subgraph Executor["Task Executor"]
        SEARCH[Search Internal Data<br/>RAG Queries]
        ANALYZE[Statistical Analysis<br/>Pandas/NumPy]
        EXTERNAL[Fetch External Context<br/>Social/News APIs]
        SYNTHESIZE[Synthesize Findings]
    end

    subgraph LLM["Gemini Pro API"]
        REASON[Reasoning & Analysis]
        GENERATE[Report Generation]
    end

    subgraph Output["Research Output"]
        REPORT[Structured Report<br/>Summary, Evidence,<br/>Recommendations]
    end

    QUERY --> DECOMPOSE
    DECOMPOSE --> PLAN
    PLAN --> SEARCH
    PLAN --> ANALYZE
    PLAN --> EXTERNAL

    SEARCH <--> REASON
    ANALYZE <--> REASON
    EXTERNAL <--> REASON

    REASON --> SYNTHESIZE
    SYNTHESIZE --> GENERATE
    GENERATE --> REPORT
```

---

## Data Architecture

### Database Schema (PostgreSQL)

```mermaid
erDiagram
    COMPLAINTS ||--o{ MESSAGES : contains
    COMPLAINTS ||--o{ SENTIMENT_SCORES : has
    COMPLAINTS }o--|| CUSTOMERS : belongs_to
    COMPLAINTS }o--|| PRODUCTS : relates_to
    MESSAGES ||--o{ EMBEDDINGS : has
    MESSAGES ||--o{ CLASSIFICATIONS : has
    MESSAGES ||--o{ ENTITIES : contains

    COMPLAINTS {
        uuid id PK
        string reference_number
        uuid customer_id FK
        uuid product_id FK
        string status
        string channel
        timestamp created_at
        timestamp resolved_at
        float overall_sentiment
    }

    MESSAGES {
        uuid id PK
        uuid complaint_id FK
        string direction
        text content_masked
        string message_type
        timestamp timestamp
        float sentiment_score
    }

    EMBEDDINGS {
        uuid id PK
        uuid message_id FK
        vector embedding "vector(1536)"
        string model_version
    }

    CLASSIFICATIONS {
        uuid id PK
        uuid message_id FK
        string category
        string subcategory
        float confidence
        string regulatory_flag
    }

    SENTIMENT_SCORES {
        uuid id PK
        uuid complaint_id FK
        int sequence_number
        float score
        string phase
        timestamp measured_at
    }

    ENTITIES {
        uuid id PK
        uuid message_id FK
        string entity_type
        string value
        int start_pos
        int end_pos
    }

    CUSTOMERS {
        uuid id PK
        string customer_ref
        string segment
    }

    PRODUCTS {
        uuid id PK
        string name
        string category
    }
```

### Data Flow & Storage

```mermaid
flowchart LR
    subgraph Hot["Hot Storage (Fast Access)"]
        REDIS[(Redis<br/>Cache & Sessions<br/>TTL: Hours)]
        PG_RECENT[(PostgreSQL<br/>Recent 90 Days)]
    end

    subgraph Warm["Warm Storage (Active)"]
        PG_ARCHIVE[(PostgreSQL<br/>1-2 Years)]
        ELASTIC[(Elasticsearch<br/>Search Index)]
    end

    subgraph Cold["Cold Storage (Archive)"]
        MINIO_ARCH[(MinIO<br/>Compressed Archives<br/>7 Years)]
    end

    subgraph Vector["Vector Storage"]
        PGVECTOR[(pgvector<br/>All Embeddings)]
    end

    Hot --> Warm
    Warm --> Cold
    Hot --> Vector
    Warm --> Vector
```

---

## Security Architecture

```mermaid
flowchart TB
    subgraph External["External Zone"]
        USERS[Users]
        CLOUD_API[Cloud AI APIs]
    end

    subgraph DMZ["DMZ"]
        WAF[Web Application Firewall]
        NGINX[NGINX Reverse Proxy]
        APIGW[API Gateway]
    end

    subgraph Internal["Internal Network"]
        subgraph Auth["Authentication"]
            KEYCLOAK[Keycloak<br/>OIDC/SAML SSO]
            LDAP[Corporate LDAP/AD]
        end

        subgraph App["Application Tier"]
            BACKEND[Backend Services]
            FRONTEND[Frontend Assets]
        end

        subgraph Data["Data Tier"]
            DB[(Databases)]
            VAULT[HashiCorp Vault<br/>Secrets & Keys]
        end

        subgraph Audit["Audit & Monitoring"]
            LOGS[Centralized Logging<br/>Elasticsearch]
            MONITOR[Prometheus + Grafana]
            SIEM[SIEM Integration]
        end
    end

    subgraph CloudSecure["Secure Cloud Connectivity"]
        VPN[VPN / Private Connect]
        PROXY[Egress Proxy<br/>API Call Logging]
    end

    USERS --> WAF
    WAF --> NGINX
    NGINX --> APIGW
    APIGW --> KEYCLOAK
    KEYCLOAK --> LDAP
    APIGW --> App
    App --> Data
    VAULT --> App

    App --> PROXY
    PROXY --> VPN
    VPN --> CLOUD_API

    App --> LOGS
    Data --> LOGS
    LOGS --> SIEM
```

### PII Masking Flow

```mermaid
flowchart LR
    subgraph Input["Raw Data"]
        RAW[Original Text<br/>"John Smith called about<br/>his account 12345678"]
    end

    subgraph Presidio["Presidio PII Detection"]
        DETECT[Detect Entities]
        NAME[NAME: John Smith]
        ACCOUNT[ACCOUNT: 12345678]
    end

    subgraph Mask["Masking"]
        REPLACE[Replace with Tokens]
        MASKED[Masked Text<br/>"[PERSON_1] called about<br/>his account [ACCOUNT_1]"]
    end

    subgraph Vault["Secure Vault"]
        STORE[Store Mapping<br/>PERSON_1 → John Smith<br/>ACCOUNT_1 → 12345678]
    end

    subgraph CloudCall["Cloud API Call"]
        SAFE[Safe to Send<br/>No Real PII]
    end

    RAW --> DETECT
    DETECT --> NAME
    DETECT --> ACCOUNT
    NAME --> REPLACE
    ACCOUNT --> REPLACE
    REPLACE --> MASKED
    REPLACE --> STORE
    MASKED --> SAFE
```

---

## Angular Frontend Architecture

```mermaid
flowchart TB
    subgraph Angular["Angular Application"]
        subgraph Core["Core Module"]
            AUTH[Auth Service<br/>Keycloak Integration]
            HTTP[HTTP Interceptors<br/>Auth & Error Handling]
            STATE[NgRx Store<br/>State Management]
            CONFIG[Config Service<br/>Environment Settings]
        end

        subgraph Features["Feature Modules"]
            DASH[Dashboard<br/>KPIs & Overview]
            SEARCH[Search<br/>NL Query Interface]
            JOURNEY[Journey View<br/>Sentiment Timeline]
            RESEARCH[Research<br/>Agentic Queries]
            REPORTS[Reports<br/>Export & Share]
            ADMIN[Admin<br/>Settings & Users]
        end

        subgraph Shared["Shared Module"]
            CHARTS[D3.js Charts<br/>Sentiment, Trends, Heatmaps]
            TABLES[Data Tables<br/>Sortable, Paginated]
            FILTERS[Filter Components<br/>Date, Category, Product]
            CARDS[KPI Cards<br/>Metrics Display]
            TIMELINE[Timeline Component<br/>Journey Visualization]
        end

        subgraph UI["UI Framework"]
            MAT[Angular Material<br/>Components & Theming]
            CDK[Angular CDK<br/>Accessibility & Layout]
            ICONS[Material Icons]
        end
    end

    Core --> Features
    Features --> Shared
    Shared --> UI
```

### D3.js Visualization Components

```mermaid
mindmap
    root((D3.js Visualizations))
        Sentiment
            Line Chart - Trend Over Time
            Area Chart - Volume by Sentiment
            Gauge - Current Score
        Journey
            Timeline - Message Sequence
            Sankey - Flow Diagram
            Step Chart - Phase Transitions
        Distribution
            Bar Chart - Category Breakdown
            Histogram - Score Distribution
            Box Plot - Statistical Summary
        Correlation
            Heatmap - Product vs Issue
            Scatter Plot - Variables
            Bubble Chart - Multi-dimension
        Trends
            Sparklines - Inline Metrics
            Slope Chart - Change Over Time
            Stream Graph - Composition
```

---

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Dev["Development"]
        LOCAL[Local Dev<br/>Docker Compose]
        GIT[GitLab / GitHub<br/>Source Control]
    end

    subgraph CI["CI/CD Pipeline"]
        BUILD[Build & Test<br/>GitLab CI / Jenkins]
        SCAN[Security Scan<br/>Trivy, SonarQube]
        REGISTRY[Container Registry<br/>Harbor]
    end

    subgraph Staging["Staging Environment"]
        K8S_STG[Kubernetes Cluster<br/>Staging Namespace]
        DB_STG[(Staging Databases)]
    end

    subgraph Prod["Production Environment"]
        subgraph K8S["Kubernetes Cluster"]
            INGRESS[Ingress Controller<br/>NGINX]

            subgraph Apps["Application Pods"]
                API_POD[FastAPI Pods<br/>x3 Replicas]
                WORKER_POD[Celery Workers<br/>x5 Replicas]
                ANGULAR_POD[Angular<br/>Static Assets]
            end

            subgraph Data["Data Services"]
                PG_POD[PostgreSQL<br/>HA Cluster]
                ES_POD[Elasticsearch<br/>3-Node Cluster]
                REDIS_POD[Redis<br/>Sentinel]
                KAFKA_POD[Kafka<br/>3-Broker Cluster]
            end

            subgraph Support["Supporting Services"]
                AIRFLOW_POD[Airflow<br/>Scheduler + Workers]
                SUPERSET_POD[Superset]
                KEYCLOAK_POD[Keycloak]
            end
        end

        subgraph Storage["Persistent Storage"]
            NFS[NFS / Ceph<br/>Shared Storage]
            BLOCK[Block Storage<br/>Database Volumes]
        end
    end

    LOCAL --> GIT
    GIT --> BUILD
    BUILD --> SCAN
    SCAN --> REGISTRY
    REGISTRY --> K8S_STG
    K8S_STG --> K8S
    K8S --> Storage
```

---

## Technology Stack Summary

| Layer               | Technology            | Purpose                          | License           |
| ------------------- | --------------------- | -------------------------------- | ----------------- |
| **Frontend**        | Angular 17+           | SPA Framework                    | MIT               |
|                     | Angular Material      | UI Components                    | MIT               |
|                     | D3.js                 | Data Visualization               | ISC               |
|                     | NgRx                  | State Management                 | MIT               |
| **API Gateway**     | NGINX                 | Reverse Proxy, Load Balancer     | BSD               |
| **Backend**         | FastAPI               | REST API Framework               | MIT               |
|                     | Celery                | Task Queue                       | BSD               |
|                     | LangChain             | RAG Orchestration                | MIT               |
|                     | LangGraph             | Agentic Workflows                | MIT               |
| **Cloud AI**        | Gemini Pro            | LLM (Classification, Generation) | Commercial API    |
|                     | Text Embeddings API   | Vector Embeddings                | Commercial API    |
|                     | Document AI           | OCR                              | Commercial API    |
|                     | Speech-to-Text        | Transcription                    | Commercial API    |
| **Data Processing** | Apache Spark          | ETL, Batch Processing            | Apache 2.0        |
|                     | Apache Kafka          | Message Streaming                | Apache 2.0        |
|                     | Apache Airflow        | Workflow Orchestration           | Apache 2.0        |
|                     | Microsoft Presidio    | PII Detection                    | MIT               |
| **Databases**       | PostgreSQL + pgvector | Relational + Vector              | PostgreSQL        |
|                     | Elasticsearch         | Search & Logging                 | SSPL / Apache 2.0 |
|                     | Redis                 | Caching                          | BSD               |
|                     | TimescaleDB           | Time-Series                      | Apache 2.0        |
| **Object Storage**  | MinIO                 | S3-Compatible Storage            | AGPL              |
| **Analytics**       | Apache Superset       | Dashboards & BI                  | Apache 2.0        |
|                     | dbt                   | Data Transforms                  | Apache 2.0        |
|                     | JupyterHub            | Data Science                     | BSD               |
| **Security**        | Keycloak              | Identity & SSO                   | Apache 2.0        |
|                     | HashiCorp Vault       | Secrets Management               | MPL 2.0           |
| **Infrastructure**  | Kubernetes            | Container Orchestration          | Apache 2.0        |
|                     | Docker                | Containerization                 | Apache 2.0        |
|                     | Prometheus + Grafana  | Monitoring                       | Apache 2.0        |

---

## Network Architecture

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        USERS[End Users]
        CLOUD[Cloud AI APIs<br/>api.google.com]
    end

    subgraph Firewall["Enterprise Firewall"]
        FW_EXT[External Firewall]
        FW_INT[Internal Firewall]
    end

    subgraph DMZ["DMZ Network<br/>10.1.0.0/24"]
        LB[Load Balancer<br/>10.1.0.10]
        PROXY[Egress Proxy<br/>10.1.0.20]
    end

    subgraph App["Application Network<br/>10.2.0.0/24"]
        K8S_NODES[Kubernetes Nodes<br/>10.2.0.10-50]
    end

    subgraph Data["Data Network<br/>10.3.0.0/24"]
        DB_SERVERS[Database Servers<br/>10.3.0.10-30]
    end

    subgraph Mgmt["Management Network<br/>10.4.0.0/24"]
        JUMP[Jump Server]
        MONITOR[Monitoring]
        BACKUP[Backup Server]
    end

    USERS --> FW_EXT
    FW_EXT --> LB
    LB --> FW_INT
    FW_INT --> K8S_NODES
    K8S_NODES --> DB_SERVERS

    K8S_NODES --> PROXY
    PROXY --> FW_EXT
    FW_EXT --> CLOUD

    Mgmt --> App
    Mgmt --> Data
```

---

## Monitoring & Observability

```mermaid
flowchart LR
    subgraph Apps["Applications"]
        API[FastAPI]
        WORKERS[Celery Workers]
        ANGULAR[Angular]
    end

    subgraph Collect["Collection"]
        PROM[Prometheus<br/>Metrics]
        FLUENTD[Fluentd<br/>Logs]
        JAEGER[Jaeger<br/>Traces]
    end

    subgraph Store["Storage"]
        PROM_DB[(Prometheus TSDB)]
        ELASTIC_LOG[(Elasticsearch<br/>Logs)]
        JAEGER_DB[(Jaeger Storage)]
    end

    subgraph Visualize["Visualization"]
        GRAFANA[Grafana<br/>Dashboards]
        KIBANA[Kibana<br/>Log Analysis]
    end

    subgraph Alert["Alerting"]
        ALERTMGR[AlertManager]
        PAGERDUTY[PagerDuty]
        SLACK[Slack]
    end

    Apps --> PROM
    Apps --> FLUENTD
    Apps --> JAEGER

    PROM --> PROM_DB
    FLUENTD --> ELASTIC_LOG
    JAEGER --> JAEGER_DB

    PROM_DB --> GRAFANA
    ELASTIC_LOG --> KIBANA
    JAEGER_DB --> GRAFANA

    PROM_DB --> ALERTMGR
    ALERTMGR --> PAGERDUTY
    ALERTMGR --> SLACK
```

---

## Key Design Decisions

| Decision                     | Rationale                                                     |
| ---------------------------- | ------------------------------------------------------------- |
| **On-prem data storage**     | Regulatory compliance, data sovereignty, reduced egress costs |
| **Cloud AI APIs only**       | No GPU investment, always latest models, pay-per-use          |
| **PII masking before cloud** | Compliance with data protection, reduces risk                 |
| **PostgreSQL + pgvector**    | Single database for relational + vector, simpler ops          |
| **LangChain + LangGraph**    | Proven RAG framework, good agent support                      |
| **Kubernetes deployment**    | Scalability, standardized ops, self-healing                   |
| **Apache Kafka**             | Reliable event streaming, decoupled architecture              |
| **Keycloak for auth**        | Enterprise SSO, OIDC/SAML, free                               |

---

_Architecture Version: 1.0_  
_Last Updated: December 2024_

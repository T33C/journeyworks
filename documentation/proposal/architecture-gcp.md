# AI-Enhanced Customer Complaints Platform

## GCP Architecture with Vertex AI

```mermaid
flowchart TB
    subgraph External["External Data Sources"]
        direction LR
        CHANNELS[Customer Channels<br/>Email • Letters • Calls]
        SOCIAL[Social & News<br/>Twitter • Reddit • News APIs]
        LEGACY[Legacy Systems<br/>Existing BI • Data Warehouse]
    end

    subgraph GCP["Google Cloud Platform"]

        subgraph Ingest["Data Ingestion"]
            PUBSUB[Cloud Pub/Sub<br/>Event Streaming]
            GCS[Cloud Storage<br/>Raw Data Lake]
            FUNCTIONS[Cloud Functions<br/>Ingestion Triggers]
        end

        subgraph Transform["Data Processing"]
            DATAFLOW[Dataflow<br/>ETL Pipeline]
            DLP[Cloud DLP<br/>PII Detection & Masking]
            DOCTAI[Document AI<br/>OCR & Form Parsing]
            STT[Speech-to-Text<br/>Call Transcription]
        end

        subgraph AI["Vertex AI Platform"]
            GEMINI[Gemini Pro / Ultra<br/>Classification • Extraction<br/>Sentiment • Generation]
            EMBED[Text Embeddings API<br/>Semantic Embeddings]
            AGENT[Vertex AI Agent Builder<br/>Agentic Research]
            SEARCH[Vertex AI Search<br/>RAG & Retrieval]
        end

        subgraph Data["Data Layer"]
            VECTOR[(Vertex AI<br/>Vector Search)]
            BQ[(BigQuery<br/>Analytics Warehouse)]
            FIRESTORE[(Firestore<br/>Application Data)]
            MEMORYSTORE[(Memorystore<br/>Redis Cache)]
        end

        subgraph Analytics["Analytics & Insights"]
            BQML[BigQuery ML<br/>Trend Analysis]
            LOOKER[Looker<br/>BI & Dashboards]
            NOTEBOOKS[Vertex AI Workbench<br/>Data Science]
        end

        subgraph Serve["Application Serving"]
            RUN[Cloud Run<br/>Backend APIs]
            LB[Cloud Load Balancer<br/>Global CDN]
            APIGEE[Apigee<br/>API Management]
        end

        subgraph Security["Security & Governance"]
            IAM[Cloud IAM<br/>Access Control]
            AUDIT[Cloud Audit Logs<br/>Compliance Logging]
            KMS[Cloud KMS<br/>Encryption Keys]
            CATALOG[Data Catalog<br/>Metadata & Lineage]
        end
    end

    subgraph Frontend["Angular Frontend"]
        ANGULAR[Angular 17+<br/>SPA Application]
        MATERIAL[Angular Material<br/>UI Components]
        D3[D3.js<br/>Data Visualizations]
        FIREBASE[Firebase Hosting<br/>Static Assets & CDN]
    end

    %% Data Flow
    CHANNELS --> PUBSUB
    SOCIAL --> PUBSUB
    PUBSUB --> FUNCTIONS
    FUNCTIONS --> GCS

    GCS --> DATAFLOW
    DATAFLOW --> DLP
    DATAFLOW --> DOCTAI
    DATAFLOW --> STT

    DLP --> GEMINI
    DOCTAI --> GEMINI
    STT --> GEMINI

    GEMINI --> BQ
    EMBED --> VECTOR
    GEMINI <--> SEARCH
    SEARCH <--> AGENT
    VECTOR <--> SEARCH

    BQ --> BQML
    BQ --> LOOKER
    BQ --> NOTEBOOKS

    SEARCH --> RUN
    AGENT --> RUN
    BQ --> RUN
    FIRESTORE <--> RUN
    MEMORYSTORE <--> RUN

    RUN --> APIGEE
    APIGEE --> LB
    LB --> ANGULAR

    LOOKER -.-> ANGULAR
    LEGACY <-.-> BQ

    Security -.-> GCP
```

---

## Layered Architecture - GCP Stack

```mermaid
block-beta
    columns 1

    block:presentation["Presentation Layer"]
        columns 4
        angular["Angular 17+"] material["Angular Material"] d3["D3.js Charts"] firebase["Firebase Hosting"]
    end

    space

    block:api["API Layer"]
        columns 3
        run["Cloud Run"] apigee["Apigee Gateway"] lb["Cloud Load Balancer"]
    end

    space

    block:application["Application Services"]
        columns 3
        search["Vertex AI Search<br/>RAG Engine"] agent["Agent Builder<br/>Research Module"] analytics["BigQuery ML<br/>Analytics"]
    end

    space

    block:ai["AI/ML Layer - Vertex AI"]
        columns 4
        gemini["Gemini Pro/Ultra"] embed["Text Embeddings"] doctai["Document AI"] stt["Speech-to-Text"]
    end

    space

    block:data["Data Layer"]
        columns 4
        vector["Vector Search"] bq["BigQuery"] firestore["Firestore"] cache["Memorystore"]
    end

    space

    block:ingestion["Ingestion & Processing"]
        columns 4
        pubsub["Pub/Sub"] dataflow["Dataflow"] dlp["Cloud DLP"] gcs["Cloud Storage"]
    end

    presentation --> api
    api --> application
    application --> ai
    ai --> data
    data --> ingestion
```

---

## Angular Frontend Architecture

```mermaid
flowchart TB
    subgraph Angular["Angular Application"]
        direction TB

        subgraph Core["Core Module"]
            AUTH[Auth Service<br/>Google Identity]
            HTTP[HTTP Interceptors<br/>API Communication]
            STATE[NgRx Store<br/>State Management]
        end

        subgraph Features["Feature Modules"]
            DASHBOARD[Dashboard Module<br/>Overview & KPIs]
            SEARCH[Search Module<br/>NL Query Interface]
            RESEARCH[Research Module<br/>Agentic Investigations]
            JOURNEY[Journey Module<br/>Sentiment Tracking]
            REPORTS[Reports Module<br/>Export & Sharing]
        end

        subgraph Shared["Shared Module"]
            CHARTS[D3.js Charts<br/>Sentiment • Trends • Heatmaps]
            TABLES[Data Tables<br/>Mat-Table • Pagination]
            FILTERS[Filter Components<br/>Date • Product • Category]
            CARDS[Data Cards<br/>KPI Widgets]
        end

        subgraph UI["UI Layer"]
            MATERIAL[Angular Material<br/>Theming • Components]
            CDK[Angular CDK<br/>Layout • Overlays]
            FLEX[Flex Layout<br/>Responsive Grid]
        end
    end

    subgraph External["External Services"]
        API[Cloud Run APIs]
        LOOKER[Looker Embeds]
        FIREBASE[Firebase Auth]
    end

    Core --> Features
    Features --> Shared
    Shared --> UI

    AUTH <--> FIREBASE
    HTTP <--> API
    DASHBOARD <-.-> LOOKER
```

---

## D3.js Visualization Components

```mermaid
mindmap
  root((D3.js Charts))
    Sentiment Analysis
      Line Charts
        Sentiment Over Time
        Journey Timelines
      Area Charts
        Volume Trends
        Stacked Categories
    Distribution
      Bar Charts
        Category Breakdown
        Product Comparison
      Histograms
        Sentiment Distribution
        Response Time
    Relationships
      Heatmaps
        Product vs Issue
        Time vs Volume
      Chord Diagrams
        Root Cause Links
      Sankey
        Customer Journey Flow
    Trends
      Sparklines
        KPI Cards
      Bubble Charts
        Emerging Issues
      Force Graphs
        Topic Clusters
```

---

## GCP Technology Stack

| Layer                | Technology              | Purpose                                       |
| -------------------- | ----------------------- | --------------------------------------------- |
| **Frontend**         | Angular 17+             | Single Page Application framework             |
|                      | Angular Material        | UI component library                          |
|                      | D3.js                   | Custom data visualizations                    |
|                      | Firebase Hosting        | Static asset hosting with CDN                 |
| **API Gateway**      | Apigee                  | API management, rate limiting, security       |
|                      | Cloud Load Balancer     | Global load balancing, SSL termination        |
| **Backend Services** | Cloud Run               | Serverless containerized APIs                 |
|                      | Cloud Functions         | Event-driven microservices                    |
| **AI/ML**            | Vertex AI Gemini        | LLM for classification, sentiment, generation |
|                      | Vertex AI Search        | RAG-based retrieval and Q&A                   |
|                      | Vertex AI Agent Builder | Agentic multi-step research                   |
|                      | Text Embeddings API     | Semantic vector embeddings                    |
|                      | Document AI             | OCR and document parsing                      |
|                      | Speech-to-Text          | Call transcription                            |
| **Data Storage**     | BigQuery                | Analytics data warehouse                      |
|                      | Vertex AI Vector Search | Vector similarity search                      |
|                      | Firestore               | Application state and metadata                |
|                      | Memorystore (Redis)     | Caching and session management                |
|                      | Cloud Storage           | Raw data lake (GCS buckets)                   |
| **Data Processing**  | Dataflow (Apache Beam)  | Streaming and batch ETL                       |
|                      | Cloud DLP               | PII detection and masking                     |
|                      | Pub/Sub                 | Event streaming and messaging                 |
| **Analytics**        | BigQuery ML             | In-database ML for trends                     |
|                      | Looker                  | BI dashboards and embedded analytics          |
|                      | Vertex AI Workbench     | Data science notebooks                        |
| **Security**         | Cloud IAM               | Identity and access management                |
|                      | Cloud KMS               | Encryption key management                     |
|                      | Cloud Audit Logs        | Compliance and audit trails                   |
|                      | Data Catalog            | Metadata management and lineage               |
| **DevOps**           | Cloud Build             | CI/CD pipelines                               |
|                      | Artifact Registry       | Container and package registry                |
|                      | Cloud Monitoring        | Observability and alerting                    |

---

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User as Angular App
    participant LB as Load Balancer
    participant API as Cloud Run
    participant Search as Vertex AI Search
    participant Gemini as Gemini Pro
    participant BQ as BigQuery
    participant Vector as Vector Search

    User->>LB: Natural language query
    LB->>API: Route request
    API->>Search: RAG query
    Search->>Vector: Semantic search
    Vector-->>Search: Relevant chunks
    Search->>Gemini: Generate response
    Gemini-->>Search: Contextualized answer
    Search-->>API: Results + sources
    API->>BQ: Log query + fetch metadata
    BQ-->>API: Enriched data
    API-->>LB: JSON response
    LB-->>User: Display results (D3.js)
```

---

## Deployment Architecture

```mermaid
flowchart LR
    subgraph Dev["Development"]
        LOCAL[Local Dev<br/>ng serve]
        UNIT[Unit Tests<br/>Karma/Jest]
    end

    subgraph CI["Cloud Build CI/CD"]
        BUILD[Build Angular<br/>ng build --prod]
        TEST[E2E Tests<br/>Cypress]
        DOCKER[Container Build<br/>Cloud Run]
    end

    subgraph Staging["Staging Environment"]
        STAGE_FB[Firebase Hosting<br/>Preview Channel]
        STAGE_RUN[Cloud Run<br/>Staging Service]
    end

    subgraph Prod["Production Environment"]
        PROD_FB[Firebase Hosting<br/>Live Site]
        PROD_RUN[Cloud Run<br/>Production Service]
        CDN[Cloud CDN<br/>Global Edge]
    end

    LOCAL --> BUILD
    BUILD --> TEST
    TEST --> DOCKER
    DOCKER --> STAGE_FB
    DOCKER --> STAGE_RUN
    STAGE_FB --> PROD_FB
    STAGE_RUN --> PROD_RUN
    PROD_FB --> CDN
```

---

## Key GCP Services Summary

```mermaid
mindmap
  root((GCP Platform))
    Vertex AI
      Gemini Pro/Ultra
      Text Embeddings
      Vector Search
      Agent Builder
      Search
      Workbench
    Data & Analytics
      BigQuery
      BigQuery ML
      Looker
      Data Catalog
    Application
      Cloud Run
      Cloud Functions
      Firebase
      Apigee
    Data Processing
      Dataflow
      Pub/Sub
      Document AI
      Speech-to-Text
      Cloud DLP
    Storage
      Cloud Storage
      Firestore
      Memorystore
    Security
      Cloud IAM
      Cloud KMS
      Audit Logs
      VPC Service Controls
```

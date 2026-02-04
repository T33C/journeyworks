# Docker Setup for JourneyWorks

This directory contains the Docker configuration for the JourneyWorks PoC platform.

## Quick Start

```bash
# 1. Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys

# 2. Start infrastructure services first
docker-compose up -d elasticsearch redis

# 3. Wait for Elasticsearch to be healthy
docker-compose logs -f elasticsearch
# Wait for "started" message

# 4. Start all services
docker-compose up -d

# 5. Check status
docker-compose ps
```

## Services & Ports

| Service          | Port | URL                    | Description                      |
| ---------------- | ---- | ---------------------- | -------------------------------- |
| journeyworks-ui  | 4280 | http://localhost:4280  | Angular frontend                 |
| journeyworks-api | 3080 | http://localhost:3080  | NestJS backend API               |
| model-service    | 8080 | http://localhost:8080  | Embeddings & reranking           |
| analysis-service | 8081 | http://localhost:8081  | Statistical analysis             |
| elasticsearch    | 9280 | http://localhost:9280  | Search & vector store            |
| kibana           | 5680 | http://localhost:5680  | ES visualization (debug profile) |
| redis            | 6380 | redis://localhost:6380 | Caching & rate limiting          |

## Common Commands

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d elasticsearch redis model-service

# View logs
docker-compose logs -f                    # All services
docker-compose logs -f journeyworks-api   # Specific service

# Stop services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild a specific service
docker-compose build journeyworks-api
docker-compose up -d journeyworks-api

# Start with Kibana (debug profile)
docker-compose --profile debug up -d
```

## Development Mode

For local development with hot-reloading:

```bash
# 1. Start infrastructure only
docker-compose up -d elasticsearch redis model-service analysis-service

# 2. Run API locally
cd journeyworks-api
npm install
npm run start:dev

# 3. Run UI locally
cd journeyworks-ui
npm install
ng serve --port 4280
```

## Troubleshooting

### Elasticsearch won't start

```bash
# Check if port is in use
lsof -i :9280

# Increase Docker memory (Elasticsearch needs at least 2GB)
# Docker Desktop > Settings > Resources > Memory: 4GB+

# Check logs
docker-compose logs elasticsearch
```

### Model service slow to start

The model-service downloads ML models on first start (2-3GB). This can take several minutes.

```bash
# Check progress
docker-compose logs -f model-service

# Models are cached in a volume, subsequent starts are faster
```

### Port conflicts

If ports conflict with other projects, edit `.env`:

```bash
JOURNEYWORKS_UI_PORT=4281      # Change from 4280
JOURNEYWORKS_API_PORT=3081     # Change from 3080
# etc.
```

### Reset everything

```bash
docker-compose down -v
docker system prune -f
docker-compose up -d
```

## Architecture

```
┌─────────────────────┐     ┌────────────────────┐
│   journeyworks-ui   │────▶│  journeyworks-api  │
│   (Angular/nginx)   │     │     (NestJS)       │
└─────────────────────┘     └────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Elasticsearch│ │model-service │ │analysis-svc  │
            │              │ │   (FastAPI)  │ │  (FastAPI)   │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │    Redis     │
            │  (caching)   │
            └──────────────┘
```

## Environment Variables

See `.env.example` for full list. Key variables:

| Variable            | Description                          | Default          |
| ------------------- | ------------------------------------ | ---------------- |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key             | Required         |
| `OPENAI_API_KEY`    | OpenAI API key (fallback)            | Optional         |
| `LLM_PROVIDER`      | Primary LLM: `anthropic` or `openai` | `anthropic`      |
| `*_PORT`            | Service port mappings                | See .env.example |

## Data Persistence

Data is persisted in Docker volumes:

- `journeyworks-elasticsearch-data` - Elasticsearch indices
- `journeyworks-redis-data` - Redis cache
- `journeyworks-model-cache` - Downloaded ML models

To backup:

```bash
docker run --rm -v journeyworks-elasticsearch-data:/data -v $(pwd):/backup alpine tar cvf /backup/es-backup.tar /data
```

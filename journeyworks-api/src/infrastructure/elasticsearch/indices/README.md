# Elasticsearch Index Definitions

This folder contains the **golden source** for all Elasticsearch index definitions in the JourneyWorks platform.

## Structure

```
indices/
├── index.ts                 # Main exports
├── index-registry.ts        # Central registry and utilities
├── customers.index.ts       # Customer profiles index
├── communications.index.ts  # Customer communications index
├── chunks.index.ts          # RAG chunks index
├── cases.index.ts           # Support cases index
├── events.index.ts          # Timeline events index
└── social.index.ts          # Social media mentions index
```

## Index Overview

| Index            | Description                                        | Vector Support              |
| ---------------- | -------------------------------------------------- | --------------------------- |
| `customers`      | Customer profiles and account information          | No                          |
| `communications` | Customer communications (email, chat, phone, etc.) | Yes (768-dim dense, sparse) |
| `chunks`         | Semantic chunks for RAG retrieval                  | Yes (768-dim dense, sparse) |
| `cases`          | Customer complaint and support cases               | No                          |
| `events`         | Timeline events (outages, launches, etc.)          | No                          |
| `social`         | Social media mentions and posts                    | Yes (768-dim dense)         |

## Management Scripts

From the `journeyworks-api` directory:

```bash
# Create all indices
./scripts/create-indices.sh

# Create all indices (force recreate)
./scripts/create-indices.sh --force

# Create specific indices
./scripts/create-indices.sh customers communications

# Delete all indices
./scripts/delete-indices.sh --all

# Delete specific index
./scripts/delete-indices.sh communications

# Show index status
./scripts/index-status.sh

# List all registered indices
npx ts-node scripts/es-indices.ts list
```

## Environment Variables

| Variable                 | Default                 | Description                       |
| ------------------------ | ----------------------- | --------------------------------- |
| `ELASTICSEARCH_URL`      | `http://localhost:9200` | Elasticsearch cluster URL         |
| `ELASTICSEARCH_USERNAME` | -                       | Elasticsearch username (optional) |
| `ELASTICSEARCH_PASSWORD` | -                       | Elasticsearch password (optional) |

## Adding a New Index

1. Create a new file `{name}.index.ts`:

```typescript
import { IndexDefinition } from './index-registry';

export const MY_INDEX: IndexDefinition = {
  name: 'my_index',
  description: 'Description of the index',
  version: '1.0.0',
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      // ... add fields
    },
  },
};
```

2. Add to `index-registry.ts`:

```typescript
import { MY_INDEX } from './my.index';

export const INDEX_REGISTRY: Record<string, IndexDefinition> = {
  // ... existing indices
  my_index: MY_INDEX,
};
```

3. Export from `index.ts`:

```typescript
export * from './my.index';
```

## Vector Search Configuration

Indices with vector support use:

- **Dense vectors**: 768-dimensional embeddings (from BGE-base or similar models)
- **Similarity**: Cosine similarity for semantic matching
- **Sparse vectors**: For hybrid search with BM25-style keyword matching

Example mapping:

```typescript
denseEmbedding: {
  type: 'dense_vector',
  dims: 768,
  index: true,
  similarity: 'cosine',
},
sparseEmbedding: {
  type: 'sparse_vector',
},
```

## Version History

- **1.0.0**: Initial index definitions for JourneyWorks PoC

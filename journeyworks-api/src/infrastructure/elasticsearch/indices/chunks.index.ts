/**
 * Chunks Index Definition
 *
 * Stores contextual chunks for RAG (Retrieval Augmented Generation).
 * Communications are split into semantic chunks with embeddings for retrieval.
 */

import { IndexDefinition } from './index-registry';

export const CHUNKS_INDEX: IndexDefinition = {
  name: 'chunks',
  description: 'Semantic chunks for RAG retrieval',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },

  mappings: {
    properties: {
      // Identifiers
      chunkId: { type: 'keyword' },
      communicationId: { type: 'keyword' },

      // Content
      content: { type: 'text', analyzer: 'english' },
      context: { type: 'text' }, // Surrounding context for better understanding
      position: { type: 'integer' }, // Position within the original document

      // Chunk metadata
      chunkType: { type: 'keyword' }, // paragraph, sentence, section
      tokenCount: { type: 'integer' },
      overlap: { type: 'integer' }, // Tokens overlapping with previous chunk

      // Vector embeddings
      denseEmbedding: {
        type: 'dense_vector',
        dims: 768,
        index: true,
        similarity: 'cosine',
      },
      sparseEmbedding: {
        type: 'sparse_vector',
      },

      // Metadata for filtering during retrieval
      metadata: {
        type: 'object',
        properties: {
          channel: { type: 'keyword' },
          timestamp: { type: 'date' },
          customerId: { type: 'keyword' },
          product: { type: 'keyword' },
          category: { type: 'keyword' },
          sentiment: { type: 'float' },
          npsScore: { type: 'integer' }, // NPS score (0-10) if available
        },
      },

      // Audit
      createdAt: { type: 'date' },
    },
  },
};

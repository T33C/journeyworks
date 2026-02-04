/**
 * Communications Index Definition
 *
 * Stores all customer communications (emails, calls, chats, letters).
 * Supports full-text search, sentiment analysis, and vector search for RAG.
 */

import { IndexDefinition } from './index-registry';

export const COMMUNICATIONS_INDEX: IndexDefinition = {
  name: 'communications',
  description: 'Customer communications across all channels',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    'index.mapping.total_fields.limit': 1000,
    analysis: {
      analyzer: {
        default: {
          type: 'standard',
        },
        english_content: {
          type: 'english',
        },
      },
    },
  },

  mappings: {
    properties: {
      // Identifiers
      id: { type: 'keyword' },
      externalId: { type: 'keyword' },

      // Customer reference
      customerId: { type: 'keyword' },
      customerName: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      customerSegment: { type: 'keyword' },

      // Communication metadata
      channel: { type: 'keyword' }, // email, phone, chat, letter, social
      direction: { type: 'keyword' }, // inbound, outbound
      timestamp: { type: 'date' },
      priority: { type: 'keyword' }, // low, medium, high, urgent
      status: { type: 'keyword' }, // open, in_progress, resolved, escalated

      // Content (full-text searchable)
      subject: { type: 'text', analyzer: 'english' },
      content: { type: 'text', analyzer: 'english' },
      contentSummary: { type: 'text' },

      // AI Classification
      classification: {
        type: 'object',
        properties: {
          product: { type: 'keyword' },
          productConfidence: { type: 'float' },
          category: { type: 'keyword' },
          categoryConfidence: { type: 'float' },
          issueType: { type: 'keyword' },
          issueTypeConfidence: { type: 'float' },
          urgency: { type: 'keyword' },
          rootCause: { type: 'text' },
          suggestedAction: { type: 'text' },
          topics: { type: 'keyword' },
          regulatoryFlags: {
            type: 'nested',
            properties: {
              type: { type: 'keyword' },
              description: { type: 'text' },
              severity: { type: 'keyword' },
              requiresEscalation: { type: 'boolean' },
            },
          },
          entities: {
            type: 'nested',
            properties: {
              type: { type: 'keyword' },
              value: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              confidence: { type: 'float' },
            },
          },
          modelUsed: { type: 'keyword' },
          classifiedAt: { type: 'date' },
        },
      },

      // Sentiment analysis
      sentiment: {
        type: 'object',
        properties: {
          overall: { type: 'float' }, // -1.0 to 1.0
          confidence: { type: 'float' },
          label: { type: 'keyword' }, // positive, negative, neutral, mixed
          npsCategory: { type: 'keyword' }, // promoter, passive, detractor
          npsPredictedScore: { type: 'integer' },
          aspects: {
            type: 'nested',
            properties: {
              aspect: { type: 'keyword' },
              sentiment: { type: 'float' },
              mentions: { type: 'integer' },
            },
          },
          emotions: {
            type: 'nested',
            properties: {
              emotion: { type: 'keyword' },
              score: { type: 'float' },
            },
          },
        },
      },

      // Conversation threading
      threadId: { type: 'keyword' },
      parentId: { type: 'keyword' },
      caseId: { type: 'keyword' },

      // Message thread (for chat/email threads)
      messages: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          sender: { type: 'keyword' }, // customer, agent, system
          senderName: { type: 'keyword' },
          content: { type: 'text' },
          timestamp: { type: 'date' },
        },
      },

      // Tags and metadata
      tags: { type: 'keyword' },
      metadata: { type: 'object', enabled: false },

      // Vector embeddings for semantic search (RAG)
      denseEmbedding: {
        type: 'dense_vector',
        dims: 768,
        index: true,
        similarity: 'cosine',
      },
      sparseEmbedding: {
        type: 'sparse_vector',
      },

      // Processing status
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      processedAt: { type: 'date' },
      processingStatus: { type: 'keyword' }, // pending, processing, completed, failed
    },
  },
};

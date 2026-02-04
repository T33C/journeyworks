/**
 * Social Index Definition
 *
 * Stores social media mentions and posts related to the bank.
 * Used for social listening, sentiment monitoring, and correlation with complaints.
 */

import { IndexDefinition } from './index-registry';

export const SOCIAL_INDEX: IndexDefinition = {
  name: 'social',
  description: 'Social media mentions and posts',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },

  mappings: {
    properties: {
      // Identifier
      id: { type: 'keyword' },

      // Platform information
      platform: { type: 'keyword' }, // twitter, linkedin, facebook, reddit, trustpilot
      postId: { type: 'keyword' },
      postUrl: { type: 'keyword' },

      // Author information
      author: { type: 'keyword' },
      authorId: { type: 'keyword' },
      authorHandle: { type: 'keyword' },
      authorFollowerCount: { type: 'integer' },
      isVerified: { type: 'boolean' },

      // Content
      content: { type: 'text', analyzer: 'english' },
      contentSummary: { type: 'text' },
      timestamp: { type: 'date' },

      // Engagement metrics
      engagement: {
        type: 'object',
        properties: {
          likes: { type: 'integer' },
          shares: { type: 'integer' },
          comments: { type: 'integer' },
          views: { type: 'integer' },
          estimatedReach: { type: 'integer' },
          viralityScore: { type: 'float' },
        },
      },

      // Sentiment analysis
      sentiment: {
        type: 'object',
        properties: {
          label: { type: 'keyword' }, // positive, negative, neutral, mixed
          score: { type: 'float' }, // -1.0 to 1.0
          overall: { type: 'float' },
          confidence: { type: 'float' },
        },
      },

      // Analysis
      topics: { type: 'keyword' },
      mentions: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' }, // product, person, competitor, etc.
          value: { type: 'keyword' },
          sentiment: { type: 'float' },
        },
      },
      mentionedProducts: { type: 'keyword' },
      tags: { type: 'keyword' },

      // Bank relevance
      relevanceScore: { type: 'float' },
      products: { type: 'keyword' },
      categories: { type: 'keyword' },

      // Response tracking
      requiresResponse: { type: 'boolean' },
      responded: { type: 'boolean' },
      linkedCustomerId: { type: 'keyword' },

      // Correlation with other data
      correlatedCommunications: { type: 'keyword' },
      correlatedCases: { type: 'keyword' },
      correlatedEvents: { type: 'keyword' },

      // Vector embeddings for semantic search
      denseEmbedding: {
        type: 'dense_vector',
        dims: 768,
        index: true,
        similarity: 'cosine',
      },

      // Processing
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      processedAt: { type: 'date' },
      processingStatus: { type: 'keyword' },
    },
  },
};

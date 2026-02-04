/**
 * Customers Index Definition
 *
 * Stores customer profiles for the retail banking platform.
 * Used for customer lookups, segmentation, and relationship management.
 */

import { IndexDefinition } from './index-registry';

export const CUSTOMERS_INDEX: IndexDefinition = {
  name: 'customers',
  description: 'Customer profiles and account information',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    'index.mapping.total_fields.limit': 500,
  },

  mappings: {
    properties: {
      // Primary identifier
      id: { type: 'keyword' },

      // Personal information
      name: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      email: { type: 'keyword' },
      phone: { type: 'keyword' },
      company: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },

      // Account information
      tier: { type: 'keyword' }, // premium, standard, basic, student
      accountType: { type: 'keyword' },
      portfolioValue: { type: 'float' },
      riskProfile: { type: 'keyword' }, // conservative, moderate, aggressive

      // Relationship management
      relationshipManager: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      region: { type: 'keyword' },
      communicationPreference: { type: 'keyword' }, // email, phone, both

      // Important dates
      joinedDate: { type: 'date' },
      lastContactDate: { type: 'date' },

      // Computed metrics (updated periodically by analysis jobs)
      metrics: {
        type: 'object',
        properties: {
          totalCommunications: { type: 'integer' },
          openCases: { type: 'integer' },
          avgSentiment: { type: 'float' },
          lastSentiment: { type: 'float' },
          npsScore: { type: 'integer' },
        },
      },

      // Metadata
      metadata: { type: 'object', enabled: false },

      // Audit fields
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

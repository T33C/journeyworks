/**
 * Events Index Definition
 *
 * Stores timeline events that may affect customer communications.
 * Events include system outages, product launches, policy changes, etc.
 */

import { IndexDefinition } from './index-registry';

export const EVENTS_INDEX: IndexDefinition = {
  name: 'events',
  description: 'Timeline events affecting customer experience',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },

  mappings: {
    properties: {
      // Identifier
      id: { type: 'keyword' },

      // Event details
      type: { type: 'keyword' }, // outage, launch, policy_change, incident, promotion
      label: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      description: { type: 'text' },

      // Timing
      startDate: { type: 'date' },
      endDate: { type: 'date' },

      // Scope
      product: { type: 'keyword' },
      channels: { type: 'keyword' },
      affectedRegions: { type: 'keyword' },

      // Impact assessment
      severity: { type: 'keyword' }, // low, medium, high, critical
      estimatedImpact: {
        type: 'object',
        properties: {
          customersAffected: { type: 'integer' },
          communicationIncrease: { type: 'float' }, // Percentage increase
          sentimentImpact: { type: 'float' },
        },
      },

      // Status
      status: { type: 'keyword' }, // planned, active, resolved, cancelled

      // Correlation metrics (computed)
      correlatedCommunications: { type: 'integer' },
      sentimentDuringEvent: { type: 'float' },

      // Source and audit
      source: { type: 'keyword' }, // manual, automated, external
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

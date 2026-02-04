/**
 * Cases Index Definition
 *
 * Stores complaint and support cases.
 * Cases aggregate multiple communications and track resolution progress.
 */

import { IndexDefinition } from './index-registry';

export const CASES_INDEX: IndexDefinition = {
  name: 'cases',
  description: 'Customer complaint and support cases',
  version: '1.0.0',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
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

      // Case details
      title: { type: 'text', analyzer: 'english' },
      description: { type: 'text', analyzer: 'english' },
      status: { type: 'keyword' }, // open, in_progress, pending, resolved, closed
      priority: { type: 'keyword' }, // low, medium, high, critical
      severity: { type: 'keyword' },

      // Classification
      category: { type: 'keyword' },
      subcategory: { type: 'keyword' },
      product: { type: 'keyword' },
      issueType: { type: 'keyword' },

      // Resolution
      rootCause: { type: 'text' },
      resolution: { type: 'text' },

      // Assignment
      assignedTo: { type: 'keyword' },
      team: { type: 'keyword' },

      // Sentiment tracking
      currentSentiment: { type: 'float' },
      sentimentTrend: { type: 'keyword' }, // improving, stable, declining
      sentimentJourney: {
        type: 'nested',
        properties: {
          stage: { type: 'keyword' },
          sentiment: { type: 'float' },
          timestamp: { type: 'date' },
          communicationCount: { type: 'integer' },
        },
      },

      // Regulatory compliance
      regulatoryFlags: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' },
          description: { type: 'text' },
          severity: { type: 'keyword' },
          requiresEscalation: { type: 'boolean' },
        },
      },
      isEscalated: { type: 'boolean' },
      escalationReason: { type: 'text' },

      // SLA tracking
      slaDeadline: { type: 'date' },
      slaBreached: { type: 'boolean' },

      // Related entities
      communicationIds: { type: 'keyword' },
      relatedCaseIds: { type: 'keyword' },
      relatedEventIds: { type: 'keyword' },

      // Tags
      tags: { type: 'keyword' },

      // Timelines
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      targetResolutionDate: { type: 'date' },
      resolvedAt: { type: 'date' },

      // AI-generated insights
      aiInsight: {
        type: 'object',
        properties: {
          summary: { type: 'text' },
          keyDrivers: { type: 'text' },
          riskFactors: { type: 'text' },
          suggestedActions: { type: 'text' },
          confidence: { type: 'keyword' },
          generatedAt: { type: 'date' },
        },
      },

      // Metadata
      metadata: { type: 'object', enabled: false },
    },
  },
};

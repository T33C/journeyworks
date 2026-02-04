/**
 * Elasticsearch Index Mappings
 *
 * Defines the index mappings for all JourneyWorks indices.
 * These mappings support full-text search, filtering, and vector search.
 */

export const INDEX_MAPPINGS: Record<string, object> = {
  // Customers index - stores customer profiles
  customers: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },

        // Personal info
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

        // Account info
        tier: { type: 'keyword' },
        accountType: { type: 'keyword' },
        portfolioValue: { type: 'float' },
        riskProfile: { type: 'keyword' },

        // Relationship
        relationshipManager: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        region: { type: 'keyword' },
        communicationPreference: { type: 'keyword' },

        // Dates
        joinedDate: { type: 'date' },
        lastContactDate: { type: 'date' },

        // Computed metrics (updated periodically)
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

        // Audit
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  },

  // Communications index - stores customer communications
  communications: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          default: {
            type: 'standard',
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        externalId: { type: 'keyword' },

        // Customer info
        customerId: { type: 'keyword' },
        customerName: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        customerSegment: { type: 'keyword' },

        // Communication metadata
        channel: { type: 'keyword' },
        direction: { type: 'keyword' },
        timestamp: { type: 'date' },

        // Content
        subject: { type: 'text', analyzer: 'english' },
        content: { type: 'text', analyzer: 'english' },
        contentSummary: { type: 'text' },

        // Classification
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

        // Sentiment
        sentiment: {
          type: 'object',
          properties: {
            overall: { type: 'float' },
            confidence: { type: 'float' },
            npsCategory: { type: 'keyword' },
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

        // Relationships
        threadId: { type: 'keyword' },
        parentId: { type: 'keyword' },
        caseId: { type: 'keyword' },

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

        // Audit
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        processedAt: { type: 'date' },
        processingStatus: { type: 'keyword' },
      },
    },
  },

  // Chunks index - stores contextual chunks for RAG
  chunks: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        chunkId: { type: 'keyword' },
        communicationId: { type: 'keyword' },
        content: { type: 'text', analyzer: 'english' },
        context: { type: 'text' },
        position: { type: 'integer' },

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

        // Metadata for filtering
        metadata: {
          type: 'object',
          properties: {
            channel: { type: 'keyword' },
            timestamp: { type: 'date' },
            customerId: { type: 'keyword' },
            product: { type: 'keyword' },
            category: { type: 'keyword' },
          },
        },
      },
    },
  },

  // Cases index - stores complaint cases
  cases: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        externalId: { type: 'keyword' },

        // Customer
        customerId: { type: 'keyword' },
        customerName: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        customerSegment: { type: 'keyword' },

        // Case details
        status: { type: 'keyword' },
        severity: { type: 'keyword' },
        priority: { type: 'integer' },

        // Classification
        product: { type: 'keyword' },
        category: { type: 'keyword' },
        issueType: { type: 'keyword' },

        // Content
        summary: { type: 'text', analyzer: 'english' },
        rootCause: { type: 'text' },
        resolution: { type: 'text' },

        // Assignment
        assignedTo: { type: 'keyword' },
        team: { type: 'keyword' },

        // Sentiment
        currentSentiment: { type: 'float' },
        sentimentTrend: { type: 'keyword' },
        sentimentJourney: {
          type: 'nested',
          properties: {
            stage: { type: 'keyword' },
            sentiment: { type: 'float' },
            timestamp: { type: 'date' },
            communicationCount: { type: 'integer' },
          },
        },

        // Regulatory
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

        // Related
        communicationIds: { type: 'keyword' },
        relatedCaseIds: { type: 'keyword' },
        relatedEventIds: { type: 'keyword' },

        // Timelines
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        targetResolutionDate: { type: 'date' },
        resolvedAt: { type: 'date' },

        // AI insight
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
      },
    },
  },

  // Events index - stores timeline events
  events: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },

        type: { type: 'keyword' },
        label: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        description: { type: 'text' },

        startDate: { type: 'date' },
        endDate: { type: 'date' },

        product: { type: 'keyword' },
        channels: { type: 'keyword' },
        affectedRegions: { type: 'keyword' },

        severity: { type: 'keyword' },
        estimatedImpact: {
          type: 'object',
          properties: {
            customersAffected: { type: 'integer' },
            communicationIncrease: { type: 'float' },
            sentimentImpact: { type: 'float' },
          },
        },

        status: { type: 'keyword' },

        correlatedCommunications: { type: 'integer' },
        sentimentDuringEvent: { type: 'float' },

        source: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  },

  // Social mentions index - stores social media mentions
  social: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },

        // Platform info
        platform: { type: 'keyword' },
        postId: { type: 'keyword' },
        postUrl: { type: 'keyword' },

        // Author info
        authorId: { type: 'keyword' },
        authorHandle: { type: 'keyword' },
        authorFollowerCount: { type: 'integer' },
        isVerified: { type: 'boolean' },

        // Content
        content: { type: 'text', analyzer: 'english' },
        contentSummary: { type: 'text' },
        timestamp: { type: 'date' },

        // Engagement
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

        // Sentiment
        sentiment: {
          type: 'object',
          properties: {
            overall: { type: 'float' },
            confidence: { type: 'float' },
          },
        },

        // Analysis
        topics: { type: 'keyword' },
        mentions: {
          type: 'nested',
          properties: {
            type: { type: 'keyword' },
            value: { type: 'keyword' },
            sentiment: { type: 'float' },
          },
        },

        // Bank relevance
        relevanceScore: { type: 'float' },
        products: { type: 'keyword' },
        categories: { type: 'keyword' },

        // Correlation
        correlatedCommunications: { type: 'keyword' },
        correlatedCases: { type: 'keyword' },
        correlatedEvents: { type: 'keyword' },

        // Vector embeddings
        denseEmbedding: {
          type: 'dense_vector',
          dims: 768,
          index: true,
          similarity: 'cosine',
        },

        // Processing
        createdAt: { type: 'date' },
        processedAt: { type: 'date' },
        processingStatus: { type: 'keyword' },
      },
    },
  },
};

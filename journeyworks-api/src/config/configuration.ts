/**
 * JourneyWorks Configuration
 *
 * Centralized configuration loaded from environment variables.
 */

export default () => ({
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4280'],
  },

  // Elasticsearch
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9280',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indices: {
      communications:
        process.env.ES_INDEX_COMMUNICATIONS || 'journeyworks_communications',
      chunks: process.env.ES_INDEX_CHUNKS || 'journeyworks_chunks',
      cases: process.env.ES_INDEX_CASES || 'journeyworks_cases',
      events: process.env.ES_INDEX_EVENTS || 'journeyworks_events',
      social: process.env.ES_INDEX_SOCIAL || 'journeyworks_social',
      surveys: process.env.ES_INDEX_SURVEYS || 'journeyworks_nps_surveys',
    },
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
    password: process.env.REDIS_PASSWORD,
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600,
  },

  // LLM Configuration
  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 4096,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.1,
    rateLimitRpm: parseInt(process.env.LLM_RATE_LIMIT_RPM, 10) || 60,

    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
  },

  // External Services
  services: {
    modelService: {
      url: process.env.MODEL_SERVICE_URL || 'http://localhost:8080',
    },
    analysisService: {
      url: process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8081',
    },
  },

  // OpenTelemetry
  otel: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME || 'journeyworks-api',
    exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },

  // Embedding Configuration
  embedding: {
    denseModelName: process.env.DENSE_MODEL_NAME || 'BAAI/bge-base-en-v1.5',
    sparseModelName:
      process.env.SPARSE_MODEL_NAME ||
      'naver/splade-cocondenser-ensembledistil',
    rerankerModelName:
      process.env.RERANKER_MODEL_NAME || 'BAAI/bge-reranker-base',
    chunkSize: parseInt(process.env.CHUNK_SIZE, 10) || 512,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP, 10) || 50,
  },

  // Synthetic Data
  synthetic: {
    communicationCount:
      parseInt(process.env.SYNTHETIC_COMMUNICATION_COUNT, 10) || 3000,
    caseCount: parseInt(process.env.SYNTHETIC_CASE_COUNT, 10) || 400,
    eventCount: parseInt(process.env.SYNTHETIC_EVENT_COUNT, 10) || 25,
    socialCount: parseInt(process.env.SYNTHETIC_SOCIAL_COUNT, 10) || 500,
    dateRange: {
      start: process.env.SYNTHETIC_DATE_START || '2025-01-01',
      end: process.env.SYNTHETIC_DATE_END || '2026-01-31',
    },
  },

  // Branding (used in synthetic data generation)
  branding: {
    bankName: process.env.BANK_NAME || 'JourneyWorks Bank',
    bankHandle: process.env.BANK_HANDLE || '@JourneyWorksBank',
  },
});

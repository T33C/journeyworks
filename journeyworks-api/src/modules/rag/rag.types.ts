/**
 * RAG Types
 */

export interface RagDocument {
  id: string;
  content: string;
  contextualizedContent?: string;
  metadata: {
    source: 'communication' | 'case' | 'social' | 'document';
    sourceId: string;
    customerId?: string;
    customerName?: string;
    channel?: string;
    timestamp?: string;
    sentiment?: string;
    tags?: string[];
  };
  embedding?: number[];
  chunkIndex?: number;
  totalChunks?: number;
}

export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  contextPrefix: string;
  contextualizedContent: string;
  startChar: number;
  endChar: number;
  chunkIndex: number;
  totalChunks: number;
  metadata: RagDocument['metadata'];
}

export interface RagQuery {
  query: string;
  topK?: number;
  filters?: {
    sources?: string[];
    customerId?: string;
    channels?: string[];
    startDate?: string;
    endDate?: string;
    sentiments?: string[];
    tags?: string[];
  };
  useReranking?: boolean;
  includeContext?: boolean;
  /** Enable LLM-powered query enhancement for better retrieval. Default: true */
  enhanceQuery?: boolean;
}

export interface RagResult {
  document: RagDocument;
  score: number;
  rerankScore?: number;
  highlights?: string[];
}

export interface RagResponse {
  query: string;
  answer: string;
  confidence: number;
  results: RagResult[];
  sources: Array<{
    id: string;
    relevance: string;
    excerpt: string;
  }>;
  processingTime: number;
}

export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  separators: string[];
}

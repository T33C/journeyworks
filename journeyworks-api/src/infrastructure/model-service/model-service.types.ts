/**
 * Model Service Types
 *
 * Types matching the Python model-service API responses.
 */

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  device_used: string;
}

export interface SparseEmbeddingRequest {
  texts: string[];
}

/**
 * Sparse vector as returned by the Python SPLADE model.
 * Maps token strings to their weights.
 */
export interface SparseVector {
  [token: string]: number;
}

export interface SparseEmbeddingResponse {
  sparse_vectors: SparseVector[];
  model: string;
  device_used: string;
}

export interface RerankDocumentInput {
  id: string | number;
  text: string;
}

export interface RerankRequest {
  query: string;
  documents: RerankDocumentInput[];
  top_n?: number;
  model?: string;
}

export interface ScoredDocument {
  id: string | number;
  text: string;
  score: number;
}

export interface RerankResponse {
  reranked_documents: ScoredDocument[];
  model: string;
  device_used: string;
}

export interface ModelHealthStatus {
  status: string;
  models_loaded: string[];
  compute_device: string;
}

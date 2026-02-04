/**
 * Chunks Service
 *
 * Business logic for RAG chunk operations.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ChunksRepository,
  ChunkDocument,
  ChunkSearchFilters,
} from './chunks.repository';

@Injectable()
export class ChunksService {
  private readonly logger = new Logger(ChunksService.name);

  constructor(private readonly repository: ChunksRepository) {}

  /**
   * Create a new chunk
   */
  async create(data: Partial<ChunkDocument>): Promise<ChunkDocument> {
    const now = new Date().toISOString();
    const chunkDoc: ChunkDocument = {
      chunkId: data.chunkId || uuidv4(),
      communicationId: data.communicationId!,
      content: data.content!,
      context: data.context,
      position: data.position ?? 0,
      chunkType: data.chunkType || 'paragraph',
      tokenCount: data.tokenCount ?? 0,
      overlap: data.overlap,
      denseEmbedding: data.denseEmbedding,
      sparseEmbedding: data.sparseEmbedding,
      metadata: data.metadata || {},
      createdAt: data.createdAt || now,
    };

    await this.repository.create(chunkDoc.chunkId, chunkDoc);
    this.logger.log(`Created chunk: ${chunkDoc.chunkId}`);
    return chunkDoc;
  }

  /**
   * Create multiple chunks in bulk
   */
  async createBulk(
    chunks: Partial<ChunkDocument>[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();
    const documents: ChunkDocument[] = chunks.map((data) => ({
      chunkId: data.chunkId || uuidv4(),
      communicationId: data.communicationId!,
      content: data.content!,
      context: data.context,
      position: data.position ?? 0,
      chunkType: data.chunkType || 'paragraph',
      tokenCount: data.tokenCount ?? 0,
      overlap: data.overlap,
      denseEmbedding: data.denseEmbedding,
      sparseEmbedding: data.sparseEmbedding,
      metadata: data.metadata || {},
      createdAt: data.createdAt || now,
    }));

    // Use chunkId as the document ID for bulk operations
    const docsWithIds = documents.map((doc) => ({ ...doc, id: doc.chunkId }));
    return this.repository.bulkCreate(docsWithIds as any);
  }

  /**
   * Get chunk by ID
   */
  async findById(id: string): Promise<ChunkDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Chunk not found: ${id}`);
    }
    return doc;
  }

  /**
   * Search chunks
   */
  async search(query?: string, filters?: ChunkSearchFilters) {
    return this.repository.searchChunks(query, filters);
  }

  /**
   * Get chunks for a communication
   */
  async findByCommunicationId(
    communicationId: string,
  ): Promise<ChunkDocument[]> {
    return this.repository.findByCommunicationId(communicationId);
  }

  /**
   * Get chunks for a customer
   */
  async findByCustomerId(customerId: string): Promise<ChunkDocument[]> {
    return this.repository.findByCustomerId(customerId);
  }

  /**
   * Semantic search (requires embedding vector)
   */
  async semanticSearch(
    embedding: number[],
    filters?: ChunkSearchFilters,
    k: number = 10,
  ) {
    return this.repository.semanticSearch(embedding, filters, k);
  }

  /**
   * Delete all chunks
   */
  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    return { deleted };
  }
}

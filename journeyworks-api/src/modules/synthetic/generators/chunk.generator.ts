/**
 * Chunk Generator
 *
 * Generates RAG chunks from communications with NPS score metadata.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticChunk,
  SyntheticCommunication,
} from '../synthetic-data.types';
import { hashCode } from '../utils/random.util';

const CHUNK_TYPES = ['paragraph', 'sentence', 'section'] as const;

@Injectable()
export class ChunkGenerator {
  /**
   * Generate chunks from a communication
   */
  generateFromCommunication(
    communication: SyntheticCommunication,
  ): SyntheticChunk[] {
    const content = communication.content;
    const chunks: SyntheticChunk[] = [];

    // Split content into paragraphs
    const paragraphs = content
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);

    paragraphs.forEach((paragraph, index) => {
      const chunk = this.createChunk(
        communication,
        paragraph,
        index,
        'paragraph',
        paragraphs,
      );
      chunks.push(chunk);
    });

    // If content is very long, also create sentence-level chunks
    if (content.length > 500) {
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
      sentences.forEach((sentence, index) => {
        if (sentence.trim().length > 20) {
          const chunk = this.createChunk(
            communication,
            sentence.trim(),
            paragraphs.length + index,
            'sentence',
            sentences,
          );
          chunks.push(chunk);
        }
      });
    }

    return chunks;
  }

  /**
   * Generate chunks from multiple communications
   */
  generateFromCommunications(
    communications: SyntheticCommunication[],
  ): SyntheticChunk[] {
    return communications.flatMap((comm) =>
      this.generateFromCommunication(comm),
    );
  }

  /**
   * Create a chunk with all metadata
   */
  private createChunk(
    communication: SyntheticCommunication,
    content: string,
    position: number,
    chunkType: 'paragraph' | 'sentence' | 'section',
    allChunks: string[],
  ): SyntheticChunk {
    // Calculate context (surrounding chunks)
    const contextStart = Math.max(0, position - 1);
    const contextEnd = Math.min(allChunks.length, position + 2);
    const context = allChunks
      .slice(contextStart, contextEnd)
      .join(' ')
      .substring(0, 500);

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const tokenCount = Math.ceil(content.length / 4);

    // Generate NPS score based on sentiment
    const npsScore = this.generateNpsScore(communication.sentiment.score);

    // Determine product from AI classification or entities
    const product =
      communication.aiClassification?.product ||
      communication.entities?.find((e) => e.type === 'product')?.value ||
      undefined;

    // Determine category from AI classification
    const category = communication.aiClassification?.category || undefined;

    return {
      chunkId: uuidv4(),
      communicationId: communication.id,
      content,
      context,
      position,
      chunkType,
      tokenCount,
      overlap: chunkType === 'sentence' ? Math.floor(tokenCount * 0.1) : 0,
      denseEmbedding: this.generateMockEmbedding(content),
      sparseEmbedding: this.generateMockSparseEmbedding(content),
      metadata: {
        channel: communication.channel,
        timestamp: communication.timestamp,
        customerId: communication.customerId,
        product,
        category,
        sentiment: communication.sentiment.score,
        npsScore,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate NPS score based on sentiment
   * NPS score: 0-10 where:
   * - 0-6: Detractors
   * - 7-8: Passives
   * - 9-10: Promoters
   */
  private generateNpsScore(sentimentScore: number): number {
    // Sentiment score is typically -1 to 1
    // Map to NPS 0-10

    // Base mapping: -1 -> 0, 0 -> 5, 1 -> 10
    const baseScore = Math.round((sentimentScore + 1) * 5);

    // Add some variance (±1)
    const variance = Math.random() < 0.5 ? -1 : Math.random() < 0.5 ? 0 : 1;

    // Clamp to 0-10
    return Math.max(0, Math.min(10, baseScore + variance));
  }

  /**
   * Generate a deterministic mock embedding vector from content.
   * Uses content hash as seed for reproducible vectors.
   * In production, this would call an embedding service.
   */
  generateMockEmbedding(content: string, dimensions: number = 768): number[] {
    const seed = hashCode(content);
    return Array.from({ length: dimensions }, (_, i) => {
      // Simple deterministic pseudo-random based on seed + index
      const x = Math.sin(seed * 9301 + i * 49297) * 49297;
      return (x - Math.floor(x)) * 2 - 1;
    });
  }

  /**
   * Generate deterministic mock sparse embedding from content.
   * In production, this would come from a sparse encoder.
   */
  generateMockSparseEmbedding(content: string): Record<string, number> {
    const words = content
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const uniqueWords = [...new Set(words)].slice(0, 50);

    const sparse: Record<string, number> = {};
    uniqueWords.forEach((word) => {
      const h = hashCode(word);
      // Deterministic weight from hash
      const weight = ((h * 9301 + 49297) % 233280) / 233280;
      sparse[String(h % 30000)] = weight * 2;
    });

    return sparse;
  }
}

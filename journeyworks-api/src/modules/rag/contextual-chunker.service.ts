/**
 * Contextual Chunker Service
 *
 * Implements Anthropic's contextual retrieval approach:
 * Adds context to each chunk to improve retrieval quality.
 *
 * Uses Claude's prompt caching to efficiently process multiple chunks
 * from the same document - the document is cached after the first chunk.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClientService, LlmContentBlock } from '../../infrastructure/llm';
import { RagChunk, ChunkingConfig } from './rag.types';

/** Default model for contextualization - Haiku is 25x cheaper than Sonnet */
const DEFAULT_CONTEXTUALIZATION_MODEL = 'claude-3-5-haiku-latest';

/** LLM call timeout in milliseconds */
const LLM_TIMEOUT_MS = 60_000;

/** Max concurrent chunk contextualization calls */
const CHUNK_CONCURRENCY = 5;

@Injectable()
export class ContextualChunker {
  private readonly logger = new Logger(ContextualChunker.name);
  private readonly config: ChunkingConfig;
  /** Model used for contextual prefix generation - configurable via rag.contextualizationModel */
  private readonly contextualizationModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClientService,
  ) {
    this.config = {
      chunkSize: this.configService.get<number>('rag.chunkSize') || 512,
      chunkOverlap: this.configService.get<number>('rag.chunkOverlap') || 50,
      minChunkSize: this.configService.get<number>('rag.minChunkSize') || 100,
      separators: ['\n\n', '\n', '. ', ', ', ' '],
    };
    // Allow model override via config
    this.contextualizationModel =
      this.configService.get<string>('rag.contextualizationModel') ||
      DEFAULT_CONTEXTUALIZATION_MODEL;
  }

  /**
   * Chunk a document into smaller pieces
   */
  chunkDocument(
    documentId: string,
    content: string,
    metadata: RagChunk['metadata'],
  ): Omit<RagChunk, 'contextPrefix' | 'contextualizedContent'>[] {
    const chunks: Omit<RagChunk, 'contextPrefix' | 'contextualizedContent'>[] =
      [];

    // Split content into chunks
    const rawChunks = this.splitText(
      content,
      this.config.chunkSize,
      this.config.chunkOverlap,
    );

    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];

      if (chunk.content.length < this.config.minChunkSize) {
        continue;
      }

      chunks.push({
        id: `${documentId}-chunk-${i}`,
        documentId,
        content: chunk.content,
        startChar: chunk.start,
        endChar: chunk.end,
        chunkIndex: i,
        totalChunks: rawChunks.length,
        metadata,
      });
    }

    return chunks;
  }

  /**
   * Add contextual prefixes to chunks using prompt caching.
   * This is the key innovation from Anthropic's contextual retrieval.
   *
   * Uses Claude's prompt caching: the document is sent once and cached,
   * then each chunk is processed with the cached document context.
   * This reduces costs by ~90% for documents with multiple chunks.
   */
  async contextualizeChunks(
    chunks: Omit<RagChunk, 'contextPrefix' | 'contextualizedContent'>[],
    fullDocument: string,
    documentSummary: string,
  ): Promise<RagChunk[]> {
    // Build the cached system content with the full document
    // This gets cached after the first API call
    const systemBlocks: LlmContentBlock[] = [
      {
        type: 'text',
        text: `You are helping to add contextual information to document chunks for improved search retrieval.

Here is the full document:
<document>
${fullDocument}
</document>

${documentSummary ? `Document summary: ${documentSummary}` : ''}

For each chunk provided, generate a short (2-3 sentence) context that:
1. Explains what this chunk is about in relation to the whole document
2. Includes any key entities, dates, or identifiers mentioned in the document but not in the chunk
3. Would help someone searching for this content to find it

Respond with ONLY the contextual prefix, no other text.`,
        // Mark this content for caching - subsequent calls reuse it
        cacheControl: { type: 'ephemeral' },
      },
    ];

    // Process chunks in batches for parallelism while respecting rate limits
    const contextualizedChunks: RagChunk[] = [];

    for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
      const batch = chunks.slice(i, i + CHUNK_CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((chunk) =>
          this.generateContextPrefixWithCache(
            chunk.content,
            chunk.metadata,
            systemBlocks,
          ).then((contextPrefix) => ({
            ...chunk,
            contextPrefix,
            contextualizedContent: `${contextPrefix}\n\n${chunk.content}`,
          })),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          contextualizedChunks.push(result.value);
        } else {
          // If contextualization fails, use a simple prefix
          const chunk = batch[j];
          this.logger.warn(
            `Failed to contextualize chunk ${chunk.id}: ${result.reason?.message}`,
          );
          const simplePrefix = this.generateSimplePrefix(chunk.metadata);
          contextualizedChunks.push({
            ...chunk,
            contextPrefix: simplePrefix,
            contextualizedContent: `${simplePrefix}\n\n${chunk.content}`,
          });
        }
      }
    }

    return contextualizedChunks;
  }

  /**
   * Generate contextual prefix using LLM with prompt caching
   */
  private async generateContextPrefixWithCache(
    chunkContent: string,
    metadata: RagChunk['metadata'],
    systemBlocks: LlmContentBlock[],
  ): Promise<string> {
    const userMessage = `Generate a contextual prefix for this chunk:

<chunk>
${chunkContent}
</chunk>

Metadata:
- Source type: ${metadata.source}
- Channel: ${metadata.channel || 'N/A'}
- Customer: ${metadata.customerName || 'Unknown'}
- Date: ${metadata.timestamp || 'Unknown'}`;

    const response = await Promise.race([
      this.llmClient.complete(
        {
          messages: [{ role: 'user', content: userMessage }],
          systemBlocks,
          model: this.contextualizationModel, // Use Haiku for cost efficiency
          maxTokens: 150,
          temperature: 0.1,
        },
        { rateLimitKey: 'llm:contextualization' },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('LLM complete timed out')),
          LLM_TIMEOUT_MS,
        ),
      ),
    ]);

    // Extract just the prefix (should be 2-3 sentences)
    const prefix = response.content.trim();

    // Limit prefix length
    if (prefix.length > 300) {
      return prefix.substring(0, 297) + '...';
    }

    return prefix;
  }

  /**
   * Generate simple prefix without LLM
   */
  private generateSimplePrefix(metadata: RagChunk['metadata']): string {
    const parts: string[] = [];

    if (metadata.source) {
      parts.push(`This is from a ${metadata.source}`);
    }

    if (metadata.customerName) {
      parts.push(`related to customer ${metadata.customerName}`);
    }

    if (metadata.channel) {
      parts.push(`via ${metadata.channel}`);
    }

    if (metadata.timestamp) {
      const date = new Date(metadata.timestamp).toLocaleDateString();
      parts.push(`dated ${date}`);
    }

    if (metadata.sentiment) {
      parts.push(`with ${metadata.sentiment} sentiment`);
    }

    return parts.join(' ') + '.';
  }

  /**
   * Split text into chunks with overlap
   */
  private splitText(
    text: string,
    chunkSize: number,
    overlap: number,
  ): Array<{ content: string; start: number; end: number }> {
    const chunks: Array<{ content: string; start: number; end: number }> = [];

    if (text.length <= chunkSize) {
      return [{ content: text, start: 0, end: text.length }];
    }

    let position = 0;

    while (position < text.length) {
      // Determine end position
      let end = Math.min(position + chunkSize, text.length);

      // Try to break at a natural boundary
      if (end < text.length) {
        const searchStart = Math.max(
          position + Math.floor(chunkSize * 0.7),
          position,
        );
        let bestBreak = end;

        for (const separator of this.config.separators) {
          const breakPoint = text.lastIndexOf(separator, end);
          if (breakPoint > searchStart) {
            bestBreak = breakPoint + separator.length;
            break;
          }
        }

        end = bestBreak;
      }

      const content = text.substring(position, end).trim();
      if (content.length >= this.config.minChunkSize) {
        chunks.push({ content, start: position, end });
      }

      // Move position with overlap
      position = end - overlap;

      // Ensure we make progress
      if (position >= text.length - 10) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Chunk multiple documents in batch
   */
  async chunkDocumentsBatch(
    documents: Array<{
      id: string;
      content: string;
      summary?: string;
      metadata: RagChunk['metadata'];
    }>,
    withContextualization: boolean = true,
  ): Promise<RagChunk[]> {
    const allChunks: RagChunk[] = [];

    for (const doc of documents) {
      const rawChunks = this.chunkDocument(doc.id, doc.content, doc.metadata);

      if (withContextualization) {
        const contextualizedChunks = await this.contextualizeChunks(
          rawChunks,
          doc.content,
          doc.summary || '',
        );
        allChunks.push(...contextualizedChunks);
      } else {
        // Add simple prefixes without LLM
        for (const chunk of rawChunks) {
          const prefix = this.generateSimplePrefix(chunk.metadata);
          allChunks.push({
            ...chunk,
            contextPrefix: prefix,
            contextualizedContent: `${prefix}\n\n${chunk.content}`,
          });
        }
      }
    }

    return allChunks;
  }
}

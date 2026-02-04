/**
 * RAG Module
 *
 * Implements Retrieval-Augmented Generation with contextual embeddings,
 * query enhancement, and structured response formatting for customer
 * intelligence research.
 */

import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { ContextualChunker } from './contextual-chunker.service';
import { QueryEnhancerService } from './query-enhancer.service';
import { ResponseFormatterService } from './response-formatter.service';
import { RagController } from './rag.controller';
import { CommunicationsModule } from '../communications';

@Module({
  imports: [CommunicationsModule],
  controllers: [RagController],
  providers: [
    RagService,
    ContextualChunker,
    QueryEnhancerService,
    ResponseFormatterService,
  ],
  exports: [RagService, QueryEnhancerService, ResponseFormatterService],
})
export class RagModule {}

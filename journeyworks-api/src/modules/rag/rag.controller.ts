/**
 * RAG Controller
 *
 * REST API endpoints for RAG operations.
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RagService } from './rag.service';
import { RagResponse, RagResult } from './rag.types';

// DTOs
class RagQueryFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sentiments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class RagQueryDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  topK?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RagQueryFiltersDto)
  filters?: RagQueryFiltersDto;

  @IsOptional()
  @IsBoolean()
  useReranking?: boolean;

  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;

  @IsOptional()
  @IsBoolean()
  enhanceQuery?: boolean;
}

class SemanticSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  topK?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RagQueryFiltersDto)
  filters?: RagQueryFiltersDto;
}

class CustomerQuestionDto {
  @IsString()
  question: string;
}

@ApiTags('rag')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('query')
  @ApiOperation({ summary: 'Query the knowledge base using RAG' })
  @ApiResponse({ status: 200, description: 'RAG response' })
  async query(@Body() dto: RagQueryDto): Promise<RagResponse> {
    return this.ragService.query(dto);
  }

  @Post('search')
  @ApiOperation({ summary: 'Semantic search without answer generation' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Body() dto: SemanticSearchDto): Promise<RagResult[]> {
    return this.ragService.semanticSearch(dto.query, dto.topK, dto.filters);
  }

  @Get('similar/:documentId')
  @ApiOperation({ summary: 'Find documents similar to a given document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiQuery({ name: 'topK', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Similar documents' })
  async findSimilar(
    @Param('documentId') documentId: string,
    @Query('topK') topK?: number,
  ): Promise<RagResult[]> {
    return this.ragService.findSimilar(documentId, topK);
  }

  @Post('customer/:customerId/ask')
  @ApiOperation({ summary: 'Ask a question about a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Answer about customer' })
  async askAboutCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: CustomerQuestionDto,
  ): Promise<RagResponse> {
    return this.ragService.askAboutCustomer(customerId, dto.question);
  }

  @Get('customer/:customerId/summary')
  @ApiOperation({ summary: 'Get a summary of customer communications' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'maxCommunications', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Customer summary' })
  async summarizeCustomer(
    @Param('customerId') customerId: string,
    @Query('maxCommunications') maxCommunications?: number,
  ): Promise<{ summary: string }> {
    const summary = await this.ragService.summarizeCustomerCommunications(
      customerId,
      maxCommunications,
    );
    return { summary };
  }

  @Post('index')
  @ApiOperation({ summary: 'Index documents for RAG (generate embeddings)' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexDocuments(
    @Body() body?: { documentIds?: string[] },
  ): Promise<{ indexed: number }> {
    return this.ragService.indexDocuments(body?.documentIds);
  }
}

/**
 * RAG Controller
 *
 * REST API endpoints for RAG operations.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
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
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
  IsIn,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RagService } from './rag.service';
import { RagResponse, RagResult } from './rag.types';

/** Validation constants */
const MAX_QUERY_LENGTH = 2000;
const MIN_QUERY_LENGTH = 2;
const MAX_TOP_K = 100;
const MIN_TOP_K = 1;
const MAX_BATCH_SIZE = 100;
const MAX_COMMUNICATIONS = 50;
const VALID_CHANNELS = ['email', 'chat', 'phone', 'social', 'web', 'mobile'];
const VALID_SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

// DTOs
class RagQueryFiltersDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(VALID_CHANNELS.length)
  @IsIn(VALID_CHANNELS, { each: true, message: 'Invalid channel' })
  channels?: string[];

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_REGEX, { message: 'startDate must be ISO 8601 format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_REGEX, { message: 'endDate must be ISO 8601 format' })
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(VALID_SENTIMENTS.length)
  @IsIn(VALID_SENTIMENTS, { each: true, message: 'Invalid sentiment' })
  sentiments?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

class RagQueryDto {
  @IsString()
  @MinLength(MIN_QUERY_LENGTH, { message: 'Query is too short' })
  @MaxLength(MAX_QUERY_LENGTH, {
    message: `Query must not exceed ${MAX_QUERY_LENGTH} characters`,
  })
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(MIN_TOP_K, { message: `topK must be at least ${MIN_TOP_K}` })
  @Max(MAX_TOP_K, { message: `topK must not exceed ${MAX_TOP_K}` })
  @Type(() => Number)
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
  @MinLength(MIN_QUERY_LENGTH, { message: 'Query is too short' })
  @MaxLength(MAX_QUERY_LENGTH, {
    message: `Query must not exceed ${MAX_QUERY_LENGTH} characters`,
  })
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(MIN_TOP_K)
  @Max(MAX_TOP_K)
  @Type(() => Number)
  topK?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RagQueryFiltersDto)
  filters?: RagQueryFiltersDto;
}

class CustomerQuestionDto {
  @IsString()
  @MinLength(MIN_QUERY_LENGTH, { message: 'Question is too short' })
  @MaxLength(MAX_QUERY_LENGTH, {
    message: `Question must not exceed ${MAX_QUERY_LENGTH} characters`,
  })
  question: string;
}

class IndexDocumentsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BATCH_SIZE, {
    message: `Cannot index more than ${MAX_BATCH_SIZE} documents at once`,
  })
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  documentIds?: string[];
}

/** Validate ID format - alphanumeric with dashes/underscores */
function validateId(id: string, name: string): void {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    throw new BadRequestException(`Invalid ${name} format`);
  }
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
    @Query('topK', { transform: (v) => (v ? parseInt(v, 10) : undefined) })
    topK?: number,
  ): Promise<RagResult[]> {
    validateId(documentId, 'documentId');
    const validatedTopK = topK
      ? Math.min(Math.max(topK, MIN_TOP_K), MAX_TOP_K)
      : undefined;
    return this.ragService.findSimilar(documentId, validatedTopK);
  }

  @Post('customer/:customerId/ask')
  @ApiOperation({ summary: 'Ask a question about a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Answer about customer' })
  async askAboutCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: CustomerQuestionDto,
  ): Promise<RagResponse> {
    validateId(customerId, 'customerId');
    return this.ragService.askAboutCustomer(customerId, dto.question);
  }

  @Get('customer/:customerId/summary')
  @ApiOperation({ summary: 'Get a summary of customer communications' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'maxCommunications', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Customer summary' })
  async summarizeCustomer(
    @Param('customerId') customerId: string,
    @Query('maxCommunications', {
      transform: (v) => (v ? parseInt(v, 10) : undefined),
    })
    maxCommunications?: number,
  ): Promise<{ summary: string }> {
    validateId(customerId, 'customerId');
    const validatedMax = maxCommunications
      ? Math.min(Math.max(maxCommunications, 1), MAX_COMMUNICATIONS)
      : undefined;
    const summary = await this.ragService.summarizeCustomerCommunications(
      customerId,
      validatedMax,
    );
    return { summary };
  }

  @Post('index')
  @ApiOperation({ summary: 'Index documents for RAG (generate embeddings)' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexDocuments(
    @Body() body?: IndexDocumentsDto,
  ): Promise<{ indexed: number }> {
    return this.ragService.indexDocuments(body?.documentIds);
  }
}

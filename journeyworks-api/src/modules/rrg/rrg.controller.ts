/**
 * RRG Controller
 *
 * REST API endpoints for natural language to DSL conversion.
 */

import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
  MinLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RrgService } from './rrg.service';
import {
  NlQueryRequest,
  GeneratedDsl,
  QueryExecutionResult,
} from './rrg.types';

/** Maximum query length to prevent abuse */
const MAX_QUERY_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 5000;
const MAX_FEEDBACK_LENGTH = 1000;

/** Valid index names for RRG queries */
const VALID_INDICES = ['communications', 'cases', 'social-mentions'] as const;

// DTOs with proper validation
class PreviousQueryDto {
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  nl: string;

  @IsObject()
  dsl: any;
}

class NlQueryDto implements NlQueryRequest {
  @IsString()
  @MinLength(3, { message: 'Query must be at least 3 characters' })
  @MaxLength(MAX_QUERY_LENGTH, {
    message: `Query must not exceed ${MAX_QUERY_LENGTH} characters`,
  })
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTEXT_LENGTH)
  context?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviousQueryDto)
  previousQueries?: PreviousQueryDto[];

  @IsOptional()
  @IsString()
  @IsIn(VALID_INDICES, {
    message:
      'Invalid index. Must be one of: communications, cases, social-mentions',
  })
  index?: string;

  @IsOptional()
  @IsBoolean()
  validate?: boolean;

  @IsOptional()
  @IsBoolean()
  execute?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;
}

class RefineQueryDto {
  @ValidateNested()
  @Type(() => NlQueryDto)
  originalQuery: NlQueryDto;

  @IsString()
  @MinLength(3)
  @MaxLength(MAX_FEEDBACK_LENGTH)
  feedback: string;

  @IsObject()
  previousDsl: GeneratedDsl;
}

@ApiTags('rrg')
@Controller('rrg')
export class RrgController {
  constructor(private readonly rrgService: RrgService) {}

  @Post('query')
  @ApiOperation({
    summary: 'Convert natural language to DSL and optionally execute',
  })
  @ApiResponse({ status: 200, description: 'Generated DSL or query results' })
  async query(
    @Body() dto: NlQueryDto,
  ): Promise<QueryExecutionResult | GeneratedDsl> {
    return this.rrgService.query(dto);
  }

  @Post('parse')
  @ApiOperation({ summary: 'Parse natural language to DSL without executing' })
  @ApiResponse({ status: 200, description: 'Generated DSL' })
  async parse(@Body() dto: NlQueryDto): Promise<GeneratedDsl> {
    const result = await this.rrgService.query({ ...dto, execute: false });
    return result as GeneratedDsl;
  }

  @Post('execute')
  @ApiOperation({ summary: 'Parse natural language to DSL and execute' })
  @ApiResponse({ status: 200, description: 'Query execution results' })
  async execute(@Body() dto: NlQueryDto): Promise<QueryExecutionResult> {
    const result = await this.rrgService.query({ ...dto, execute: true });
    return result as QueryExecutionResult;
  }

  @Post('refine')
  @ApiOperation({ summary: 'Refine a query based on feedback' })
  @ApiResponse({ status: 200, description: 'Refined DSL' })
  async refine(@Body() dto: RefineQueryDto): Promise<GeneratedDsl> {
    return this.rrgService.refineQuery(
      dto.originalQuery,
      dto.feedback,
      dto.previousDsl,
    );
  }

  @Get('examples')
  @ApiOperation({ summary: 'Get example natural language queries' })
  @ApiQuery({ name: 'index', required: false })
  @ApiResponse({ status: 200, description: 'Example queries' })
  getExamples(@Query('index') index?: string): { examples: string[] } {
    return { examples: this.rrgService.getExampleQueries(index) };
  }
}

/**
 * RRG Controller
 *
 * REST API endpoints for natural language to DSL conversion.
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RrgService } from './rrg.service';
import {
  NlQueryRequest,
  GeneratedDsl,
  QueryExecutionResult,
} from './rrg.types';

// DTOs
class NlQueryDto implements NlQueryRequest {
  query: string;
  context?: string;
  previousQueries?: Array<{ nl: string; dsl: any }>;
  index?: string;
  validate?: boolean;
  execute?: boolean;
}

class RefineQueryDto {
  originalQuery: NlQueryRequest;
  feedback: string;
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

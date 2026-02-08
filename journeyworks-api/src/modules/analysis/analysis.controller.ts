/**
 * Analysis Controller
 *
 * REST API endpoints for analysis capabilities.
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
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnalysisService } from './analysis.service';
import {
  AnalysisRequest,
  AnalysisResult,
  AnalysisType,
} from './analysis.types';

/** Validation constants */
const MAX_QUERY_LENGTH = 2000;
const MAX_TARGET_ID_LENGTH = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 1000;
const MAX_FOCUS_AREAS = 10;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

/** Valid analysis types */
const VALID_ANALYSIS_TYPES: AnalysisType[] = [
  'sentiment',
  'topics',
  'trends',
  'customer-health',
  'risk-assessment',
  'communication-patterns',
  'issue-detection',
  'relationship-summary',
  'data-card',
];

/** Validate ID format - alphanumeric with dashes/underscores */
function validateId(id: string, name: string): void {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    throw new BadRequestException(`Invalid ${name} format`);
  }
}

/** Validate and parse date string */
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  if (!ISO_DATE_REGEX.test(dateStr)) {
    throw new BadRequestException(
      `Invalid date format. Expected ISO 8601 (e.g., 2024-01-01 or 2024-01-01T00:00:00Z)`,
    );
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date value: ${dateStr}`);
  }
  return date;
}

// DTOs
class TimeRangeDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_REGEX, { message: 'from must be ISO 8601 format' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_REGEX, { message: 'to must be ISO 8601 format' })
  to?: string;
}

class AnalysisOptionsDto {
  @IsOptional()
  @IsBoolean()
  detailed?: boolean;

  @IsOptional()
  @IsBoolean()
  compareWithPrevious?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(MIN_LIMIT, { message: `limit must be at least ${MIN_LIMIT}` })
  @Max(MAX_LIMIT, { message: `limit must not exceed ${MAX_LIMIT}` })
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  focusAreas?: string[];
}

class AnalysisRequestDto implements AnalysisRequest {
  @IsEnum(VALID_ANALYSIS_TYPES, {
    message: `type must be one of: ${VALID_ANALYSIS_TYPES.join(', ')}`,
  })
  type: AnalysisType;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TARGET_ID_LENGTH)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TARGET_ID_LENGTH)
  product?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRangeDto)
  timeRange?: TimeRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisOptionsDto)
  options?: AnalysisOptionsDto;
}

/**
 * DTO for convenience endpoints (POST /analysis/sentiment, /topics, etc.)
 * where the analysis type is set by the route, not the body.
 * This avoids the Omit<> problem where class-validator still requires `type`.
 */
class AnalysisBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TARGET_ID_LENGTH)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TARGET_ID_LENGTH)
  product?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRangeDto)
  timeRange?: TimeRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisOptionsDto)
  options?: AnalysisOptionsDto;
}

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  @ApiOperation({ summary: 'Perform analysis on communications' })
  @ApiResponse({ status: 200, description: 'Analysis result' })
  async analyze(@Body() dto: AnalysisRequestDto): Promise<AnalysisResult> {
    return this.analysisService.analyze(dto);
  }

  @Post('sentiment')
  @ApiOperation({ summary: 'Analyze sentiment across communications' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis result' })
  async analyzeSentiment(
    @Body() dto: AnalysisBodyDto,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'sentiment' });
  }

  @Post('topics')
  @ApiOperation({ summary: 'Analyze topics in communications' })
  @ApiResponse({ status: 200, description: 'Topic analysis result' })
  async analyzeTopics(@Body() dto: AnalysisBodyDto): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'topics' });
  }

  @Post('trends')
  @ApiOperation({ summary: 'Analyze trends over time' })
  @ApiResponse({ status: 200, description: 'Trend analysis result' })
  async analyzeTrends(@Body() dto: AnalysisBodyDto): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'trends' });
  }

  @Get('customer/:customerId/health')
  @ApiOperation({ summary: 'Analyze customer health' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer health analysis' })
  async customerHealth(
    @Param('customerId') customerId: string,
    @Query('includeRecommendations') includeRecommendations?: boolean,
  ): Promise<AnalysisResult> {
    validateId(customerId, 'customerId');
    return this.analysisService.analyze({
      type: 'customer-health',
      targetId: customerId,
      options: { includeRecommendations: includeRecommendations !== false },
    });
  }

  @Get('customer/:customerId/relationship')
  @ApiOperation({ summary: 'Get customer relationship summary' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Relationship summary' })
  async relationshipSummary(
    @Param('customerId') customerId: string,
  ): Promise<AnalysisResult> {
    validateId(customerId, 'customerId');
    return this.analysisService.analyze({
      type: 'relationship-summary',
      targetId: customerId,
    });
  }

  @Post('risk')
  @ApiOperation({ summary: 'Assess risk across communications' })
  @ApiResponse({ status: 200, description: 'Risk assessment result' })
  async assessRisk(@Body() dto: AnalysisBodyDto): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'risk-assessment' });
  }

  @Post('patterns')
  @ApiOperation({ summary: 'Analyze communication patterns' })
  @ApiResponse({ status: 200, description: 'Pattern analysis result' })
  async analyzePatterns(@Body() dto: AnalysisBodyDto): Promise<AnalysisResult> {
    return this.analysisService.analyze({
      ...dto,
      type: 'communication-patterns',
    });
  }

  @Post('issues')
  @ApiOperation({ summary: 'Detect issues in communications' })
  @ApiResponse({ status: 200, description: 'Issue detection result' })
  async detectIssues(@Body() dto: AnalysisBodyDto): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'issue-detection' });
  }

  @Post('data-card')
  @ApiOperation({ summary: 'Generate data card for communications' })
  @ApiResponse({ status: 200, description: 'Data card result' })
  async generateDataCard(
    @Body() dto: AnalysisBodyDto,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'data-card' });
  }

  // ============================================================
  // Dashboard API Endpoints
  // ============================================================

  @Get('timeline/events')
  @ApiOperation({ summary: 'Get timeline events for dashboard' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO format)',
  })
  @ApiQuery({
    name: 'product',
    required: false,
    description: 'Filter by product',
  })
  @ApiResponse({ status: 200, description: 'Timeline events' })
  async getTimelineEvents(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
  ) {
    return this.analysisService.getTimelineEvents({
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      product,
    });
  }

  @Get('timeline/bubbles')
  @ApiOperation({ summary: 'Get sentiment bubbles for timeline chart' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO format)',
  })
  @ApiQuery({
    name: 'product',
    required: false,
    description: 'Filter by product',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter by channel',
  })
  @ApiResponse({ status: 200, description: 'Sentiment bubbles' })
  async getSentimentBubbles(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
    @Query('channel') channel?: string,
  ) {
    return this.analysisService.getSentimentBubbles({
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      product,
      channel,
    });
  }

  @Get('journey/stages')
  @ApiOperation({ summary: 'Get journey stages for waterfall chart' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO format)',
  })
  @ApiQuery({
    name: 'product',
    required: false,
    description: 'Filter by product',
  })
  @ApiResponse({ status: 200, description: 'Journey stages' })
  async getJourneyStages(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
  ) {
    return this.analysisService.getJourneyStages({
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      product,
    });
  }

  @Get('quadrant/items')
  @ApiOperation({ summary: 'Get quadrant items for scatter plot' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO format)',
  })
  @ApiQuery({
    name: 'product',
    required: false,
    description: 'Filter by product',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter by channel',
  })
  @ApiResponse({ status: 200, description: 'Quadrant items' })
  async getQuadrantItems(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
    @Query('channel') channel?: string,
  ) {
    return this.analysisService.getQuadrantItems({
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      product,
      channel,
    });
  }
}

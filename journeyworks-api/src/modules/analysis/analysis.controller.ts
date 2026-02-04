/**
 * Analysis Controller
 *
 * REST API endpoints for analysis capabilities.
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import {
  AnalysisRequest,
  AnalysisResult,
  AnalysisType,
} from './analysis.types';

// DTOs
class AnalysisRequestDto implements AnalysisRequest {
  type: AnalysisType;
  targetId?: string;
  query?: string;
  timeRange?: {
    from?: string;
    to?: string;
  };
  options?: {
    detailed?: boolean;
    compareWithPrevious?: boolean;
    limit?: number;
    includeRecommendations?: boolean;
    focusAreas?: string[];
  };
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
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'sentiment' });
  }

  @Post('topics')
  @ApiOperation({ summary: 'Analyze topics in communications' })
  @ApiResponse({ status: 200, description: 'Topic analysis result' })
  async analyzeTopics(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'topics' });
  }

  @Post('trends')
  @ApiOperation({ summary: 'Analyze trends over time' })
  @ApiResponse({ status: 200, description: 'Trend analysis result' })
  async analyzeTrends(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
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
    return this.analysisService.analyze({
      type: 'relationship-summary',
      targetId: customerId,
    });
  }

  @Post('risk')
  @ApiOperation({ summary: 'Assess risk across communications' })
  @ApiResponse({ status: 200, description: 'Risk assessment result' })
  async assessRisk(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'risk-assessment' });
  }

  @Post('patterns')
  @ApiOperation({ summary: 'Analyze communication patterns' })
  @ApiResponse({ status: 200, description: 'Pattern analysis result' })
  async analyzePatterns(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({
      ...dto,
      type: 'communication-patterns',
    });
  }

  @Post('issues')
  @ApiOperation({ summary: 'Detect issues in communications' })
  @ApiResponse({ status: 200, description: 'Issue detection result' })
  async detectIssues(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
  ): Promise<AnalysisResult> {
    return this.analysisService.analyze({ ...dto, type: 'issue-detection' });
  }

  @Post('data-card')
  @ApiOperation({ summary: 'Generate data card for communications' })
  @ApiResponse({ status: 200, description: 'Data card result' })
  async generateDataCard(
    @Body() dto: Omit<AnalysisRequestDto, 'type'>,
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
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
  @ApiResponse({ status: 200, description: 'Quadrant items' })
  async getQuadrantItems(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
  ) {
    return this.analysisService.getQuadrantItems({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      product,
    });
  }
}

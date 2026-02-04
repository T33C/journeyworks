/**
 * Communications Controller
 *
 * REST API endpoints for communication operations.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import {
  CreateCommunicationDto,
  UpdateCommunicationDto,
  SearchCommunicationsDto,
  SemanticSearchDto,
  CommunicationResponseDto,
  PaginatedCommunicationsDto,
  CommunicationAggregationsDto,
  UpdateStatusDto,
  CommunicationStatsDto,
} from './dto';

@ApiTags('communications')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new communication' })
  @ApiResponse({
    status: 201,
    description: 'Communication created successfully',
    type: CommunicationResponseDto,
  })
  async create(
    @Body() dto: CreateCommunicationDto,
  ): Promise<CommunicationResponseDto> {
    return this.service.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple communications' })
  @ApiResponse({
    status: 201,
    description: 'Communications created successfully',
  })
  async createBulk(
    @Body() dtos: CreateCommunicationDto[],
  ): Promise<{ created: number; failed: number }> {
    return this.service.createBulk(dtos);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search communications' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: PaginatedCommunicationsDto,
  })
  async search(
    @Query() dto: SearchCommunicationsDto,
  ): Promise<PaginatedCommunicationsDto> {
    return this.service.search(dto);
  }

  @Post('search/semantic')
  @ApiOperation({ summary: 'Semantic search using vector similarity' })
  @ApiResponse({
    status: 200,
    description: 'Semantic search results',
    type: PaginatedCommunicationsDto,
  })
  async semanticSearch(
    @Body() dto: SemanticSearchDto,
  ): Promise<PaginatedCommunicationsDto> {
    return this.service.semanticSearch(dto);
  }

  @Get('aggregations')
  @ApiOperation({ summary: 'Get communication aggregations' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({
    status: 200,
    description: 'Aggregation results',
    type: CommunicationAggregationsDto,
  })
  async getAggregations(
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CommunicationAggregationsDto> {
    return this.service.getAggregations(customerId, startDate, endDate);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent communications' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items (default: 20)',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter by channel',
  })
  @ApiQuery({
    name: 'sentiment',
    required: false,
    description: 'Filter by sentiment',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent communications',
    type: PaginatedCommunicationsDto,
  })
  async getRecent(
    @Query('limit') limit?: number,
    @Query('channel') channel?: string,
    @Query('sentiment') sentiment?: string,
  ): Promise<PaginatedCommunicationsDto> {
    return this.service.getRecent(limit || 20, channel, sentiment);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get communication statistics for dashboard' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for stats period',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for stats period',
  })
  @ApiResponse({
    status: 200,
    description: 'Communication statistics',
    type: CommunicationStatsDto,
  })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CommunicationStatsDto> {
    return this.service.getStats(startDate, endDate);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get communications by customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Customer communications',
    type: PaginatedCommunicationsDto,
  })
  async getByCustomer(
    @Param('customerId') customerId: string,
    @Query('from') from?: number,
    @Query('size') size?: number,
  ): Promise<PaginatedCommunicationsDto> {
    return this.service.getByCustomer(customerId, from, size);
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get communications by case' })
  @ApiParam({ name: 'caseId', description: 'Case ID' })
  @ApiResponse({
    status: 200,
    description: 'Case communications',
    type: [CommunicationResponseDto],
  })
  async getByCase(
    @Param('caseId') caseId: string,
  ): Promise<CommunicationResponseDto[]> {
    return this.service.getByCase(caseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get communication by ID' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({
    status: 200,
    description: 'Communication found',
    type: CommunicationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async findById(@Param('id') id: string): Promise<CommunicationResponseDto> {
    return this.service.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a communication' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({
    status: 200,
    description: 'Communication updated',
    type: CommunicationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationDto,
  ): Promise<CommunicationResponseDto> {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update communication status' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: CommunicationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<CommunicationResponseDto> {
    return this.service.updateStatus(id, dto.status, dto.note);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a communication' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({ status: 204, description: 'Communication deleted' })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze communication content using LLM' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({
    status: 200,
    description: 'Analysis results',
  })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async analyzeContent(@Param('id') id: string): Promise<{
    sentiment: { label: string; score: number; confidence: number };
    intent: { primary: string; secondary: string[]; confidence: number };
    entities: Array<{ type: string; value: string; confidence: number }>;
    summary: string;
  }> {
    return this.service.analyzeContent(id);
  }

  @Post(':id/embedding')
  @ApiOperation({ summary: 'Generate embedding for a communication' })
  @ApiParam({ name: 'id', description: 'Communication ID' })
  @ApiResponse({ status: 200, description: 'Embedding generated' })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  async generateEmbedding(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.service.generateEmbedding(id);
    return { success: true };
  }

  @Post('embeddings/bulk')
  @ApiOperation({ summary: 'Bulk generate embeddings for communications' })
  @ApiResponse({
    status: 200,
    description: 'Embeddings generated',
  })
  async bulkGenerateEmbeddings(
    @Body() body?: { ids?: string[]; limit?: number },
  ): Promise<{ processed: number }> {
    return this.service.bulkGenerateEmbeddings(body?.ids, body?.limit);
  }
}

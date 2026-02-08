/**
 * Synthetic Data Controller
 *
 * REST API endpoints for synthetic data generation.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SyntheticDataService } from './synthetic-data.service';
import {
  GenerationConfig,
  GenerationResult,
  SyntheticCustomer,
  SyntheticCase,
  SyntheticSocialMention,
} from './synthetic-data.types';

@ApiTags('synthetic-data')
@Controller('synthetic')
export class SyntheticDataController {
  constructor(private readonly service: SyntheticDataService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate synthetic data with custom configuration',
  })
  @ApiResponse({ status: 200, description: 'Generation completed' })
  async generate(
    @Body() config?: Partial<GenerationConfig>,
  ): Promise<GenerationResult> {
    return this.service.generateAll(config);
  }

  @Post('generate/sample')
  @ApiOperation({ summary: 'Generate a small sample dataset for testing' })
  @ApiResponse({ status: 200, description: 'Sample generation completed' })
  async generateSample(): Promise<GenerationResult> {
    return this.service.generateSample();
  }

  @Post('generate/demo')
  @ApiOperation({ summary: 'Generate full demo dataset' })
  @ApiResponse({ status: 200, description: 'Demo generation completed' })
  async generateDemo(): Promise<GenerationResult> {
    return this.service.generateDemo();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current data generation status' })
  @ApiResponse({ status: 200, description: 'Current status' })
  async getStatus(): Promise<{
    customers: number;
    communications: number;
    cases: number;
    socialMentions: number;
  }> {
    return this.service.getStatus();
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear all synthetic data from Elasticsearch' })
  @ApiResponse({ status: 200, description: 'Data cleared' })
  async clear(): Promise<{
    success: boolean;
    customers: number;
    communications: number;
    cases: number;
    socialMentions: number;
  }> {
    const result = await this.service.clearAll();
    return { success: true, ...result };
  }

  // Customer endpoints
  @Get('customers')
  @ApiOperation({ summary: 'Get all synthetic customers' })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 100)',
  })
  @ApiResponse({ status: 200, description: 'List of customers' })
  async getCustomers(
    @Query('tier') tier?: string,
    @Query('region') region?: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    let customers = await this.service.getAllCustomers();

    if (tier) {
      customers = customers.filter((c) => c.tier === tier);
    }

    if (region) {
      customers = customers.filter((c) => c.region === region);
    }

    const maxResults = Math.min(parseInt(limit || '100', 10) || 100, 1000);
    return customers.slice(0, maxResults);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomer(@Param('id') id: string): Promise<any | undefined> {
    return this.service.getCustomer(id);
  }

  // Case endpoints
  @Get('cases')
  @ApiOperation({ summary: 'Get all synthetic cases' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 100)',
  })
  @ApiResponse({ status: 200, description: 'List of cases' })
  async getCases(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    let cases = await this.service.getAllCases();

    if (status) {
      cases = cases.filter((c) => c.status === status);
    }

    if (priority) {
      cases = cases.filter((c) => c.priority === priority);
    }

    if (customerId) {
      cases = cases.filter((c) => c.customerId === customerId);
    }

    const maxResults = Math.min(parseInt(limit || '100', 10) || 100, 1000);
    return cases.slice(0, maxResults);
  }

  @Get('cases/:id')
  @ApiOperation({ summary: 'Get case by ID' })
  @ApiParam({ name: 'id', description: 'Case ID' })
  @ApiResponse({ status: 200, description: 'Case details' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async getCase(@Param('id') id: string): Promise<any | undefined> {
    return this.service.getCase(id);
  }

  // Social mention endpoints
  @Get('social-mentions')
  @ApiOperation({ summary: 'Get all synthetic social mentions' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'sentiment', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 100)',
  })
  @ApiResponse({ status: 200, description: 'List of social mentions' })
  async getSocialMentions(
    @Query('platform') platform?: string,
    @Query('sentiment') sentiment?: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    let mentions = await this.service.getAllSocialMentions();

    if (platform) {
      mentions = mentions.filter((m) => m.platform === platform);
    }

    if (sentiment) {
      mentions = mentions.filter((m) => m.sentiment?.label === sentiment);
    }

    const maxResults = Math.min(parseInt(limit || '100', 10) || 100, 1000);
    return mentions.slice(0, maxResults);
  }

  @Get('social-mentions/:id')
  @ApiOperation({ summary: 'Get social mention by ID' })
  @ApiParam({ name: 'id', description: 'Social mention ID' })
  @ApiResponse({ status: 200, description: 'Social mention details' })
  @ApiResponse({ status: 404, description: 'Social mention not found' })
  async getSocialMention(@Param('id') id: string): Promise<any | undefined> {
    return this.service.getSocialMention(id);
  }

  // ===========================================================================
  // Seed Endpoint (Phase 6)
  // ===========================================================================

  @Post('seed')
  @ApiOperation({
    summary: 'Seed database with demo data for PoC',
    description:
      'Generates and persists synthetic retail banking customers and communications. Use this to quickly populate the system for demos.',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    enum: ['small', 'medium', 'large'],
    description: 'Dataset size: small (10), medium (50), large (100) customers',
  })
  @ApiResponse({ status: 200, description: 'Seeding completed' })
  async seed(
    @Query('size') size: 'small' | 'medium' | 'large' = 'medium',
  ): Promise<{
    success: boolean;
    result: GenerationResult;
    message: string;
  }> {
    const customerCounts: Record<string, number> = {
      small: 10,
      medium: 50,
      large: 100,
    };

    const customerCount = customerCounts[size] || 50;

    const result = await this.service.generateAll({
      customerCount,
      communicationsPerCustomer: {
        min: size === 'small' ? 3 : 10,
        max: size === 'small' ? 10 : 40,
      },
      casesPercentage: 30,
      casesPerCustomer: { min: 1, max: 3 },
      socialMentionsCount: customerCount * 6,
      eventsCount: size === 'small' ? 20 : size === 'medium' ? 50 : 100,
    });

    return {
      success: true,
      result,
      message: `Successfully seeded ${result.customers} customers, ${result.communications} communications, ${result.cases} cases, ${result.surveys} surveys, ${result.events} events, ${result.socialMentions} social mentions, and ${result.chunks} chunks`,
    };
  }
}

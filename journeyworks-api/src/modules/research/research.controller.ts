/**
 * Research Controller
 *
 * REST API endpoints for research operations.
 */

import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResearchService } from './research.service';
import {
  ResearchRequest,
  ResearchResponse,
  ConversationTurn,
  AnalysisContext,
  InsightRequest,
  ResearchInsight,
} from './research.types';

// DTOs
class ResearchRequestDto implements ResearchRequest {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsNumber()
  maxIterations?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];

  @IsOptional()
  @IsArray()
  conversationHistory?: ConversationTurn[];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsObject()
  timeRange?: {
    from?: string;
    to?: string;
  };
}

class ConversationQueryDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  maxIterations?: number;
}

class QuickQuestionDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

class CustomerResearchDto {
  @IsArray()
  @IsString({ each: true })
  questions: string[];
}

class InsightRequestDto implements InsightRequest {
  @IsObject()
  context: AnalysisContext;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsBoolean()
  useCache?: boolean;
}

@ApiTags('research')
@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  @ApiOperation({ summary: 'Perform research using the AI agent' })
  @ApiResponse({ status: 200, description: 'Research response' })
  async research(@Body() dto: ResearchRequestDto): Promise<ResearchResponse> {
    return this.researchService.research(dto);
  }

  @Post('quick')
  @ApiOperation({ summary: 'Ask a quick question (single-turn)' })
  @ApiResponse({ status: 200, description: 'Quick answer' })
  async quickQuestion(
    @Body() dto: QuickQuestionDto,
  ): Promise<{ answer: string; confidence: number; processingTime: number }> {
    return this.researchService.quickQuestion(dto.question, dto.customerId);
  }

  @Post('conversation')
  @ApiOperation({ summary: 'Start a new research conversation' })
  @ApiResponse({ status: 201, description: 'Conversation started' })
  startConversation(): { conversationId: string } {
    const conversationId = this.researchService.startConversation();
    return { conversationId };
  }

  @Post('conversation/:conversationId')
  @ApiOperation({ summary: 'Continue a research conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Research response' })
  async continueConversation(
    @Param('conversationId') conversationId: string,
    @Body() dto: ConversationQueryDto,
  ): Promise<ResearchResponse> {
    return this.researchService.researchWithContext(conversationId, dto.query, {
      customerId: dto.customerId,
      maxIterations: dto.maxIterations,
    });
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get conversation history' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation history' })
  getConversation(@Param('conversationId') conversationId: string): {
    history: ConversationTurn[];
  } {
    return { history: this.researchService.getConversation(conversationId) };
  }

  @Delete('conversation/:conversationId')
  @ApiOperation({ summary: 'Clear conversation history' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation cleared' })
  clearConversation(@Param('conversationId') conversationId: string): {
    cleared: boolean;
  } {
    this.researchService.clearConversation(conversationId);
    return { cleared: true };
  }

  @Post('customer/:customerId')
  @ApiOperation({ summary: 'Research about a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Research results' })
  async researchCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: CustomerResearchDto,
  ): Promise<{ results: Array<{ question: string; answer: string }> }> {
    const results = await this.researchService.researchCustomer(
      customerId,
      dto.questions,
    );
    return { results };
  }

  @Get('tools')
  @ApiOperation({ summary: 'Get available research tools' })
  @ApiResponse({ status: 200, description: 'Available tools' })
  getTools(): { tools: Array<{ name: string; description: string }> } {
    return { tools: this.researchService.getAvailableTools() };
  }

  @Get('examples')
  @ApiOperation({ summary: 'Get example research questions' })
  @ApiResponse({ status: 200, description: 'Example questions' })
  getExamples(): { examples: string[] } {
    return { examples: this.researchService.getExampleQuestions() };
  }

  // ===========================================================================
  // Context-Aware Insight Endpoint (Dashboard Integration)
  // ===========================================================================

  @Post('insight')
  @ApiOperation({
    summary: 'Get context-aware insight based on dashboard selection',
  })
  @ApiResponse({ status: 200, description: 'Research insight for context' })
  async getInsight(@Body() dto: InsightRequestDto): Promise<ResearchInsight> {
    return this.researchService.getInsight(dto);
  }
}

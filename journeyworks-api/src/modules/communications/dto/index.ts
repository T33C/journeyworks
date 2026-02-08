/**
 * Communication DTOs
 *
 * Data Transfer Objects for communication endpoints.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsNumber,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum CommunicationChannel {
  EMAIL = 'email',
  PHONE = 'phone',
  CHAT = 'chat',
  LETTER = 'letter',
  SOCIAL = 'social',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum SentimentLabel {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed',
}

export enum CommunicationStatus {
  NEW = 'new',
  REVIEWED = 'reviewed',
  ACTIONED = 'actioned',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

// Nested DTOs
export class SentimentDto {
  @ApiProperty({ enum: SentimentLabel })
  @IsEnum(SentimentLabel)
  label: SentimentLabel;

  @ApiProperty({ minimum: -1, maximum: 1 })
  @IsNumber()
  @Min(-1)
  @Max(1)
  score: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emotionalTones?: string[];
}

export class IntentDto {
  @ApiProperty()
  @IsString()
  primary: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondary?: string[];

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}

export class EntityDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  confidence?: number;
}

export class AttachmentDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsNumber()
  size: number;
}

// AI Classification DTOs
export enum CategoryType {
  FRAUD = 'fraud',
  SERVICE_QUALITY = 'service-quality',
  FEES_CHARGES = 'fees-charges',
  TECHNICAL_ISSUE = 'technical-issue',
  ACCOUNT_ACCESS = 'account-access',
  PAYMENT_ISSUE = 'payment-issue',
  COMMUNICATION = 'communication',
  PRODUCT_FEATURE = 'product-feature',
}

export enum ProductType {
  CREDIT_CARD = 'credit-card',
  CURRENT_ACCOUNT = 'current-account',
  SAVINGS_ACCOUNT = 'savings-account',
  MORTGAGE = 'mortgage',
  PERSONAL_LOAN = 'personal-loan',
  MOBILE_APP = 'mobile-app',
  ONLINE_BANKING = 'online-banking',
  INSURANCE = 'insurance',
}

export enum UrgencyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class AIClassificationDto {
  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  category: CategoryType;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  product: ProductType;

  @ApiProperty()
  @IsString()
  issueType: string;

  @ApiProperty({ enum: UrgencyLevel })
  @IsEnum(UrgencyLevel)
  urgency: UrgencyLevel;

  @ApiProperty()
  @IsString()
  rootCause: string;

  @ApiProperty()
  @IsString()
  suggestedAction: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regulatoryFlags?: string[];
}

export enum MessageSender {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  SYSTEM = 'system',
}

export class CommunicationMessageDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsDateString()
  timestamp: string;

  @ApiProperty({ enum: MessageSender })
  @IsEnum(MessageSender)
  sender: MessageSender;

  @ApiProperty({ enum: CommunicationChannel })
  @IsEnum(CommunicationChannel)
  channel: CommunicationChannel;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sentiment?: number;
}

// Create DTO
export class CreateCommunicationDto {
  @ApiProperty({ enum: CommunicationChannel })
  @IsEnum(CommunicationChannel)
  channel: CommunicationChannel;

  @ApiProperty({ enum: CommunicationDirection })
  @IsEnum(CommunicationDirection)
  direction: CommunicationDirection;

  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({ type: SentimentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SentimentDto)
  sentiment?: SentimentDto;

  @ApiPropertyOptional({ type: IntentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntentDto)
  intent?: IntentDto;

  @ApiPropertyOptional({ type: [EntityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntityDto)
  entities?: EntityDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ type: AIClassificationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AIClassificationDto)
  aiClassification?: AIClassificationDto;

  @ApiPropertyOptional({ type: [CommunicationMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommunicationMessageDto)
  messages?: CommunicationMessageDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string;
}

// Update DTO
export class UpdateCommunicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ type: SentimentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SentimentDto)
  sentiment?: SentimentDto;

  @ApiPropertyOptional({ type: IntentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntentDto)
  intent?: IntentDto;

  @ApiPropertyOptional({ type: [EntityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntityDto)
  entities?: EntityDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// Search DTO
export class SearchCommunicationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: CommunicationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CommunicationChannel, { each: true })
  channels?: CommunicationChannel[];

  @ApiPropertyOptional({ enum: CommunicationDirection })
  @IsOptional()
  @IsEnum(CommunicationDirection)
  direction?: CommunicationDirection;

  @ApiPropertyOptional({ enum: SentimentLabel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SentimentLabel, { each: true })
  sentiments?: SentimentLabel[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by product slug' })
  @IsOptional()
  @IsString()
  product?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  from?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  size?: number;

  @ApiPropertyOptional({ default: 'timestamp' })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

// Semantic Search DTO
export class SemanticSearchDto {
  @ApiProperty()
  @IsString()
  query: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topK?: number;

  @ApiPropertyOptional({ enum: CommunicationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CommunicationChannel, { each: true })
  channels?: CommunicationChannel[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  useReranking?: boolean;
}

// Response DTO
export class CommunicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: CommunicationChannel })
  channel: CommunicationChannel;

  @ApiProperty({ enum: CommunicationDirection })
  direction: CommunicationDirection;

  @ApiProperty()
  customerId: string;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiPropertyOptional()
  caseId?: string;

  @ApiPropertyOptional()
  subject?: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  summary?: string;

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional({ enum: CommunicationStatus })
  status?: CommunicationStatus;

  @ApiPropertyOptional()
  sentiment?: SentimentDto;

  @ApiPropertyOptional()
  intent?: IntentDto;

  @ApiPropertyOptional({ type: [EntityDto] })
  entities?: EntityDto[];

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [AttachmentDto] })
  attachments?: AttachmentDto[];

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: Priority })
  priority?: Priority;

  @ApiPropertyOptional({ type: AIClassificationDto })
  aiClassification?: AIClassificationDto;

  @ApiPropertyOptional({ type: [CommunicationMessageDto] })
  messages?: CommunicationMessageDto[];

  @ApiPropertyOptional()
  threadId?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Search score if from search results' })
  score?: number;

  @ApiPropertyOptional({
    description: 'Highlighted matches if from search results',
  })
  highlights?: Record<string, string[]>;
}

// Paginated Response
export class PaginatedCommunicationsDto {
  @ApiProperty({ type: [CommunicationResponseDto] })
  items: CommunicationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  from: number;

  @ApiProperty()
  size: number;

  @ApiProperty()
  hasMore: boolean;
}

// Aggregation Response
export class CommunicationAggregationsDto {
  @ApiProperty()
  byChannel: Record<string, number>;

  @ApiProperty()
  bySentiment: Record<string, number>;

  @ApiProperty()
  byDirection: Record<string, number>;

  @ApiProperty()
  overTime: Array<{
    date: string;
    count: number;
  }>;
}

// Update Status DTO
export class UpdateStatusDto {
  @ApiProperty({ enum: CommunicationStatus })
  @IsEnum(CommunicationStatus)
  status: CommunicationStatus;

  @ApiPropertyOptional({ description: 'Optional note about the status change' })
  @IsOptional()
  @IsString()
  note?: string;
}

// Communication Stats Response
export class CommunicationStatsDto {
  @ApiProperty({ description: 'Total number of communications' })
  total: number;

  @ApiProperty({ description: 'Communications in the last 24 hours' })
  last24Hours: number;

  @ApiProperty({ description: 'Communications in the last 7 days' })
  last7Days: number;

  @ApiProperty({ description: 'Breakdown by channel' })
  byChannel: Record<string, number>;

  @ApiProperty({ description: 'Breakdown by sentiment' })
  bySentiment: Record<string, number>;

  @ApiProperty({ description: 'Breakdown by status' })
  byStatus: Record<string, number>;

  @ApiProperty({ description: 'Average sentiment score' })
  avgSentimentScore: number;

  @ApiProperty({
    description: 'Percentage requiring attention (negative + escalated)',
  })
  requiresAttentionPct: number;

  @ApiProperty({ description: 'Top 5 customers by volume' })
  topCustomers: Array<{
    customerId: string;
    customerName?: string;
    count: number;
  }>;

  @ApiProperty({ description: 'Trend compared to previous period' })
  trend: {
    volumeChange: number;
    sentimentChange: number;
  };
}

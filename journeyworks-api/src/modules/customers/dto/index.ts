/**
 * Customer DTOs
 *
 * Data Transfer Objects for customer endpoints.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum CustomerTier {
  PREMIUM = 'premium',
  STANDARD = 'standard',
  BASIC = 'basic',
  STUDENT = 'student',
}

export enum RiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

export enum CommunicationPreference {
  EMAIL = 'email',
  PHONE = 'phone',
  BOTH = 'both',
}

// Create DTO
export class CreateCustomerDto {
  @ApiPropertyOptional({ description: 'Optional ID for data seeding' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ enum: CustomerTier })
  @IsOptional()
  @IsEnum(CustomerTier)
  tier?: CustomerTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationshipManager?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  portfolioValue?: number;

  @ApiPropertyOptional({ enum: RiskProfile })
  @IsOptional()
  @IsEnum(RiskProfile)
  riskProfile?: RiskProfile;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  joinedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastContactDate?: string;

  @ApiPropertyOptional({ enum: CommunicationPreference })
  @IsOptional()
  @IsEnum(CommunicationPreference)
  communicationPreference?: CommunicationPreference;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// Update DTO
export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ enum: CustomerTier })
  @IsOptional()
  @IsEnum(CustomerTier)
  tier?: CustomerTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationshipManager?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  portfolioValue?: number;

  @ApiPropertyOptional({ enum: RiskProfile })
  @IsOptional()
  @IsEnum(RiskProfile)
  riskProfile?: RiskProfile;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ enum: CommunicationPreference })
  @IsOptional()
  @IsEnum(CommunicationPreference)
  communicationPreference?: CommunicationPreference;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// Search DTO
export class SearchCustomersDto {
  @ApiPropertyOptional({ description: 'Search query for name/email' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: CustomerTier, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CustomerTier, { each: true })
  tiers?: CustomerTier[];

  @ApiPropertyOptional({ enum: RiskProfile })
  @IsOptional()
  @IsEnum(RiskProfile)
  riskProfile?: RiskProfile;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationshipManager?: string;

  @ApiPropertyOptional({ description: 'Minimum portfolio value' })
  @IsOptional()
  @IsNumber()
  minPortfolioValue?: number;

  @ApiPropertyOptional({ description: 'Maximum portfolio value' })
  @IsOptional()
  @IsNumber()
  maxPortfolioValue?: number;

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

  @ApiPropertyOptional({ default: 'name' })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

// Response DTO
export class CustomerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  company?: string;

  @ApiPropertyOptional({ enum: CustomerTier })
  tier?: CustomerTier;

  @ApiPropertyOptional()
  relationshipManager?: string;

  @ApiPropertyOptional()
  accountType?: string;

  @ApiPropertyOptional()
  portfolioValue?: number;

  @ApiPropertyOptional({ enum: RiskProfile })
  riskProfile?: RiskProfile;

  @ApiPropertyOptional()
  region?: string;

  @ApiPropertyOptional()
  joinedDate?: string;

  @ApiPropertyOptional()
  lastContactDate?: string;

  @ApiPropertyOptional({ enum: CommunicationPreference })
  communicationPreference?: CommunicationPreference;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Search score if from search results' })
  score?: number;
}

// Paginated Response
export class PaginatedCustomersDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items: CustomerResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  from: number;

  @ApiProperty()
  size: number;

  @ApiProperty()
  hasMore: boolean;
}

// Customer Stats Response
export class CustomerStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  byTier: Record<string, number>;

  @ApiProperty()
  byRiskProfile: Record<string, number>;

  @ApiProperty()
  byRegion: Record<string, number>;

  @ApiProperty()
  avgPortfolioValue: number;

  @ApiProperty()
  totalPortfolioValue: number;
}

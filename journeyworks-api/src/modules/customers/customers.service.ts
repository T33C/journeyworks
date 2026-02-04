/**
 * Customers Service
 *
 * Business logic for customer operations backed by Elasticsearch.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisCacheService } from '../../infrastructure/redis';
import { CustomerDocument, CustomersRepository } from './customers.repository';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SearchCustomersDto,
  CustomerResponseDto,
  PaginatedCustomersDto,
  CustomerStatsDto,
  CustomerTier,
} from './dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly CACHE_PREFIX = 'customer:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly repository: CustomersRepository,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Create a new customer
   */
  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const now = new Date().toISOString();

    const customer: CustomerDocument = {
      id: dto.id || `CUST-${uuidv4().substring(0, 8).toUpperCase()}`,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      tier: dto.tier || 'basic',
      relationshipManager: dto.relationshipManager,
      accountType: dto.accountType || 'Current Account',
      portfolioValue: dto.portfolioValue || 0,
      riskProfile: dto.riskProfile || 'conservative',
      region: dto.region,
      joinedDate: dto.joinedDate || now,
      lastContactDate: dto.lastContactDate || now,
      communicationPreference: dto.communicationPreference || 'email',
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(customer.id, customer);
    this.logger.log(`Created customer: ${customer.id}`);

    return this.toResponseDto(customer);
  }

  /**
   * Find customer by ID
   */
  async findById(id: string): Promise<CustomerResponseDto> {
    // Check cache first
    const cached = await this.cache.get<CustomerResponseDto>(
      `${this.CACHE_PREFIX}${id}`,
    );
    if (cached) {
      return cached;
    }

    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    const response = this.toResponseDto(customer);

    // Cache the result
    await this.cache.set(`${this.CACHE_PREFIX}${id}`, response, this.CACHE_TTL);

    return response;
  }

  /**
   * Update a customer
   */
  async update(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    const updated: CustomerDocument = {
      ...customer,
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.updateCustomer(id, updated);

    // Invalidate cache
    await this.cache.delete(`${this.CACHE_PREFIX}${id}`);

    this.logger.log(`Updated customer: ${id}`);
    return this.toResponseDto(updated);
  }

  /**
   * Delete a customer
   */
  async delete(id: string): Promise<void> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    await this.repository.deleteCustomer(id);
    await this.cache.delete(`${this.CACHE_PREFIX}${id}`);

    this.logger.log(`Deleted customer: ${id}`);
  }

  /**
   * Search customers
   */
  async search(dto: SearchCustomersDto): Promise<PaginatedCustomersDto> {
    const filters: any = {};
    if (dto.tiers?.length) {
      filters.tier = dto.tiers[0]; // Repository handles single tier filter
    }
    if (dto.riskProfile) {
      filters.riskProfile = dto.riskProfile;
    }
    if (dto.region) {
      filters.region = dto.region;
    }
    if (dto.relationshipManager) {
      filters.relationshipManager = dto.relationshipManager;
    }

    const result = await this.repository.searchCustomers(dto.query, filters, {
      from: dto.from || 0,
      size: dto.size || 20,
    });

    let items = result.hits.map((h) => this.toResponseDto(h.source));

    // Apply additional filters not supported by ES query
    if (dto.minPortfolioValue !== undefined) {
      items = items.filter(
        (c) => (c.portfolioValue || 0) >= dto.minPortfolioValue!,
      );
    }

    if (dto.maxPortfolioValue !== undefined) {
      items = items.filter(
        (c) => (c.portfolioValue || 0) <= dto.maxPortfolioValue!,
      );
    }

    return {
      items,
      total: result.total,
      from: dto.from || 0,
      size: dto.size || 20,
      hasMore: (dto.from || 0) + (dto.size || 20) < result.total,
    };
  }

  /**
   * Get customer statistics
   */
  async getStats(): Promise<CustomerStatsDto> {
    // Get all customers for aggregation
    const result = await this.repository.searchCustomers(undefined, undefined, {
      size: 10000, // Get all for stats
    });
    const customers = result.hits.map((h) => h.source);

    const byTier: Record<string, number> = {};
    const byRiskProfile: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    let totalPortfolioValue = 0;

    for (const customer of customers) {
      // Count by tier
      const tier = customer.tier || 'basic';
      byTier[tier] = (byTier[tier] || 0) + 1;

      // Count by risk profile
      const risk = customer.riskProfile || 'conservative';
      byRiskProfile[risk] = (byRiskProfile[risk] || 0) + 1;

      // Count by region
      const region = customer.region || 'Unknown';
      byRegion[region] = (byRegion[region] || 0) + 1;

      // Sum portfolio value
      totalPortfolioValue += customer.portfolioValue || 0;
    }

    return {
      total: customers.length,
      byTier,
      byRiskProfile,
      byRegion,
      avgPortfolioValue:
        customers.length > 0 ? totalPortfolioValue / customers.length : 0,
      totalPortfolioValue,
    };
  }

  /**
   * Get all customers (for data seeding)
   */
  async getAll(): Promise<CustomerResponseDto[]> {
    const result = await this.repository.searchCustomers(undefined, undefined, {
      size: 10000,
    });
    return result.hits.map((h) => this.toResponseDto(h.source));
  }

  /**
   * Get customer health analysis
   */
  async getHealth(id: string): Promise<{
    customerId: string;
    healthScore: number;
    trend: 'improving' | 'stable' | 'declining';
    riskFactors: string[];
    recommendations: string[];
  }> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer not found: ${id}`);
    }

    // Generate health analysis based on customer data
    // In production, this would integrate with the analysis service
    const tierScores: Record<string, number> = {
      premium: 85,
      standard: 70,
      basic: 55,
      student: 60,
    };

    const baseScore = tierScores[customer.tier] || 65;
    const randomVariation = Math.floor(Math.random() * 20) - 10;
    const healthScore = Math.max(0, Math.min(100, baseScore + randomVariation));

    // Determine trend based on recent activity
    const lastContact = new Date(customer.lastContactDate);
    const daysSinceContact = Math.floor(
      (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24),
    );

    let trend: 'improving' | 'stable' | 'declining';
    if (daysSinceContact < 14 && healthScore > 70) {
      trend = 'improving';
    } else if (daysSinceContact > 30 || healthScore < 50) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Generate risk factors and recommendations based on customer profile
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (daysSinceContact > 30) {
      riskFactors.push('No recent contact in over 30 days');
      recommendations.push('Schedule a check-in call to maintain engagement');
    }

    if (customer.tier === 'basic') {
      riskFactors.push('Limited product engagement');
      recommendations.push('Consider offering a product upgrade discussion');
    }

    if (customer.riskProfile === 'aggressive' && healthScore < 60) {
      riskFactors.push('Aggressive risk profile with declining satisfaction');
      recommendations.push(
        'Review portfolio performance and address any concerns',
      );
    }

    if (healthScore > 75 && customer.tier !== 'premium') {
      recommendations.push(
        'High engagement customer - consider premium tier offer',
      );
    }

    if (riskFactors.length === 0) {
      riskFactors.push('No significant risk factors identified');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue regular engagement and monitoring');
    }

    return {
      customerId: id,
      healthScore,
      trend,
      riskFactors,
      recommendations,
    };
  }

  /**
   * Bulk create customers (for data seeding)
   */
  async bulkCreate(
    customers: CreateCustomerDto[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();
    const documents: CustomerDocument[] = customers.map((dto) => ({
      id: dto.id || `CUST-${uuidv4().substring(0, 8).toUpperCase()}`,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      tier: dto.tier || 'basic',
      relationshipManager: dto.relationshipManager,
      accountType: dto.accountType || 'Current Account',
      portfolioValue: dto.portfolioValue || 0,
      riskProfile: dto.riskProfile || 'conservative',
      region: dto.region,
      joinedDate: dto.joinedDate || now,
      lastContactDate: dto.lastContactDate || now,
      communicationPreference: dto.communicationPreference || 'email',
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.repository.bulkCreate(documents);
    this.logger.log(`Bulk created ${result.created} customers`);
    return result;
  }

  /**
   * Delete all customers
   */
  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    this.logger.log(`Deleted ${deleted} customers`);
    return { deleted };
  }

  /**
   * Convert document to response DTO
   */
  private toResponseDto(doc: CustomerDocument): CustomerResponseDto {
    return {
      id: doc.id,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      company: doc.company,
      tier: doc.tier as CustomerTier,
      relationshipManager: doc.relationshipManager,
      accountType: doc.accountType,
      portfolioValue: doc.portfolioValue,
      riskProfile: doc.riskProfile as any,
      region: doc.region,
      joinedDate: doc.joinedDate,
      lastContactDate: doc.lastContactDate,
      communicationPreference: doc.communicationPreference as any,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

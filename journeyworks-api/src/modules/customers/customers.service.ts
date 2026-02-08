/**
 * Customers Service
 *
 * Business logic for customer operations backed by Elasticsearch.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisCacheService } from '../../infrastructure/redis';
import { CustomerDocument, CustomersRepository } from './customers.repository';
import { CommunicationsRepository } from '../communications/communications.repository';
import { CasesRepository } from '../cases/cases.repository';
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
    private readonly communicationsRepository: CommunicationsRepository,
    private readonly casesRepository: CasesRepository,
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

    // Enrich with computed counts
    try {
      const [commsResult, cases] = await Promise.all([
        this.communicationsRepository.getByCustomerId(id, { size: 0 }),
        this.casesRepository.findByCustomerId(id),
      ]);
      response.totalCommunications = commsResult.total;
      response.openCases = cases.filter(
        (c) => c.status !== 'resolved' && c.status !== 'closed',
      ).length;
    } catch (err) {
      this.logger.warn(
        `Failed to enrich customer ${id} with counts: ${err.message}`,
      );
    }

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
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    riskFactors: string[];
    recommendations: string[];
  }> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer not found: ${id}`);
    }

    // Fetch all communications for this customer (up to 500)
    const commsResult = await this.communicationsRepository.getByCustomerId(
      id,
      { size: 500 },
    );
    const comms = commsResult.hits.map((h) => h.source);
    const totalComms = commsResult.total;

    // --- Sentiment analysis from real data ---
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let sentimentSum = 0;
    let sentimentCount = 0;

    for (const comm of comms) {
      if (comm.sentiment) {
        sentimentCount++;
        sentimentSum += comm.sentiment.score;
        if (comm.sentiment.label === 'positive') positiveCount++;
        else if (comm.sentiment.label === 'negative') negativeCount++;
        else neutralCount++;
      }
    }

    // --- Calculate health score (0-100) from multiple weighted factors ---

    // Factor 1: Sentiment score (40% weight)
    // sentiment.score ranges from -1 to +1, normalise to 0-100
    const avgSentiment = sentimentCount > 0 ? sentimentSum / sentimentCount : 0;
    const sentimentScore = Math.round(((avgSentiment + 1) / 2) * 100);

    // Factor 2: Negative ratio (25% weight)
    // Fewer negatives = higher score
    const negativeRatio =
      sentimentCount > 0 ? negativeCount / sentimentCount : 0;
    const negativeScore = Math.round((1 - negativeRatio) * 100);

    // Factor 3: Recency of contact (20% weight)
    const lastContact = new Date(customer.lastContactDate);
    const daysSinceContact = Math.floor(
      (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24),
    );
    // 0 days = 100, 90+ days = 0
    const recencyScore = Math.max(
      0,
      Math.round(100 - (daysSinceContact / 90) * 100),
    );

    // Factor 4: Engagement volume (15% weight)
    // 20+ comms = 100, 0 comms = 20
    const engagementScore = Math.min(
      100,
      Math.round(20 + (totalComms / 20) * 80),
    );

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          sentimentScore * 0.4 +
            negativeScore * 0.25 +
            recencyScore * 0.2 +
            engagementScore * 0.15,
        ),
      ),
    );

    // --- Trend: compare recent 30 days vs previous 30 days ---
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    let recentSentimentSum = 0;
    let recentSentimentCount = 0;
    let olderSentimentSum = 0;
    let olderSentimentCount = 0;

    for (const comm of comms) {
      if (!comm.sentiment) continue;
      const ts = new Date(comm.timestamp).getTime();
      if (ts >= thirtyDaysAgo) {
        recentSentimentSum += comm.sentiment.score;
        recentSentimentCount++;
      } else if (ts >= sixtyDaysAgo) {
        olderSentimentSum += comm.sentiment.score;
        olderSentimentCount++;
      }
    }

    let trend: 'improving' | 'stable' | 'declining';
    if (recentSentimentCount >= 2 && olderSentimentCount >= 2) {
      const recentAvg = recentSentimentSum / recentSentimentCount;
      const olderAvg = olderSentimentSum / olderSentimentCount;
      const delta = recentAvg - olderAvg;
      if (delta > 0.15) {
        trend = 'improving';
      } else if (delta < -0.15) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }
    } else if (recentSentimentCount === 0 && daysSinceContact > 30) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // --- Risk factors and recommendations based on real data ---
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // High negative sentiment ratio
    if (negativeRatio > 0.5) {
      riskFactors.push(
        `High negative sentiment: ${Math.round(negativeRatio * 100)}% of communications are negative`,
      );
      recommendations.push(
        'Urgent review of recent interactions needed — consider proactive outreach',
      );
    } else if (negativeRatio > 0.3) {
      riskFactors.push(
        `Elevated negative sentiment: ${Math.round(negativeRatio * 100)}% of communications are negative`,
      );
      recommendations.push(
        'Monitor sentiment trend closely and address recurring issues',
      );
    }

    // No recent contact
    if (daysSinceContact > 60) {
      riskFactors.push(
        `No contact in ${daysSinceContact} days — customer may be disengaging`,
      );
      recommendations.push('Schedule an immediate check-in call to re-engage');
    } else if (daysSinceContact > 30) {
      riskFactors.push(`No recent contact in ${daysSinceContact} days`);
      recommendations.push('Schedule a check-in call to maintain engagement');
    }

    // Open/unresolved cases
    const openComms = comms.filter(
      (c) => c.status === 'open' || c.status === 'in_progress',
    );
    if (openComms.length > 5) {
      riskFactors.push(
        `${openComms.length} open/in-progress communications — possible service backlog`,
      );
      recommendations.push(
        'Prioritise resolution of outstanding items to improve satisfaction',
      );
    } else if (openComms.length > 0) {
      recommendations.push(
        `${openComms.length} open item(s) — ensure timely follow-up`,
      );
    }

    // Urgent items
    const urgentComms = comms.filter((c) => c.priority === 'urgent');
    if (urgentComms.length > 0) {
      riskFactors.push(`${urgentComms.length} urgent communication(s) flagged`);
      recommendations.push(
        'Ensure all urgent items have been acknowledged and are being actioned',
      );
    }

    // Declining trend
    if (trend === 'declining') {
      riskFactors.push(
        'Sentiment trend is declining compared to previous period',
      );
      recommendations.push(
        'Investigate recent interactions for recurring complaints or unresolved issues',
      );
    }

    // Low engagement
    if (totalComms < 3) {
      riskFactors.push(
        'Very low communication volume — limited visibility into customer health',
      );
      recommendations.push(
        'Proactively reach out to build the relationship and gather feedback',
      );
    }

    // Positive signals
    if (healthScore > 75 && customer.tier !== 'premium') {
      recommendations.push(
        'High engagement customer — consider premium tier offer',
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
      sentimentBreakdown: {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
      },
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

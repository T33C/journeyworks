/**
 * Case Generator
 *
 * Generates synthetic case/complaint data for investment banking.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticCase,
  SyntheticCustomer,
  SyntheticCommunication,
} from '../synthetic-data.types';

const CASE_CATEGORIES = {
  'Service Issue': [
    'Response Time',
    'Staff Behavior',
    'Communication Quality',
    'Appointment Scheduling',
    'Follow-up Failure',
  ],
  'Transaction Problem': [
    'Failed Transaction',
    'Delayed Processing',
    'Incorrect Amount',
    'Missing Funds',
    'Duplicate Transaction',
  ],
  'Fee Dispute': [
    'Unauthorized Charges',
    'Rate Discrepancy',
    'Hidden Fees',
    'Billing Error',
    'Refund Request',
  ],
  'Account Issue': [
    'Access Problem',
    'Statement Error',
    'Account Update',
    'Documentation Request',
    'KYC/AML Query',
  ],
  'Investment Concern': [
    'Performance Query',
    'Risk Disclosure',
    'Suitability',
    'Portfolio Rebalancing',
    'Dividend Issue',
  ],
  'Technical Problem': [
    'Platform Outage',
    'Mobile App Issue',
    'Login Problem',
    'Security Concern',
    'Data Discrepancy',
  ],
  'Regulatory Inquiry': [
    'Tax Documentation',
    'Compliance Query',
    'Audit Request',
    'Legal Hold',
    'Data Request',
  ],
};

const CASE_TITLES = {
  'Service Issue': [
    'Poor response time on portfolio queries',
    'Unsatisfactory service during branch visit',
    'Repeated communication failures',
    'No follow-up on promised callback',
    'Rude interaction with support staff',
  ],
  'Transaction Problem': [
    'Wire transfer pending for {days} days',
    'Incorrect transaction amount posted',
    'Funds missing from account',
    'Duplicate charge on {product}',
    'FX conversion error on international transfer',
  ],
  'Fee Dispute': [
    'Unexpected management fee of ${amount}',
    'Discrepancy in quoted vs. charged rate',
    'Hidden custody fees discovered',
    'Advisory fee billing error',
    'Incorrect penalty charge applied',
  ],
  'Account Issue': [
    'Cannot access online banking platform',
    'Incorrect beneficiary information on record',
    'Missing quarterly statement',
    'Outdated contact information',
    'Address verification required',
  ],
  'Investment Concern': [
    'Concerned about {product} performance',
    'Risk level not matching profile',
    'Missed dividend payment',
    'Unauthorized trade executed',
    'Portfolio allocation questions',
  ],
  'Technical Problem': [
    'App crashes during trading hours',
    'Cannot complete transactions on mobile',
    'Two-factor authentication not working',
    'Portfolio values not updating',
    'Security alert for unknown login',
  ],
  'Regulatory Inquiry': [
    'Tax documentation request for {year}',
    'Compliance audit documentation',
    'FATCA reporting query',
    'Legal hold notification',
    'GDPR data access request',
  ],
};

const CASE_DESCRIPTIONS = {
  'Service Issue': [
    'Customer has experienced repeated delays in receiving responses to their inquiries. Despite multiple follow-ups, the issue remains unaddressed.',
    'Client visited the {region} branch and reported unsatisfactory interaction with staff. Request for formal review.',
    'Communication promises made by the team have not been kept. Customer has not received the promised callback within SLA.',
  ],
  'Transaction Problem': [
    'Wire transfer initiated on {date} is still pending. Customer requires urgent resolution as funds are needed for time-sensitive investment.',
    'Customer noticed an incorrect amount of ${amount} posted instead of the expected ${expected}. Discrepancy requires investigation.',
    'After recent {action}, funds totaling ${amount} appear to be missing from the account. Urgent investigation required.',
  ],
  'Fee Dispute': [
    'Customer disputes management fee of ${amount} which was not previously disclosed. Requesting full breakdown and potential waiver.',
    'Rate charged differs from originally quoted rate. Customer was quoted {quoted}% but charged {charged}%. Requesting adjustment.',
    'Customer discovered custody fees that were not communicated at account opening. Requesting fee review and potential refund.',
  ],
  'Account Issue': [
    'Customer has been locked out of online banking for {days} days. Multiple reset attempts have failed. Impacting ability to manage portfolio.',
    'Beneficiary information on record is incorrect. Customer needs immediate update before upcoming transaction.',
    'Quarterly statements for Q{quarter} have not been received despite registered mail preference.',
  ],
  'Investment Concern': [
    'Customer is concerned about underperformance of {product} relative to benchmark. Requesting detailed attribution analysis.',
    'Client believes current portfolio risk level exceeds their stated preference. Requesting suitability review.',
    'Expected dividend payment of ${amount} not received. Customer requesting investigation and confirmation of payment date.',
  ],
  'Technical Problem': [
    'Mobile application has been crashing consistently for the past {days} days. Customer unable to monitor portfolio or execute trades.',
    'Customer reports inability to complete any transactions through the mobile app. Desktop works fine but mobile is critical for their needs.',
    'Two-factor authentication system is not sending codes. Customer cannot access account for time-sensitive trades.',
  ],
  'Regulatory Inquiry': [
    'Customer requires complete tax documentation package for {year} tax filing. Deadline approaching in {days} days.',
    'External audit requires comprehensive transaction history and account documentation. Time-sensitive compliance request.',
    'Customer exercising right to access their personal data under data protection regulations. 30-day response required.',
  ],
};

const RESOLUTIONS = [
  'Issue resolved to customer satisfaction. Service credit applied.',
  'Full refund processed. Apology letter sent.',
  'Technical fix implemented. Customer verified resolution.',
  'Documentation provided. Customer confirmed receipt.',
  'Process improvement initiated. Customer notified of changes.',
  'Escalated to management. Special handling arranged.',
  'Fee waived as goodwill gesture. Customer retained.',
  'Training provided to staff. Follow-up confirmed.',
];

const ASSIGNEES = [
  'John Smith',
  'Emily Johnson',
  'Michael Chen',
  'Sarah Williams',
  'David Brown',
  'Lisa Davis',
  'Robert Wilson',
  'Jennifer Taylor',
  'William Anderson',
  'Elizabeth Thomas',
  'James Martinez',
  'Mary Garcia',
];

@Injectable()
export class CaseGenerator {
  /**
   * Generate a single case
   */
  generate(
    customer: SyntheticCustomer,
    communications: SyntheticCommunication[],
    dateRange: { start: Date; end: Date },
  ): SyntheticCase {
    // Determine category and subcategory
    const categories = Object.keys(CASE_CATEGORIES);
    const category = this.randomChoice(categories);
    const subcategories =
      CASE_CATEGORIES[category as keyof typeof CASE_CATEGORIES];
    const subcategory = this.randomChoice(subcategories);

    // Generate timestamps based on communications for data consistency
    // Use earliest communication as case creation time
    const commTimestamps = communications
      .map((c) => new Date(c.timestamp).getTime())
      .sort((a, b) => a - b);
    const createdAt =
      commTimestamps.length > 0
        ? new Date(commTimestamps[0])
        : this.randomDate(dateRange.start, dateRange.end);

    const slaHours = this.getSlaHours(customer.tier);
    const slaDeadline = new Date(
      createdAt.getTime() + slaHours * 60 * 60 * 1000,
    );

    // Determine status
    const status = this.weightedChoice([
      ['open', 0.15],
      ['in_progress', 0.25],
      ['pending', 0.15],
      ['resolved', 0.3],
      ['closed', 0.15],
    ]) as SyntheticCase['status'];

    const isResolved = status === 'resolved' || status === 'closed';
    // Use latest communication + some days as resolution time
    const latestCommTime =
      commTimestamps.length > 0
        ? commTimestamps[commTimestamps.length - 1]
        : createdAt.getTime();
    const resolvedAt = isResolved
      ? new Date(
          latestCommTime + Math.random() * 5 * 24 * 60 * 60 * 1000, // 0-5 days after last communication
        )
      : undefined;

    const slaBreached = resolvedAt
      ? resolvedAt > slaDeadline
      : new Date() > slaDeadline && !isResolved;

    // Determine priority based on customer tier and sentiment
    const negativeSentiment = communications.some(
      (c) => c.sentiment.label === 'negative' && c.sentiment.score < -0.5,
    );

    const priority = this.determinePriority(customer.tier, negativeSentiment);

    // Generate title and description
    const title = this.generateTitle(category, customer);
    const description = this.generateDescription(category, customer);

    // Extract product from communications (most common product in the case's communications)
    const product = this.extractProductFromCommunications(communications);

    return {
      id: uuidv4(),
      customerId: customer.id,
      customerName: customer.name,
      title,
      description,
      category,
      subcategory,
      product,
      status,
      priority,
      assignedTo: this.randomChoice(ASSIGNEES),
      createdAt: createdAt.toISOString(),
      updatedAt: (resolvedAt || createdAt).toISOString(),
      resolvedAt: resolvedAt?.toISOString(),
      slaDeadline: slaDeadline.toISOString(),
      slaBreached,
      communicationIds: communications.map((c) => c.id),
      tags: this.generateTags(category, priority, customer.tier),
      resolution: isResolved ? this.randomChoice(RESOLUTIONS) : undefined,
    };
  }

  /**
   * Generate multiple cases for customers
   */
  generateForCustomers(
    customersWithComms: Array<{
      customer: SyntheticCustomer;
      communications: SyntheticCommunication[];
    }>,
    casesPercentage: number,
    casesPerCustomerRange: { min: number; max: number },
    dateRange: { start: Date; end: Date },
  ): SyntheticCase[] {
    const cases: SyntheticCase[] = [];

    for (const { customer, communications } of customersWithComms) {
      // Determine if this customer has cases
      if (Math.random() > casesPercentage / 100) {
        continue;
      }

      // Determine number of cases
      const caseCount = Math.floor(
        casesPerCustomerRange.min +
          Math.random() *
            (casesPerCustomerRange.max - casesPerCustomerRange.min + 1),
      );

      // Split communications for different cases
      const commsPerCase = Math.ceil(communications.length / caseCount);

      for (let i = 0; i < caseCount; i++) {
        const caseComms = communications.slice(
          i * commsPerCase,
          (i + 1) * commsPerCase,
        );

        if (caseComms.length > 0) {
          cases.push(this.generate(customer, caseComms, dateRange));
        }
      }
    }

    return cases;
  }

  /**
   * Extract the most common product from communications
   * Falls back to a random product if no product info found
   */
  private extractProductFromCommunications(
    communications: SyntheticCommunication[],
  ): string {
    const productCounts: Record<string, number> = {};

    for (const comm of communications) {
      const product = comm.aiClassification?.product;
      if (product) {
        productCounts[product] = (productCounts[product] || 0) + 1;
      }
    }

    // Find the most common product
    let maxCount = 0;
    let mostCommonProduct = '';
    for (const [product, count] of Object.entries(productCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonProduct = product;
      }
    }

    // Fallback to a random product if none found in communications
    if (!mostCommonProduct) {
      const defaultProducts = [
        'mortgage',
        'personal-loan',
        'insurance',
        'current-account',
        'savings-account',
        'credit-card',
      ];
      mostCommonProduct = this.randomChoice(defaultProducts);
    }

    return mostCommonProduct;
  }

  /**
   * Get SLA hours based on customer tier
   */
  private getSlaHours(tier: string): number {
    switch (tier) {
      case 'platinum':
        return 4;
      case 'gold':
        return 8;
      case 'silver':
        return 24;
      default:
        return 48;
    }
  }

  /**
   * Determine priority
   */
  private determinePriority(
    tier: string,
    negativeSentiment: boolean,
  ): SyntheticCase['priority'] {
    if (tier === 'platinum' && negativeSentiment) {
      return 'critical';
    }
    if (tier === 'platinum' || (tier === 'gold' && negativeSentiment)) {
      return 'high';
    }
    if (tier === 'gold' || negativeSentiment) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate case title
   */
  private generateTitle(category: string, customer: SyntheticCustomer): string {
    const titles =
      CASE_TITLES[category as keyof typeof CASE_TITLES] ||
      CASE_TITLES['Service Issue'];
    let title = this.randomChoice(titles);

    // Fill placeholders
    title = title
      .replace('{days}', String(Math.floor(2 + Math.random() * 10)))
      .replace(
        '{product}',
        this.randomChoice([
          'wealth management',
          'trading',
          'custody',
          'advisory',
        ]),
      )
      .replace('{amount}', String(Math.floor(100 + Math.random() * 5000)))
      .replace('{year}', String(new Date().getFullYear() - 1));

    return title;
  }

  /**
   * Generate case description
   */
  private generateDescription(
    category: string,
    customer: SyntheticCustomer,
  ): string {
    const descriptions =
      CASE_DESCRIPTIONS[category as keyof typeof CASE_DESCRIPTIONS] ||
      CASE_DESCRIPTIONS['Service Issue'];
    let description = this.randomChoice(descriptions);

    // Fill placeholders
    description = description
      .replace('{region}', customer.region)
      .replace(
        '{date}',
        this.formatDate(
          new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      )
      .replace('{days}', String(Math.floor(2 + Math.random() * 10)))
      .replace('{amount}', String(Math.floor(1000 + Math.random() * 50000)))
      .replace('{expected}', String(Math.floor(1000 + Math.random() * 50000)))
      .replace('{quoted}', String((0.5 + Math.random() * 1).toFixed(2)))
      .replace('{charged}', String((0.8 + Math.random() * 1.2).toFixed(2)))
      .replace('{quarter}', String(Math.floor(1 + Math.random() * 4)))
      .replace(
        '{product}',
        this.randomChoice([
          'equity fund',
          'bond portfolio',
          'structured product',
        ]),
      )
      .replace('{year}', String(new Date().getFullYear() - 1))
      .replace(
        '{action}',
        this.randomChoice([
          'wire transfer',
          'portfolio rebalancing',
          'fund redemption',
        ]),
      );

    return description;
  }

  /**
   * Generate tags
   */
  private generateTags(
    category: string,
    priority: string,
    tier: string,
  ): string[] {
    const tags: string[] = [category.toLowerCase().replace(/\s+/g, '-')];

    if (priority === 'critical' || priority === 'high') {
      tags.push('urgent');
    }

    if (tier === 'platinum' || tier === 'gold') {
      tags.push('vip-client');
    }

    if (category === 'Fee Dispute') {
      tags.push('fee-related');
    }

    if (category === 'Regulatory Inquiry') {
      tags.push('compliance');
    }

    return tags;
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Random choice
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Weighted choice
   */
  private weightedChoice(options: Array<[string, number]>): string {
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    const random = Math.random() * total;
    let cumulative = 0;

    for (const [value, weight] of options) {
      cumulative += weight;
      if (random < cumulative) {
        return value;
      }
    }

    return options[options.length - 1][0];
  }

  /**
   * Random date - biased towards recent dates using power distribution
   * This ensures demo data has more activity in recent time periods
   */
  private randomDate(start: Date, end: Date): Date {
    const diff = end.getTime() - start.getTime();
    // Use square root to bias towards more recent dates
    // Math.random()^0.5 produces values skewed towards 1 (recent)
    const biasedRandom = Math.pow(Math.random(), 0.5);
    return new Date(start.getTime() + biasedRandom * diff);
  }
}

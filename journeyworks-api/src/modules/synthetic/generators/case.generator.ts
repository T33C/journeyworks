/**
 * Case Generator
 *
 * Generates synthetic case/complaint data for retail banking.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticCase,
  SyntheticCustomer,
  SyntheticCommunication,
} from '../synthetic-data.types';
import { randomChoice, weightedChoice, randomDate } from '../utils/random.util';
import { PRODUCT_NAMES, PRODUCT_SLUGS } from '../data/products';
import {
  CASE_CATEGORIES_FROM_CSV,
  CASE_TITLES_BY_AREA,
  CASE_DESCRIPTIONS_BY_AREA,
  TOTAL_WEIGHT,
  AreaOfIssue,
} from '../data/case-categories';

// Categories are now imported from case-categories.ts

// Titles and descriptions are now imported from case-categories.ts

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
    // Determine category and subcategory using weighted selection from CSV data
    const { category, subcategory } = this.selectCategoryWeighted();

    // Generate timestamps based on communications for data consistency
    // Use earliest communication as case creation time
    const commTimestamps = communications
      .map((c) => new Date(c.timestamp).getTime())
      .sort((a, b) => a - b);
    const createdAt =
      commTimestamps.length > 0
        ? new Date(commTimestamps[0])
        : randomDate(dateRange.start, dateRange.end);

    const slaHours = this.getSlaHours(customer.tier);
    const slaDeadline = new Date(
      createdAt.getTime() + slaHours * 60 * 60 * 1000,
    );

    // Determine status
    const status = weightedChoice([
      ['open', 0.15],
      ['in_progress', 0.25],
      ['pending', 0.15],
      ['resolved', 0.3],
      ['closed', 0.15],
    ]) as SyntheticCase['status'];

    const isResolved = status === 'resolved' || status === 'closed';
    // Resolution time: at least 1 hour after creation, up to 5 days after last communication
    const latestCommTime =
      commTimestamps.length > 0
        ? commTimestamps[commTimestamps.length - 1]
        : createdAt.getTime();
    const resolvedAt = isResolved
      ? new Date(
          Math.max(createdAt.getTime() + 60 * 60 * 1000, latestCommTime) +
            Math.random() * 5 * 24 * 60 * 60 * 1000, // 0-5 days after latest of (creation+1h, last comm)
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
      assignedTo: randomChoice(ASSIGNEES),
      createdAt: createdAt.toISOString(),
      updatedAt: (resolvedAt || createdAt).toISOString(),
      resolvedAt: resolvedAt?.toISOString(),
      slaDeadline: slaDeadline.toISOString(),
      slaBreached,
      communicationIds: communications.map((c) => c.id),
      tags: this.generateTags(category, priority, customer.tier),
      resolution: isResolved ? randomChoice(RESOLUTIONS) : undefined,
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

    // Fallback to a random product slug if none found in communications
    if (!mostCommonProduct) {
      mostCommonProduct = randomChoice(PRODUCT_SLUGS);
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
   * Select category and subcategory using weighted random selection
   * Based on 'Logged Vol' from the CSV data
   */
  private selectCategoryWeighted(): { category: string; subcategory: string } {
    const random = Math.random() * TOTAL_WEIGHT;
    let cumulative = 0;
    for (const entry of CASE_CATEGORIES_FROM_CSV) {
      cumulative += entry.weight;
      if (random < cumulative) {
        return {
          category: entry.areaOfIssue,
          subcategory: entry.reasonForComplaint,
        };
      }
    }
    // Fallback to last entry
    const last = CASE_CATEGORIES_FROM_CSV[CASE_CATEGORIES_FROM_CSV.length - 1];
    return {
      category: last.areaOfIssue,
      subcategory: last.reasonForComplaint,
    };
  }

  /**
   * Generate case title
   */
  private generateTitle(category: string, customer: SyntheticCustomer): string {
    const titles =
      CASE_TITLES_BY_AREA[category as AreaOfIssue] ||
      CASE_TITLES_BY_AREA['Account Opening Process'];
    let title = randomChoice(titles);

    // Fill placeholders
    title = title
      .replace('{days}', String(Math.floor(2 + Math.random() * 10)))
      .replace('{product}', randomChoice(PRODUCT_NAMES))
      .replace('{amount}', `£${Math.floor(50 + Math.random() * 500)}`)
      .replace(
        '{date}',
        this.formatDate(
          new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      );

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
      CASE_DESCRIPTIONS_BY_AREA[category as AreaOfIssue] ||
      CASE_DESCRIPTIONS_BY_AREA['Account Opening Process'];
    let description = randomChoice(descriptions);

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
      .replace('{amount}', `£${Math.floor(50 + Math.random() * 500)}`)
      .replace('{product}', randomChoice(PRODUCT_NAMES));

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

    if (category === 'Fees, Charges and Interest') {
      tags.push('fee-related');
    }

    if (category === 'CDD Remediation') {
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
}

/**
 * Event Generator
 *
 * Generates synthetic timeline events for retail banking.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticEvent } from '../synthetic-data.types';
import {
  randomChoice,
  weightedChoiceFromArrays,
  randomSubset,
  randomDate,
} from '../utils/random.util';
import { PRODUCT_SLUGS } from '../data/products';

const EVENT_TYPES = [
  'outage',
  'launch',
  'policy_change',
  'incident',
  'promotion',
] as const;

const EVENT_TEMPLATES = {
  outage: [
    {
      label: 'Mobile App Outage',
      description:
        'Mobile banking application experiencing intermittent connectivity issues',
    },
    {
      label: 'Online Portal Maintenance',
      description: 'Scheduled maintenance causing temporary service disruption',
    },
    {
      label: 'Payment Gateway Downtime',
      description: 'Payment processing system experiencing delays',
    },
    {
      label: 'Card Payment Processing Issue',
      description:
        'Card payment processing system experiencing delays and declined transactions',
    },
    {
      label: 'Authentication Service Disruption',
      description: 'Login services experiencing increased failure rates',
    },
  ],
  launch: [
    {
      label: 'New Mobile App Release',
      description: 'Version 5.0 of mobile banking app with enhanced features',
    },
    {
      label: 'Budgeting Tools Launch',
      description: 'New in-app budgeting and spending insights feature',
    },
    {
      label: 'Instant Transfers Feature',
      description: 'Real-time fund transfers now available to all customers',
    },
    {
      label: 'Savings Round-Up Feature',
      description: 'Automatic round-up savings on everyday purchases',
    },
    {
      label: 'Green Mortgage Product',
      description: 'New preferential rate mortgage for energy-efficient homes',
    },
  ],
  policy_change: [
    {
      label: 'Fee Structure Update',
      description:
        'Updated fee schedule for advisory services effective next quarter',
    },
    {
      label: 'KYC Requirements Change',
      description: 'Enhanced customer verification procedures now in effect',
    },
    {
      label: 'Branch Hours Extension',
      description:
        'Extended opening hours for high-street branches including Saturday afternoons',
    },
    {
      label: 'Account Minimum Adjustment',
      description:
        'Changes to minimum balance requirements for premium accounts',
    },
    {
      label: 'Privacy Policy Update',
      description: 'Updated data handling and privacy practices',
    },
  ],
  incident: [
    {
      label: 'Data Breach Notification',
      description: 'Potential unauthorized access to customer data detected',
    },
    {
      label: 'Fraudulent Activity Alert',
      description: 'Increased phishing attempts targeting customers',
    },
    {
      label: 'Interest Rate Change',
      description:
        'Bank of England base rate change affecting savings and mortgage rates',
    },
    {
      label: 'Regulatory Inquiry',
      description: 'Ongoing regulatory review of certain practices',
    },
    {
      label: 'Third-Party Service Disruption',
      description: 'External service provider experiencing issues',
    },
  ],
  promotion: [
    {
      label: 'Referral Bonus Program',
      description: 'Earn rewards for referring new customers',
    },
    {
      label: 'Fee Waiver Promotion',
      description: 'Management fees waived for new accounts',
    },
    {
      label: 'Cash Back Offer',
      description: 'Earn cash back on select transactions',
    },
    {
      label: 'Premium Upgrade Offer',
      description: 'Special pricing for tier upgrades',
    },
    {
      label: 'Anniversary Rewards',
      description: 'Special benefits for long-term customers',
    },
  ],
};

// Product slugs from shared catalogue
const PRODUCTS = PRODUCT_SLUGS;

const CHANNELS = ['email', 'phone', 'chat', 'mobile', 'web', 'branch'];

const REGIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Glasgow',
  'Liverpool',
  'Bristol',
  'Edinburgh',
  'Cardiff',
  'Newcastle',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const STATUSES = ['planned', 'active', 'resolved', 'cancelled'] as const;

@Injectable()
export class EventGenerator {
  /**
   * Generate a single event
   */
  generate(dateRange: { start: Date; end: Date }): SyntheticEvent {
    const type = randomChoice(EVENT_TYPES);
    const templates = EVENT_TEMPLATES[type];
    const template = randomChoice(templates);

    const startDate = randomDate(dateRange.start, dateRange.end);
    const duration = this.randomDuration(type);
    const endDate = new Date(startDate.getTime() + duration);

    const severity = weightedChoiceFromArrays(
      SEVERITIES,
      [0.4, 0.35, 0.2, 0.05],
    );
    const status = this.determineStatus(startDate, endDate, new Date());

    const affectsMultipleProducts = Math.random() < 0.3;
    const products = affectsMultipleProducts
      ? randomSubset(PRODUCTS, 2, 4)
      : [randomChoice(PRODUCTS)];

    const affectsMultipleChannels = Math.random() < 0.4;
    const channels = affectsMultipleChannels
      ? randomSubset(CHANNELS, 2, 4)
      : [randomChoice(CHANNELS)];

    const affectedRegions =
      Math.random() < 0.6 ? randomSubset(REGIONS, 1, 3) : REGIONS; // Affects all regions

    return {
      id: uuidv4(),
      type,
      label: template.label,
      description: template.description,
      startDate: startDate.toISOString(),
      endDate: status === 'resolved' ? endDate.toISOString() : undefined,
      product: products[0],
      channels,
      affectedRegions,
      severity,
      estimatedImpact: this.generateImpact(severity, type),
      status,
      correlatedCommunications: Math.floor(Math.random() * 500) + 10,
      sentimentDuringEvent: this.generateSentimentImpact(type, severity),
      source: randomChoice(['manual', 'automated', 'external'] as const),
      createdAt: startDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate many events
   */
  generateMany(
    count: number,
    dateRange: { start: Date; end: Date },
  ): SyntheticEvent[] {
    return Array.from({ length: count }, () => this.generate(dateRange));
  }

  private randomDuration(type: string): number {
    // Returns duration in milliseconds
    const durations: Record<string, [number, number]> = {
      outage: [30 * 60 * 1000, 8 * 60 * 60 * 1000], // 30 min to 8 hours
      launch: [0, 0], // No end date typically
      policy_change: [0, 0], // No end date typically
      incident: [60 * 60 * 1000, 48 * 60 * 60 * 1000], // 1 hour to 2 days
      promotion: [7 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000], // 1 week to 1 month
    };

    const [min, max] = durations[type] || [0, 0];
    if (max === 0) return 0;
    return Math.floor(Math.random() * (max - min)) + min;
  }

  private determineStatus(
    startDate: Date,
    endDate: Date,
    now: Date,
  ): 'planned' | 'active' | 'resolved' | 'cancelled' {
    if (startDate > now) return 'planned';
    if (endDate && endDate < now) return 'resolved';
    if (Math.random() < 0.05) return 'cancelled';
    return 'active';
  }

  private generateImpact(
    severity: 'low' | 'medium' | 'high' | 'critical',
    type: string,
  ): SyntheticEvent['estimatedImpact'] {
    const severityMultiplier: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 5,
      critical: 10,
    };

    const multiplier = severityMultiplier[severity];

    return {
      customersAffected: Math.floor(Math.random() * 1000 * multiplier) + 100,
      communicationIncrease: Math.random() * 50 * multiplier,
      sentimentImpact:
        type === 'outage' || type === 'incident'
          ? -(Math.random() * 0.3 * multiplier)
          : Math.random() * 0.2,
    };
  }

  private generateSentimentImpact(type: string, severity: string): number {
    const baseImpact: Record<string, number> = {
      outage: -0.4,
      incident: -0.5,
      policy_change: -0.1,
      launch: 0.2,
      promotion: 0.3,
    };

    const severityFactor: Record<string, number> = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    };

    const base = baseImpact[type] || 0;
    const factor = severityFactor[severity] || 1.0;

    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, base * factor));
  }
}

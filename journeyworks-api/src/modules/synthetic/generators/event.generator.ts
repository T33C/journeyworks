/**
 * Event Generator
 *
 * Generates synthetic timeline events for investment banking.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticEvent } from '../synthetic-data.types';

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
      label: 'Trading Platform Issue',
      description:
        'Trading platform experiencing slow response times during peak hours',
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
      label: 'Portfolio Analytics Tool Launch',
      description: 'New AI-powered portfolio analytics dashboard',
    },
    {
      label: 'Instant Transfers Feature',
      description: 'Real-time fund transfers now available to all customers',
    },
    {
      label: 'Robo-Advisor Service',
      description: 'Automated investment advisory service for retail clients',
    },
    {
      label: 'ESG Investment Options',
      description: 'New sustainable investment product offerings',
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
      label: 'Trading Hours Extension',
      description: 'Extended trading hours for certain markets',
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
      label: 'Market Volatility Event',
      description: 'Significant market movements affecting portfolios',
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

const PRODUCTS = [
  'mobile-app',
  'online-banking',
  'credit-card',
  'current-account',
  'savings-account',
  'mortgage',
  'personal-loan',
  'insurance',
  'trading-platform',
  'wealth-management',
];

const CHANNELS = ['email', 'phone', 'chat', 'mobile', 'web', 'branch'];

const REGIONS = ['north', 'south', 'east', 'west', 'central', 'international'];

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const STATUSES = ['planned', 'active', 'resolved', 'cancelled'] as const;

@Injectable()
export class EventGenerator {
  /**
   * Generate a single event
   */
  generate(dateRange: { start: Date; end: Date }): SyntheticEvent {
    const type = this.randomChoice(EVENT_TYPES);
    const templates = EVENT_TEMPLATES[type];
    const template = this.randomChoice(templates);

    const startDate = this.randomDate(dateRange.start, dateRange.end);
    const duration = this.randomDuration(type);
    const endDate = new Date(startDate.getTime() + duration);

    const severity = this.weightedChoice(SEVERITIES, [0.4, 0.35, 0.2, 0.05]);
    const status = this.determineStatus(startDate, endDate, new Date());

    const affectsMultipleProducts = Math.random() < 0.3;
    const products = affectsMultipleProducts
      ? this.randomSubset(PRODUCTS, 2, 4)
      : [this.randomChoice(PRODUCTS)];

    const affectsMultipleChannels = Math.random() < 0.4;
    const channels = affectsMultipleChannels
      ? this.randomSubset(CHANNELS, 2, 4)
      : [this.randomChoice(CHANNELS)];

    const affectedRegions =
      Math.random() < 0.6 ? this.randomSubset(REGIONS, 1, 3) : REGIONS; // Affects all regions

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
      source: this.randomChoice(['manual', 'automated', 'external'] as const),
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

  private randomChoice<T>(array: readonly T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private weightedChoice<T>(items: readonly T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  private randomSubset<T>(array: T[], min: number, max: number): T[] {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  private randomDate(start: Date, end: Date): Date {
    const diff = end.getTime() - start.getTime();
    // Use square root to bias towards more recent dates
    const biasedRandom = Math.pow(Math.random(), 0.5);
    return new Date(start.getTime() + biasedRandom * diff);
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

/**
 * Survey Generator
 *
 * Generates synthetic NPS survey data for customer journey analysis.
 * Creates surveys at each journey stage with realistic patterns:
 * - Response rates (~25%)
 * - Product-specific NPS patterns (mortgage = poor, cards = better)
 * - Channel variations
 * - Time-based trends around events
 * - Verbatim feedback
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SurveyDocument,
  JourneyStage,
  NpsCategory,
} from '../../surveys/surveys.repository';
import { SyntheticCase, SyntheticEvent } from '../synthetic-data.types';

/**
 * Journey stage progression with typical sentiment patterns
 */
interface JourneyPattern {
  // Base NPS score range for each stage (0-10 scale)
  // Detractor: 0-6, Passive: 7-8, Promoter: 9-10
  stages: {
    'initial-contact': { min: number; max: number };
    triage: { min: number; max: number };
    investigation: { min: number; max: number };
    resolution: { min: number; max: number };
    'post-resolution': { min: number; max: number };
  };
  // Probability of response at each stage
  responseRates: {
    'initial-contact': number;
    triage: number;
    investigation: number;
    resolution: number;
    'post-resolution': number;
  };
}

/**
 * Product-specific journey patterns
 * Each product has different NPS trajectories
 */
const PRODUCT_PATTERNS: Record<string, JourneyPattern> = {
  // POOR PERFORMERS - demonstrate need for improvement
  mortgage: {
    stages: {
      'initial-contact': { min: 2, max: 5 }, // Very unhappy at start
      triage: { min: 1, max: 4 }, // Gets worse - slow process
      investigation: { min: 0, max: 3 }, // Frustration peaks
      resolution: { min: 2, max: 5 }, // Some relief but still negative
      'post-resolution': { min: 3, max: 6 }, // Still mostly detractors
    },
    responseRates: {
      'initial-contact': 0.35, // Higher response when upset
      triage: 0.25,
      investigation: 0.3, // Want to vent
      resolution: 0.25,
      'post-resolution': 0.2,
    },
  },
  'personal-loan': {
    stages: {
      'initial-contact': { min: 2, max: 5 },
      triage: { min: 2, max: 5 },
      investigation: { min: 1, max: 4 }, // Long investigation frustrates
      resolution: { min: 3, max: 6 },
      'post-resolution': { min: 3, max: 6 }, // Lingering dissatisfaction
    },
    responseRates: {
      'initial-contact': 0.3,
      triage: 0.25,
      investigation: 0.28,
      resolution: 0.22,
      'post-resolution': 0.18,
    },
  },
  insurance: {
    stages: {
      'initial-contact': { min: 3, max: 5 },
      triage: { min: 2, max: 5 }, // Bureaucracy frustrates
      investigation: { min: 2, max: 5 }, // Stagnant
      resolution: { min: 3, max: 5 }, // Still negative
      'post-resolution': { min: 3, max: 6 }, // Barely improves
    },
    responseRates: {
      'initial-contact': 0.28,
      triage: 0.22,
      investigation: 0.2,
      resolution: 0.22,
      'post-resolution': 0.18,
    },
  },

  // MODERATE PERFORMERS - mixed results
  'current-account': {
    stages: {
      'initial-contact': { min: 3, max: 6 },
      triage: { min: 3, max: 6 },
      investigation: { min: 4, max: 6 },
      resolution: { min: 5, max: 7 },
      'post-resolution': { min: 5, max: 8 }, // Some passives emerge
    },
    responseRates: {
      'initial-contact': 0.28,
      triage: 0.24,
      investigation: 0.22,
      resolution: 0.25,
      'post-resolution': 0.2,
    },
  },
  'savings-account': {
    stages: {
      'initial-contact': { min: 3, max: 6 },
      triage: { min: 4, max: 6 },
      investigation: { min: 5, max: 7 },
      resolution: { min: 6, max: 8 },
      'post-resolution': { min: 6, max: 8 }, // Reasonable outcome
    },
    responseRates: {
      'initial-contact': 0.26,
      triage: 0.22,
      investigation: 0.2,
      resolution: 0.24,
      'post-resolution': 0.22,
    },
  },

  // BETTER PERFORMERS - show what good looks like
  'credit-card': {
    stages: {
      'initial-contact': { min: 3, max: 6 },
      triage: { min: 4, max: 7 },
      investigation: { min: 5, max: 7 },
      resolution: { min: 6, max: 9 },
      'post-resolution': { min: 7, max: 10 }, // Actually creates promoters
    },
    responseRates: {
      'initial-contact': 0.25,
      triage: 0.22,
      investigation: 0.2,
      resolution: 0.26,
      'post-resolution': 0.28, // Happy customers respond more
    },
  },
};

// Default pattern for unknown products
const DEFAULT_PATTERN: JourneyPattern = {
  stages: {
    'initial-contact': { min: 2, max: 5 },
    triage: { min: 2, max: 5 },
    investigation: { min: 3, max: 6 },
    resolution: { min: 4, max: 7 },
    'post-resolution': { min: 4, max: 7 },
  },
  responseRates: {
    'initial-contact': 0.28,
    triage: 0.24,
    investigation: 0.22,
    resolution: 0.24,
    'post-resolution': 0.2,
  },
};

/**
 * Verbatim templates by NPS category
 */
const VERBATIM_TEMPLATES = {
  detractor: {
    'initial-contact': [
      'Waited over 30 minutes to speak to someone. Unacceptable.',
      'The automated system is useless. Had to repeat my issue three times.',
      "Can't believe I'm having this problem with a supposedly reputable bank.",
      'First impression is terrible. Already regretting being a customer.',
      'Nobody seems to care about my issue.',
    ],
    triage: [
      'Been passed around to three different departments. Still no resolution.',
      'Why does it take so long to assess a simple issue?',
      'The process is overly complicated and frustrating.',
      "I've explained my problem multiple times now.",
      'Feel like just another number, not a valued customer.',
    ],
    investigation: [
      "It's been two weeks and still no update on my case.",
      'The lack of communication is appalling.',
      "Starting to think they're hoping I'll just give up.",
      'Every time I call I get a different story.',
      'This is taking far too long. Completely unacceptable.',
    ],
    resolution: [
      'The resolution was inadequate. Expected much better.',
      "Took way too long to get here and I'm still not satisfied.",
      "They've done the bare minimum. Not impressed.",
      "The compensation offered doesn't cover my inconvenience.",
      'Problem solved but trust is broken.',
    ],
    'post-resolution': [
      'The whole experience has put me off. Looking at other banks.',
      "Won't be recommending you to anyone.",
      'One bad experience has undone years of loyalty.',
      'Still bitter about how this was handled.',
      'Considering moving my accounts elsewhere.',
    ],
  },
  passive: {
    'initial-contact': [
      'Eventually got through. Could be faster.',
      'The agent was helpful enough but the wait was long.',
      'Standard service, nothing special.',
      'Got my case logged, waiting to see what happens.',
      'Okay experience so far.',
    ],
    triage: [
      "They've categorised my issue, now waiting for someone to look at it.",
      'Process seems reasonable, just hoping it moves quickly.',
      'Communication could be better but manageable.',
      'Average service so far.',
      'Nothing to complain about but nothing impressive either.',
    ],
    investigation: [
      "They're looking into it. Fingers crossed.",
      'Updates have been sporadic but at least something is happening.',
      "It's taking a while but I understand these things take time.",
      'Could be better, could be worse.',
      'Waiting game continues.',
    ],
    resolution: [
      'Issue was resolved. Took longer than I hoped.',
      'Acceptable outcome in the end.',
      'They fixed it but the process was clunky.',
      'Fair resolution, could have been faster.',
      'Problem sorted, moving on.',
    ],
    'post-resolution': [
      'All in all, an okay experience.',
      "Wouldn't rave about it but wouldn't complain loudly either.",
      'They got there in the end.',
      'Reasonable handling overall.',
      'Middle of the road service.',
    ],
  },
  promoter: {
    'initial-contact': [
      'Got through quickly and the agent was very understanding.',
      'Impressed by how seriously they took my concern.',
      'Great first impression. They really listened.',
      'Quick response and empathetic staff.',
      'Already feeling confident this will be resolved.',
    ],
    triage: [
      'They explained the process clearly and set expectations well.',
      'Appreciate the transparency about what happens next.',
      'Efficient handling so far.',
      'Good communication throughout.',
      'Feeling like a valued customer.',
    ],
    investigation: [
      'Regular updates keeping me informed. Appreciate it.',
      'They seem to genuinely care about getting this right.',
      'Professional and thorough investigation.',
      'Good progress being made.',
      "Confident they'll sort this properly.",
    ],
    resolution: [
      'Excellent resolution. Beyond what I expected.',
      'They went above and beyond to make things right.',
      'Really impressed with how this was handled.',
      'Fair and swift resolution. Thank you.',
      'This is how customer service should be done.',
    ],
    'post-resolution': [
      'Excellent experience overall. Will definitely recommend.',
      'Turned a negative into a positive. Kudos to the team.',
      'My faith in the bank has been restored.',
      'Really pleased with how this was handled from start to finish.',
      "They've earned my loyalty with this experience.",
    ],
  },
};

/**
 * Channel-based NPS modifiers
 * Some channels perform better than others
 */
const CHANNEL_MODIFIERS: Record<string, number> = {
  chat: 0.5, // Chat tends to be better
  email: 0,
  phone: -0.3, // Phone can be frustrating (hold times)
  letter: -0.5, // Slow channel
  social: 0.3, // Public accountability helps
};

/**
 * Response rate multiplier - increase to get more survey responses
 * Default patterns have ~20-35% response rate, multiplier increases this
 * 1.0 = normal, 2.0 = double response rate, 3.0 = triple, etc.
 * Capped at 1.0 (100%) probability
 */
const RESPONSE_RATE_MULTIPLIER = 3.0;

@Injectable()
export class SurveyGenerator {
  /**
   * Generate all surveys for a case (one per journey stage)
   */
  generateForCase(
    caseData: SyntheticCase,
    events?: SyntheticEvent[],
  ): SurveyDocument[] {
    const surveys: SurveyDocument[] = [];
    // Use product from case (derived from communications) for data consistency
    const product = caseData.product || this.selectRandomProduct();
    const pattern = PRODUCT_PATTERNS[product] || DEFAULT_PATTERN;
    // Default channel based on category - can vary by complaint type
    const channel = this.inferChannel(caseData.category);
    const channelModifier = CHANNEL_MODIFIERS[channel] || 0;

    // Check for event correlation (events happening near case creation)
    const eventCorrelation = this.findEventCorrelation(caseData, events);
    const eventModifier = eventCorrelation
      ? this.getEventModifier(eventCorrelation)
      : 0;

    // Calculate stage timestamps based on case dates
    const stageTimestamps = this.calculateStageTimestamps(caseData);

    const stages: JourneyStage[] = [
      'initial-contact',
      'triage',
      'investigation',
      'resolution',
      'post-resolution',
    ];

    for (const stage of stages) {
      const stagePattern = pattern.stages[stage];
      const baseResponseRate = pattern.responseRates[stage];

      // Apply multiplier and cap at 1.0 (100%)
      const responseRate = Math.min(
        1.0,
        baseResponseRate * RESPONSE_RATE_MULTIPLIER,
      );

      // Determine if customer responds
      const responded = Math.random() < responseRate;

      // Calculate score with modifiers
      let baseScore =
        Math.floor(Math.random() * (stagePattern.max - stagePattern.min + 1)) +
        stagePattern.min;

      // Apply channel modifier
      baseScore = Math.round(baseScore + channelModifier);

      // Apply event modifier (negative events make things worse)
      baseScore = Math.round(baseScore + eventModifier);

      // Clamp to 0-10
      const score = Math.max(0, Math.min(10, baseScore));

      // Determine NPS category
      const npsCategory = this.scoreToCategory(score);

      // Generate verbatim for some responses
      const verbatim =
        responded && Math.random() < 0.4 // 40% of responses include verbatim
          ? this.getVerbatim(npsCategory, stage)
          : undefined;

      surveys.push({
        id: uuidv4(),
        customerId: caseData.customerId,
        caseId: caseData.id,
        communicationId: undefined, // Could link to specific communication if needed
        journeyStage: stage,
        score,
        npsCategory,
        responded,
        channel,
        product,
        surveyDate: stageTimestamps[stage],
        caseCreatedAt: caseData.createdAt,
        verbatim,
        eventCorrelation: eventCorrelation?.id,
      });
    }

    return surveys;
  }

  /**
   * Generate surveys for multiple cases
   */
  generateForCases(
    cases: SyntheticCase[],
    events?: SyntheticEvent[],
  ): SurveyDocument[] {
    const allSurveys: SurveyDocument[] = [];

    for (const caseData of cases) {
      const caseSurveys = this.generateForCase(caseData, events);
      allSurveys.push(...caseSurveys);
    }

    return allSurveys;
  }

  /**
   * Select a random product with weighted distribution
   * Designed to create realistic demo data:
   * - More poor performers (mortgage, personal-loan) to show improvement opportunities
   * - Some moderate performers (current-account, savings-account)
   * - Fewer good performers (credit-card) to show benchmark
   */
  private selectRandomProduct(): string {
    const weightedProducts = [
      // Poor performers - 40%
      { product: 'mortgage', weight: 20 },
      { product: 'personal-loan', weight: 15 },
      { product: 'insurance', weight: 5 },
      // Moderate performers - 40%
      { product: 'current-account', weight: 25 },
      { product: 'savings-account', weight: 15 },
      // Good performers - 20%
      { product: 'credit-card', weight: 20 },
    ];

    const totalWeight = weightedProducts.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weightedProducts) {
      random -= item.weight;
      if (random <= 0) {
        return item.product;
      }
    }

    return 'current-account'; // Fallback
  }

  /**
   * Convert NPS score to category
   */
  private scoreToCategory(score: number): NpsCategory {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
  }

  /**
   * Calculate approximate timestamps for each journey stage
   */
  private calculateStageTimestamps(
    caseData: SyntheticCase,
  ): Record<JourneyStage, string> {
    const created = new Date(caseData.createdAt);
    const resolved = caseData.resolvedAt
      ? new Date(caseData.resolvedAt)
      : new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000); // Default 14 days

    const duration = resolved.getTime() - created.getTime();

    // Distribute stages across the case duration
    // Initial contact: immediately
    // Triage: ~10% through
    // Investigation: ~40% through
    // Resolution: ~80% through
    // Post-resolution: ~100% (at resolution) + a few days

    return {
      'initial-contact': created.toISOString(),
      triage: new Date(created.getTime() + duration * 0.1).toISOString(),
      investigation: new Date(created.getTime() + duration * 0.4).toISOString(),
      resolution: new Date(created.getTime() + duration * 0.8).toISOString(),
      'post-resolution': new Date(
        resolved.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 2 days after resolution
    };
  }

  /**
   * Find if any events correlate with this case's timeframe
   */
  private findEventCorrelation(
    caseData: SyntheticCase,
    events?: SyntheticEvent[],
  ): SyntheticEvent | undefined {
    if (!events || events.length === 0) return undefined;

    const caseDate = new Date(caseData.createdAt);
    const threeDaysBefore = new Date(
      caseDate.getTime() - 3 * 24 * 60 * 60 * 1000,
    );
    const threeDaysAfter = new Date(
      caseDate.getTime() + 3 * 24 * 60 * 60 * 1000,
    );

    return events.find((event) => {
      const eventDate = new Date(event.startDate);
      return eventDate >= threeDaysBefore && eventDate <= threeDaysAfter;
    });
  }

  /**
   * Get NPS modifier based on event type
   * Negative events make scores worse
   */
  private getEventModifier(event: SyntheticEvent): number {
    const eventType = event.type?.toLowerCase() || '';
    const severity = event.severity?.toLowerCase() || 'medium';

    // Severity multiplier
    const severityMult =
      severity === 'critical' ? 2.0 : severity === 'high' ? 1.5 : 1.0;

    // Event type modifiers (negative = bad for NPS)
    if (eventType.includes('outage') || eventType.includes('incident')) {
      return -2 * severityMult;
    }
    if (eventType.includes('fee') || eventType.includes('price')) {
      return -1.5 * severityMult;
    }
    if (eventType.includes('regulatory') || eventType.includes('compliance')) {
      return -1 * severityMult;
    }
    if (eventType.includes('launch') || eventType.includes('release')) {
      return 0.5; // New features can be positive
    }
    if (eventType.includes('improvement') || eventType.includes('fix')) {
      return 1; // Improvements help
    }

    return 0;
  }

  /**
   * Get a random verbatim comment
   */
  private getVerbatim(category: NpsCategory, stage: JourneyStage): string {
    const templates = VERBATIM_TEMPLATES[category]?.[stage];
    if (!templates || templates.length === 0) {
      return '';
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Infer likely channel based on product category
   */
  private inferChannel(category: string): string {
    const cat = category?.toLowerCase() || '';

    // Technical/app issues more likely via chat
    if (
      cat.includes('app') ||
      cat.includes('online') ||
      cat.includes('digital')
    ) {
      return Math.random() < 0.6 ? 'chat' : 'email';
    }

    // Complex financial products more likely via phone
    if (
      cat.includes('mortgage') ||
      cat.includes('loan') ||
      cat.includes('insurance')
    ) {
      return Math.random() < 0.5 ? 'phone' : 'email';
    }

    // Card issues often via chat
    if (cat.includes('card') || cat.includes('credit')) {
      return Math.random() < 0.4
        ? 'chat'
        : Math.random() < 0.5
          ? 'phone'
          : 'email';
    }

    // Default distribution
    const r = Math.random();
    if (r < 0.4) return 'email';
    if (r < 0.7) return 'phone';
    return 'chat';
  }
}

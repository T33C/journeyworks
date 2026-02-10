import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, delay, switchMap, map, catchError } from 'rxjs';
import {
  TimelineEvent,
  SentimentBubble,
  JourneyStage,
  QuadrantItem,
  ResearchInsight,
  EvidenceItem,
  AnalysisContext,
  FilterState,
} from '../models/analysis.model';
import { AnalysisApiService } from './analysis-api.service';

/**
 * Minimum number of survey responses required to show a product-specific
 * journey chart. Below this threshold we fall back to all products so the
 * waterfall still displays meaningful NPS variation.
 */
const MIN_JOURNEY_RESPONSES = 5;

@Injectable({
  providedIn: 'root',
})
export class AnalysisDataService {
  // Inject the API service for real data
  private readonly apiService = inject(AnalysisApiService);

  // Flag to use API vs mock data (can be toggled for demos)
  private useApi = true;

  /**
   * When a product-specific journey query returns too few survey responses
   * to be meaningful, we automatically retry with all products.  This signal
   * holds the original product that was dropped so the waterfall component
   * can display an explanatory subtitle.
   * `null` means no fallback occurred (product-specific data was sufficient).
   */
  journeyFallbackProduct = signal<string | null>(null);

  // Timeline Events - realistic banking scenarios
  private events: TimelineEvent[] = [
    {
      id: 'evt-001',
      date: new Date('2025-01-03T14:30:00'),
      type: 'outage',
      label: 'Payments Outage',
      product: 'cards',
      severity: 'critical',
      description: 'Card payment processing failure affecting 45,000 customers',
    },
    {
      id: 'evt-002',
      date: new Date('2025-01-06T09:00:00'),
      type: 'resolution',
      label: 'Outage Resolved',
      product: 'cards',
      severity: 'low',
      description: 'Payment processing restored',
    },
    {
      id: 'evt-003',
      date: new Date('2025-01-15T00:00:00'),
      type: 'launch',
      label: 'Premium Card Launch',
      product: 'cards',
      severity: 'medium',
      description: 'Launch of new Premium Rewards Card with enhanced benefits',
    },
    {
      id: 'evt-004',
      date: new Date('2025-01-20T11:00:00'),
      type: 'issue',
      label: 'Mobile App Update',
      product: 'all',
      severity: 'medium',
      description: 'App version 4.2.1 release with new features',
    },
    {
      id: 'evt-005',
      date: new Date('2025-01-22T08:00:00'),
      type: 'announcement',
      label: 'Fee Changes',
      product: 'current-account',
      severity: 'high',
      description: 'Announcement of updated overdraft fee structure',
    },
  ];

  // Helper to convert sentiment (-1 to +1) to NPS breakdown
  private sentimentToNPS(sentiment: number): {
    npsScore: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
  } {
    // Map sentiment to NPS: -1 → NPS -100, 0 → NPS 0, +1 → NPS +100
    // With realistic distributions based on sentiment

    if (sentiment < -0.5) {
      // Very negative: mostly detractors
      const detractorPct = 70 + Math.floor(Math.random() * 15);
      const passivePct = 15 + Math.floor(Math.random() * 10);
      const promoterPct = 100 - detractorPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else if (sentiment < -0.2) {
      // Moderately negative
      const detractorPct = 50 + Math.floor(Math.random() * 15);
      const passivePct = 25 + Math.floor(Math.random() * 10);
      const promoterPct = 100 - detractorPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else if (sentiment < 0.2) {
      // Neutral
      const detractorPct = 30 + Math.floor(Math.random() * 10);
      const passivePct = 35 + Math.floor(Math.random() * 10);
      const promoterPct = 100 - detractorPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else if (sentiment < 0.5) {
      // Moderately positive
      const promoterPct = 40 + Math.floor(Math.random() * 15);
      const passivePct = 30 + Math.floor(Math.random() * 10);
      const detractorPct = 100 - promoterPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else {
      // Very positive
      const promoterPct = 55 + Math.floor(Math.random() * 20);
      const passivePct = 25 + Math.floor(Math.random() * 10);
      const detractorPct = 100 - promoterPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    }
  }

  // Sentiment bubbles - daily aggregated data
  private generateBubbles(): SentimentBubble[] {
    const bubbles: SentimentBubble[] = [];
    const startDate = new Date('2025-01-01');

    for (let i = 0; i < 31; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Create realistic patterns based on events
      let baseSentiment = -0.2;
      let baseVolume = 45;
      let socialSentiment = -0.1;

      // Payments outage impact (Jan 3-6)
      if (i >= 2 && i <= 5) {
        baseSentiment = -0.7 - Math.random() * 0.2;
        baseVolume = 180 + Math.floor(Math.random() * 60);
        socialSentiment = -0.8;
      }
      // Recovery period (Jan 7-10)
      else if (i >= 6 && i <= 9) {
        baseSentiment = -0.4 + (i - 6) * 0.1;
        baseVolume = 90 - (i - 6) * 15;
        socialSentiment = -0.4;
      }
      // Card launch (Jan 15-18) - initial positive
      else if (i >= 14 && i <= 17) {
        baseSentiment = 0.2 - (i - 14) * 0.15;
        baseVolume = 70 + (i - 14) * 10;
        socialSentiment = 0.3 - (i - 14) * 0.1;
      }
      // Fee announcement impact (Jan 22+)
      else if (i >= 21) {
        baseSentiment = -0.5 - (i - 21) * 0.03;
        baseVolume = 100 + (i - 21) * 8;
        socialSentiment = -0.6;
      }

      const finalSentiment = baseSentiment + (Math.random() * 0.1 - 0.05);
      const nps = this.sentimentToNPS(finalSentiment);

      bubbles.push({
        id: `bubble-${i}`,
        date,
        volume: baseVolume + Math.floor(Math.random() * 20),
        surveyCount: Math.floor(
          (baseVolume + Math.floor(Math.random() * 20)) * 0.3,
        ),
        sentiment: finalSentiment,
        socialSentiment: socialSentiment + Math.random() * 0.1,
        themes: this.getThemesForDay(i),
        product: this.getProductForDay(i),
        channel: 'complaints',
        ...nps,
      });
    }
    return bubbles;
  }

  private getThemesForDay(dayIndex: number): string[] {
    if (dayIndex >= 2 && dayIndex <= 5) {
      return [
        'Payment Failure',
        'Card Declined',
        'POS Error',
        'Merchant Impact',
      ];
    }
    if (dayIndex >= 14 && dayIndex <= 17) {
      return ['Annual Fee', 'Benefit Questions', 'Upgrade Process'];
    }
    if (dayIndex >= 21) {
      return ['Overdraft Fees', 'Fee Increase', 'Account Closure'];
    }
    return ['General Inquiry', 'App Issues', 'Wait Times'];
  }

  private getProductForDay(dayIndex: number): string {
    if (dayIndex >= 2 && dayIndex <= 9) return 'cards';
    if (dayIndex >= 14 && dayIndex <= 17) return 'cards';
    if (dayIndex >= 21) return 'current-account';
    return 'all';
  }

  // Journey stages waterfall data
  private journeyStages: JourneyStage[] = [
    {
      stage: 'initial-contact',
      label: 'Initial Contact',
      sentiment: -0.45,
      previousSentiment: 0,
      change: -0.45,
      communications: 847,
      npsScore: -45,
      promoterPct: 8,
      passivePct: 22,
      detractorPct: 70,
    },
    {
      stage: 'triage',
      label: 'Triage',
      sentiment: -0.52,
      previousSentiment: -0.45,
      change: -0.07,
      communications: 823,
      npsScore: -52,
      promoterPct: 6,
      passivePct: 20,
      detractorPct: 74,
    },
    {
      stage: 'investigation',
      label: 'Investigation',
      sentiment: -0.38,
      previousSentiment: -0.52,
      change: 0.14,
      communications: 756,
      npsScore: -32,
      promoterPct: 14,
      passivePct: 26,
      detractorPct: 60,
    },
    {
      stage: 'resolution',
      label: 'Resolution',
      sentiment: -0.15,
      previousSentiment: -0.38,
      change: 0.23,
      communications: 689,
      npsScore: -8,
      promoterPct: 28,
      passivePct: 32,
      detractorPct: 40,
    },
    {
      stage: 'post-resolution',
      label: 'Post-Resolution',
      sentiment: 0.12,
      previousSentiment: -0.15,
      change: 0.27,
      communications: 412,
      npsScore: 18,
      promoterPct: 42,
      passivePct: 28,
      detractorPct: 30,
    },
  ];

  // Quadrant data - issues categorized
  private generateQuadrantItems(): QuadrantItem[] {
    return [
      // Critical (high volume, negative sentiment)
      {
        id: 'q-001',
        label: 'Payment Processing Errors',
        sentiment: -0.72,
        volume: 245,
        category: 'technical',
        product: 'cards',
        quadrant: 'critical',
        npsScore: -58,
        promoterPct: 8,
        passivePct: 18,
        detractorPct: 74,
      },
      {
        id: 'q-002',
        label: 'Overdraft Fee Disputes',
        sentiment: -0.65,
        volume: 189,
        category: 'fees',
        product: 'current-account',
        quadrant: 'critical',
        npsScore: -48,
        promoterPct: 12,
        passivePct: 22,
        detractorPct: 66,
      },
      {
        id: 'q-003',
        label: 'Card Declined at Merchant',
        sentiment: -0.58,
        volume: 156,
        category: 'technical',
        product: 'cards',
        quadrant: 'critical',
        npsScore: -42,
        promoterPct: 14,
        passivePct: 24,
        detractorPct: 62,
      },

      // Watch (low volume, negative sentiment)
      {
        id: 'q-004',
        label: 'Fraud Alert Delays',
        sentiment: -0.61,
        volume: 42,
        category: 'security',
        product: 'cards',
        quadrant: 'watch',
        npsScore: -45,
        promoterPct: 10,
        passivePct: 22,
        detractorPct: 68,
      },
      {
        id: 'q-005',
        label: 'Loan Application Errors',
        sentiment: -0.55,
        volume: 38,
        category: 'technical',
        product: 'loans',
        quadrant: 'watch',
        npsScore: -38,
        promoterPct: 15,
        passivePct: 25,
        detractorPct: 60,
      },
      {
        id: 'q-006',
        label: 'Interest Calculation Issues',
        sentiment: -0.48,
        volume: 28,
        category: 'fees',
        product: 'savings',
        quadrant: 'watch',
        npsScore: -30,
        promoterPct: 18,
        passivePct: 28,
        detractorPct: 54,
      },

      // Strength (high volume, positive sentiment)
      {
        id: 'q-007',
        label: 'Mobile App Experience',
        sentiment: 0.35,
        volume: 167,
        category: 'digital',
        product: 'all',
        quadrant: 'strength',
        npsScore: 32,
        promoterPct: 48,
        passivePct: 30,
        detractorPct: 22,
      },
      {
        id: 'q-008',
        label: 'Branch Service Quality',
        sentiment: 0.42,
        volume: 134,
        category: 'service',
        product: 'all',
        quadrant: 'strength',
        npsScore: 42,
        promoterPct: 55,
        passivePct: 28,
        detractorPct: 17,
      },

      // Noise (low volume, positive sentiment)
      {
        id: 'q-009',
        label: 'Rewards Program',
        sentiment: 0.28,
        volume: 45,
        category: 'product',
        product: 'cards',
        quadrant: 'noise',
        npsScore: 25,
        promoterPct: 42,
        passivePct: 32,
        detractorPct: 26,
      },
      {
        id: 'q-010',
        label: 'Online Statement Access',
        sentiment: 0.31,
        volume: 29,
        category: 'digital',
        product: 'all',
        quadrant: 'noise',
        npsScore: 28,
        promoterPct: 45,
        passivePct: 30,
        detractorPct: 25,
      },
    ];
  }

  // Evidence items for AI panel
  private evidence: EvidenceItem[] = [
    // Outage evidence
    {
      id: 'ev-001',
      type: 'complaint',
      source: 'CMP-2025-0312',
      timestamp: new Date('2025-01-04T09:23:00'),
      excerpt:
        '"My card was declined three times at the supermarket. Extremely embarrassing. I had to leave my shopping behind."',
      sentiment: -0.85,
      linkedChartId: 'bubble-3',
    },
    {
      id: 'ev-002',
      type: 'social',
      source: 'Twitter @frustrated_customer',
      timestamp: new Date('2025-01-03T16:45:00'),
      excerpt:
        '"@BankName your payment system is down AGAIN? This is the third time this month. Moving my account."',
      sentiment: -0.92,
      linkedChartId: 'bubble-2',
    },
    {
      id: 'ev-003',
      type: 'call',
      source: 'Call ID: 78234',
      timestamp: new Date('2025-01-04T11:12:00'),
      excerpt:
        'Customer highly distressed about multiple failed payments. Mentioned mortgage direct debit also failed.',
      sentiment: -0.78,
      linkedChartId: 'bubble-3',
    },
    {
      id: 'ev-004',
      type: 'news',
      source: 'Financial Times',
      timestamp: new Date('2025-01-04T14:00:00'),
      excerpt:
        '"Major UK bank suffers payment outage affecting thousands of customers during peak shopping hours"',
      sentiment: -0.45,
      linkedChartId: 'evt-001',
    },
    // Outage Resolved evidence
    {
      id: 'ev-007',
      type: 'social',
      source: 'Twitter @relieved_customer',
      timestamp: new Date('2025-01-06T14:30:00'),
      excerpt:
        '"Finally! @BankName payments working again. Took long enough but at least they fixed it."',
      sentiment: 0.15,
      linkedChartId: 'evt-002',
    },
    {
      id: 'ev-008',
      type: 'complaint',
      source: 'CMP-2025-0398',
      timestamp: new Date('2025-01-06T16:00:00'),
      excerpt:
        '"Payments are working now but I want compensation for the embarrassment and late fees I incurred."',
      sentiment: -0.35,
      linkedChartId: 'bubble-5',
    },
    // Card Launch evidence
    {
      id: 'ev-009',
      type: 'social',
      source: 'Twitter @cardpro_uk',
      timestamp: new Date('2025-01-15T10:15:00'),
      excerpt:
        '"Just got approved for the new @BankName Premium card! The benefits look amazing - 3% cashback on travel!"',
      sentiment: 0.78,
      linkedChartId: 'evt-003',
    },
    {
      id: 'ev-010',
      type: 'complaint',
      source: 'CMP-2025-0512',
      timestamp: new Date('2025-01-16T09:30:00'),
      excerpt:
        '"Applied for the Premium Card but got rejected with no explanation. Very frustrating after 10 years loyalty."',
      sentiment: -0.55,
      linkedChartId: 'bubble-15',
    },
    {
      id: 'ev-011',
      type: 'news',
      source: 'Which? Money',
      timestamp: new Date('2025-01-15T11:00:00'),
      excerpt:
        '"New Premium Rewards Card offers competitive 3% travel cashback but £150 annual fee may deter some customers"',
      sentiment: 0.22,
      linkedChartId: 'evt-003',
    },
    // App Update evidence
    {
      id: 'ev-012',
      type: 'social',
      source: 'Twitter @app_reviewer',
      timestamp: new Date('2025-01-20T14:00:00'),
      excerpt:
        '"The new @BankName app update is slick! Dark mode finally arrived and the biometric login is much faster."',
      sentiment: 0.65,
      linkedChartId: 'evt-004',
    },
    {
      id: 'ev-013',
      type: 'complaint',
      source: 'CMP-2025-0623',
      timestamp: new Date('2025-01-20T16:45:00'),
      excerpt:
        '"App update wiped my saved payees and I had to re-add them all. Why don\'t you test these things properly?"',
      sentiment: -0.48,
      linkedChartId: 'bubble-19',
    },
    {
      id: 'ev-014',
      type: 'call',
      source: 'Call ID: 82156',
      timestamp: new Date('2025-01-21T09:15:00'),
      excerpt:
        'Customer confused by new app layout. Needed guidance finding the statement download feature.',
      sentiment: -0.25,
      linkedChartId: 'bubble-20',
    },
    // Fee Changes evidence
    {
      id: 'ev-005',
      type: 'complaint',
      source: 'CMP-2025-0456',
      timestamp: new Date('2025-01-22T15:30:00'),
      excerpt:
        '"I just received notice of increased overdraft fees. After 15 years as a customer, this feels like a betrayal."',
      sentiment: -0.68,
      linkedChartId: 'bubble-21',
    },
    {
      id: 'ev-006',
      type: 'social',
      source: 'Twitter @money_matters',
      timestamp: new Date('2025-01-22T18:20:00'),
      excerpt:
        '"@BankName just announced fee increases. Classic move - squeeze existing customers while offering new customer deals."',
      sentiment: -0.75,
      linkedChartId: 'bubble-21',
    },
  ];

  // Pre-baked AI insights for different contexts
  private insights: Record<string, ResearchInsight> = {
    'payments-outage': {
      summary:
        'The payments outage on January 3rd caused NPS to plummet to -58, with 74% of customers rating as Detractors (0-6). Social media sentiment began declining 3 days before formal complaints peaked, providing a critical early warning signal that could enable proactive intervention.',
      confidence: 'high',
      keyDrivers: [
        'Payment processing failure drove NPS from -20 to -58 (38-point drop)',
        'Detractor percentage spiked from 45% to 74% during outage',
        'Social media NPS led formal complaint NPS by approximately 3 days',
        'Direct debit failures created secondary mortgage/utility concerns',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'I need to identify the root cause and timeline of the January 3rd payment outage. Let me search for incident data.',
          action: 'Search Incidents',
          observation:
            'Found incident INC-2025-0103: Payment gateway failure at 14:42 GMT. Database failover stuck at 67%. Manual intervention at 14:52. Restored at 15:18.',
        },
        {
          step: 2,
          thought:
            'Now I need to understand the customer impact. Let me look at NPS data before, during, and after the outage.',
          action: 'Query NPS Metrics',
          observation:
            'Pre-outage NPS: -20. During outage: -58 (38-point drop). Detractor rate spiked from 45% to 74%. 1,847 formal complaints filed.',
        },
        {
          step: 3,
          thought:
            'I should check if social media showed early warning signs before the formal complaints hit.',
          action: 'Analyse Social Sentiment',
          observation:
            'Social sentiment declined 3 days before formal complaints. Twitter/Reddit discussions about payment issues began T-3 days. Social NPS led formal complaint NPS by ~72 hours.',
        },
        {
          step: 4,
          thought:
            'Let me assess the downstream impact on other products - outages often cascade.',
          action: 'Cross-reference Products',
          observation:
            'Direct debit failures caused secondary mortgage and utility payment concerns. 312 complaints/hour at peak. 35% filed compensation requests.',
        },
      ],
      suggestedActions: [
        'Implement social media NPS monitoring for 3-day early warning',
        'Prepare proactive customer communication when social NPS drops below -30',
        'Target Detractors with personalized recovery outreach',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Not yet - NPS dropped 38 points during the outage (from -20 to -58). While services were restored, only 18% of Detractors have converted to Passives after 2 weeks. 35% filed compensation requests, indicating significant trust damage. To improve CX, we need faster incident response and proactive communication within the first hour of detecting issues.',
      },
    },
    'fee-changes': {
      summary:
        'The overdraft fee announcement on January 22nd triggered an NPS drop to -48, with Detractors (0-6 scores) at 66% - primarily long-term customers. Social media NPS indicated brewing discontent 3 days before formal complaint volumes spiked.',
      confidence: 'high',
      keyDrivers: [
        'Long-term customer NPS fell 25 points more than newer customers',
        'Detractor rate increased from 42% to 66% post-announcement',
        'Social media NPS declined 3 days ahead of complaints',
        'Promoter recovery rates are 40% lower than for technical issues',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'I need to assess the impact of the January 22nd fee announcement. Let me pull NPS data around that date.',
          action: 'Query NPS Timeline',
          observation:
            'NPS dropped from -23 to -48 within 48 hours of the announcement. Detractor rate rose from 42% to 66%.',
        },
        {
          step: 2,
          thought:
            'Fee changes often affect long-term customers differently. Let me segment by tenure.',
          action: 'Segment by Customer Tenure',
          observation:
            'Customers with 5+ years tenure showed 25-point larger NPS drop than newer customers. Long-term customers 3x more likely to file formal complaints.',
        },
        {
          step: 3,
          thought:
            'I should check if social media provided early warning, similar to the outage pattern.',
          action: 'Analyse Social Sentiment',
          observation:
            'Social media NPS declined 3 days before formal complaints spiked. Customers vented on social media before filing formal complaints. Pattern consistent with outage behaviour.',
        },
        {
          step: 4,
          thought:
            'Let me compare recovery rates with technical issues to understand if fee complaints resolve differently.',
          action: 'Compare Recovery Patterns',
          observation:
            'Promoter recovery rate for fee complaints: 8% vs 42% for technical issues. Fee-related trust damage is persistent - no natural recovery trajectory observed.',
        },
      ],
      suggestedActions: [
        'Monitor social NPS for early fee-related discontent detection',
        'Consider loyalty tier exemptions for customers with historical NPS > 30',
        'Proactive outreach to high-value long-term Detractors',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'No - fee changes permanently degraded CX for long-term customers. NPS dropped 25 points more for 5+ year customers vs newer ones, and Promoter recovery rates are 40% lower than for technical issues. Unlike outages which recover, fee-related trust damage persists. Consider loyalty exemptions or phased rollouts to protect high-value relationships.',
      },
    },
    'outage-resolved': {
      summary:
        'Following the January 6th resolution, NPS began recovering from -58 to -32 over 4 days. However, 35% of affected customers filed compensation requests, and Promoter recovery was slow with only 18% returning to positive scores within 2 weeks.',
      confidence: 'high',
      keyDrivers: [
        'NPS recovery trajectory: -58 → -42 → -32 over 4 days',
        'Compensation requests from 35% of affected customers',
        'Only 18% of Detractors converted to Passives within 2 weeks',
        'Social media sentiment improved faster than formal complaint NPS',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'The outage was resolved on January 6th. I need to track the NPS recovery trajectory after resolution.',
          action: 'Query Post-Incident NPS',
          observation:
            'NPS recovery: -58 → -42 (day 2) → -32 (day 4). Recovery rate of ~6.5 NPS points per day initially, then slowing.',
        },
        {
          step: 2,
          thought:
            'Let me check how customers responded - compensation requests are a key indicator of ongoing dissatisfaction.',
          action: 'Analyse Compensation Data',
          observation:
            '35% of affected customers filed compensation requests. Average claim value: £45. Only 18% of Detractors converted to Passives within 2 weeks.',
        },
        {
          step: 3,
          thought:
            'I should compare social sentiment recovery vs formal complaint sentiment to see which recovers faster.',
          action: 'Compare Channel Recovery',
          observation:
            'Social media sentiment recovered 2 days ahead of formal complaint NPS. Customers acknowledged the fix on social media before updating formal feedback. The 3-day lead pattern reversed during recovery.',
        },
      ],
      suggestedActions: [
        'Implement post-incident NPS recovery tracking dashboard',
        'Proactive compensation offers to high-value Detractors',
        'Follow-up survey 2 weeks post-resolution to measure Promoter recovery',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Partially - NPS recovered from -58 to -32 over 4 days, a 26-point improvement. Social sentiment recovered faster than formal complaint NPS. However, only 18% of Detractors converted to Passives within 2 weeks. The 35% compensation request rate suggests customers feel the recovery process itself needs improvement. Faster proactive outreach post-resolution would accelerate CX recovery.',
      },
    },
    'card-launch': {
      summary:
        'The Premium Card launch on January 15th showed mixed NPS results: initial social NPS was +32 among early adopters, but declined to -15 by day 3 as rejected applicants voiced frustration. 42% of complaints cited unclear rejection reasons.',
      confidence: 'high',
      keyDrivers: [
        'Early adopter NPS: +32 (65% Promoters, driven by 3% cashback)',
        'Rejected applicant NPS: -45 (68% Detractors)',
        'Unclear rejection criteria cited in 42% of complaints',
        '£150 annual fee mentioned as concern in 28% of social posts',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'I need to understand the NPS trajectory after the Premium Card launch on January 15th.',
          action: 'Query Launch NPS Data',
          observation:
            'Initial social NPS: +32 among early adopters. By day 3, overall NPS declined to -15 as rejection notifications went out.',
        },
        {
          step: 2,
          thought:
            'The NPS split suggests very different experiences for approved vs rejected applicants. Let me segment.',
          action: 'Segment by Application Outcome',
          observation:
            'Approved customers NPS: +32 (65% Promoters, 3% cashback driving satisfaction). Rejected applicants NPS: -45 (68% Detractors). 42% cited unclear rejection reasons.',
        },
        {
          step: 3,
          thought:
            'Let me check social media for the sentiment pattern around this launch.',
          action: 'Analyse Social Timeline',
          observation:
            'Social showed initial positive spike (early adopters celebrating) followed by decline as rejections arrived. 28% of social posts mentioned £150 annual fee as a concern.',
        },
      ],
      suggestedActions: [
        'Improve rejection letter clarity with specific reasons and alternatives',
        'Consider soft-launch "pre-qualification" to reduce rejection surprises',
        'Target Passives with fee waiver offer to convert to Promoters',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Mixed results - approved customers have excellent CX (NPS +32, 65% Promoters) driven by competitive 3% cashback. However, rejected applicants show NPS -45 with 68% Detractors. 42% cited unclear rejection reasons as the main frustration. Net CX impact depends on approval ratio. To improve overall CX, implement pre-qualification checks and clearer rejection communications.',
      },
    },
    'app-update': {
      summary:
        'The January 20th app update (v4.2.1) achieved overall NPS of +12, with dark mode receiving praise (+38 NPS). However, payee data migration issues drove 23% of complaints, dropping affected users to NPS -28.',
      confidence: 'medium',
      keyDrivers: [
        'Dark mode feature NPS: +38 (highly requested feature)',
        'Biometric login improvements: +25 NPS lift',
        'Payee migration bug affected 8% of users (NPS -28 for this group)',
        'Navigation changes generated 15% increase in support calls',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Let me assess the overall impact of the v4.2.1 app update released on January 20th.',
          action: 'Query App Update NPS',
          observation:
            'Overall NPS: +12. Dark mode praised highly (+38 NPS). Biometric improvements contributed +25 NPS lift.',
        },
        {
          step: 2,
          thought:
            'There seem to be negative signals too. Let me look at complaint drivers post-update.',
          action: 'Analyse Post-Update Complaints',
          observation:
            'Payee data migration bug affected 8% of users. These users dropped to NPS -28 and generated 23% of all complaints. Navigation changes caused 15% increase in support calls.',
        },
        {
          step: 3,
          thought:
            'Let me check the social media reaction to understand the sentiment timeline.',
          action: 'Analyse Social Timeline',
          observation:
            'Social NPS spiked positive immediately as tech-savvy users praised dark mode. By day 3, negative sentiment built among users who lost payee data.',
        },
      ],
      suggestedActions: [
        'Urgent fix for payee data restoration with proactive push notification',
        'In-app tutorial for navigation changes to reduce support calls',
        'Target affected users with apology and NPS recovery survey',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Yes, for 92% of users - dark mode (NPS +38) and biometric improvements (+25 NPS) significantly improved the app experience. However, the 8% affected by the payee migration bug saw NPS drop to -28 and generated 23% of all complaints. Net CX improved (overall NPS +12), but the payee bug created a vocal group of Detractors requiring urgent remediation.',
      },
    },
    default: {
      summary:
        'Analysis of the selected period shows NPS ranging from -55 (Investigation stage) to -22 (Post-Resolution). While some improvement occurs through the journey, customers remain unsatisfied at resolution - indicating systemic CX issues requiring attention.',
      confidence: 'medium',
      keyDrivers: [
        'Social media NPS leads formal complaints by ~3 days',
        'NPS recovery through resolution journey averages only +20 points',
        'Post-resolution Detractor rate remains at 52%',
        'Response time delays impact NPS by -15 points on average',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'I need to assess the overall NPS landscape across the complaint journey stages.',
          action: 'Query Journey Stage NPS',
          observation:
            'NPS ranges from -55 (Investigation) to -22 (Post-Resolution). Average recovery of +20 points across the journey, but customers end negative.',
        },
        {
          step: 2,
          thought:
            'Let me check the social media lead pattern and response time correlation.',
          action: 'Analyse Leading Indicators',
          observation:
            'Social media NPS leads formal complaints by ~3 days. Response time delays correlate with -15 NPS point impact. Post-resolution Detractor rate remains at 52%.',
        },
      ],
      suggestedActions: [
        'Monitor social NPS band for early warning signals',
        'Click on an event or bubble for targeted NPS recommendations',
        'Focus on reducing Investigation stage friction - highest drop-off point',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Partially - the resolution journey shows a +20 point NPS improvement from Investigation (-55) to Post-Resolution (-22), but customers still end negative. Only 18% convert to Promoters, with 52% remaining Detractors. This indicates process improvements are needed - particularly in the Investigation and Resolution stages where sentiment stagnates.',
      },
    },
    // TOPIC INSIGHTS - For quadrant item clicks
    'topic-payment-processing': {
      summary:
        'Payment Processing Errors sits in the CRITICAL quadrant with NPS -58 (74% Detractors) and 245 complaints. This is the highest-impact issue requiring immediate attention. Root causes trace to legacy payment gateway timeouts during peak hours.',
      confidence: 'high',
      keyDrivers: [
        'Legacy payment gateway timeout rate: 2.3% (target: <0.5%)',
        'Peak hour failures 4x higher than off-peak (12pm-2pm, 5pm-7pm)',
        'Retry logic causing duplicate transactions in 8% of failures',
        '89% of Detractors cite "embarrassment at point of sale" as primary frustration',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Payment Processing Errors is flagged as Critical. Let me examine the root cause and infrastructure metrics.',
          action: 'Query Infrastructure Metrics',
          observation:
            'Legacy payment gateway timeout rate: 2.3% (target: <0.5%). Peak hour failures 4x higher than off-peak. Retry logic causing duplicate transactions in 8% of failures.',
        },
        {
          step: 2,
          thought:
            'I need to understand the customer impact and sentiment around payment failures.',
          action: 'Analyse Customer Impact',
          observation:
            'NPS -58 with 74% Detractors. 245 complaints. 89% cite "embarrassment at point of sale" as primary frustration. Post-outage baseline error rate increased from 0.8% to 2.3%.',
        },
        {
          step: 3,
          thought:
            'Let me check if social media provides early warning for payment failures.',
          action: 'Analyse Social Signals',
          observation:
            'Social media complaints about payment failures precede formal complaints by 2-3 days. Strong correlation with the January 3rd outage.',
        },
      ],
      suggestedActions: [
        'Urgent: Upgrade payment gateway infrastructure (target: <0.5% failure rate)',
        'Implement proactive SMS notification when payment fails',
        'Add retry limit to prevent duplicate transactions',
        'Create dedicated recovery workflow for affected customers',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'No - Payment Processing remains in the Critical quadrant with NPS -58. The 74% Detractor rate is the highest across all topics. While services were restored after the outage, the underlying infrastructure issues persist. Customers experiencing payment failures have only 12% Promoter recovery rate even after issue resolution.',
      },
    },
    'topic-overdraft-fees': {
      summary:
        'Overdraft Fee Disputes is a CRITICAL issue with NPS -48 (66% Detractors) and 189 complaints. Unlike technical issues, fee disputes show no recovery pattern - customers who complain about fees rarely become Promoters again.',
      confidence: 'high',
      keyDrivers: [
        'Long-term customers (5+ years) 3x more likely to complain about fees',
        'January fee increase triggered 40% complaint volume spike',
        'Only 8% of fee complainants convert to Promoters post-resolution',
        'Competitor fee comparisons cited in 45% of complaints',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Overdraft Fee Disputes is Critical. Let me examine the complaint patterns and customer segments.',
          action: 'Analyse Fee Complaint Patterns',
          observation:
            'NPS -48 with 66% Detractors. 189 complaints. Long-term customers (5+ years) 3x more likely to complain. January fee increase triggered 40% complaint volume spike.',
        },
        {
          step: 2,
          thought:
            'Fee complaints may behave differently from technical issues. Let me check recovery patterns.',
          action: 'Compare Recovery Rates',
          observation:
            'Only 8% of fee complainants convert to Promoters post-resolution vs 42% for technical issues. No natural NPS recovery trajectory - sentiment remains persistently negative.',
        },
        {
          step: 3,
          thought:
            'Let me check social media lead indicators for fee-related complaints.',
          action: 'Analyse Social Lead Time',
          observation:
            'Social sentiment provides 3-day early warning of formal complaint surges. Competitor fee comparisons cited in 45% of complaints.',
        },
      ],
      suggestedActions: [
        'Consider loyalty-based fee exemptions for 5+ year customers',
        'Implement transparent fee communication before charges apply',
        'Create fee reduction pathway for customers filing complaints',
        'Monitor competitor fee structures quarterly',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'No - Overdraft Fee Disputes remains Critical with NPS -48. Fee-related trust damage is persistent - only 8% of complainants become Promoters vs 42% for technical issues. The January fee increase alienated long-term customers who are 3x more likely to file complaints.',
      },
    },
    'topic-card-declined': {
      summary:
        'Card Declined at Merchant is a CRITICAL issue with NPS -42 (62% Detractors) and 156 complaints. This issue causes acute customer embarrassment and has significant churn risk - 28% of affected customers mention switching banks.',
      confidence: 'high',
      keyDrivers: [
        'Real-time authorization latency: 4.2s average (target: <2s)',
        '28% of complaints mention considering switching banks',
        'Grocery stores and petrol stations highest decline rates',
        'Fraud detection false positive rate: 12% (target: <5%)',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Card Declined is a Critical issue with churn risk. Let me analyse the technical causes.',
          action: 'Query Authorization Metrics',
          observation:
            'Real-time authorization latency: 4.2s (target: <2s). Fraud detection false positive rate: 12% (target: <5%). Grocery stores and petrol stations show highest decline rates.',
        },
        {
          step: 2,
          thought:
            'Let me assess the churn risk and customer sentiment impact.',
          action: 'Analyse Churn Indicators',
          observation:
            '28% of complaints mention considering switching banks. NPS -42 with 62% Detractors. 156 complaints. Customers report acute embarrassment at point of sale.',
        },
      ],
      suggestedActions: [
        'Reduce authorization latency to <2s',
        'Tune fraud detection to reduce false positives',
        'Implement instant SMS explanation when card is declined',
        'Create emergency card unblock self-service option',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Partially - While we restored services, the underlying authorization latency (4.2s) still exceeds target (2s). 28% of customers mention switching banks, indicating high churn risk. The 12% fraud false positive rate continues to cause unnecessary declines.',
      },
    },
    'topic-fraud-alerts': {
      summary:
        'Fraud Alert Delays sits in the WATCH quadrant with NPS -45 (68% Detractors) but lower volume (42 complaints). Despite low volume, this is a security-critical issue - delayed fraud alerts result in average £340 additional loss per incident.',
      confidence: 'high',
      keyDrivers: [
        'Average fraud alert delay: 47 minutes (target: <5 minutes)',
        'Delayed alerts result in £340 average additional fraud loss',
        'Weekend fraud detection 3x slower than weekdays',
        '68% Detractor rate highest among Watch quadrant issues',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Fraud Alert Delays is a security-critical Watch issue. Let me examine the delay metrics.',
          action: 'Query Alert Timing Data',
          observation:
            'Average fraud alert delay: 47 minutes (target: <5 minutes). Weekend fraud detection 3x slower than weekdays. Delayed alerts result in £340 average additional fraud loss per incident.',
        },
        {
          step: 2,
          thought:
            'Let me check if this correlates with any timeline events or is a chronic issue.',
          action: 'Analyse Temporal Patterns',
          observation:
            'No correlation with timeline events - this is a chronic infrastructure issue. Low volume (42 complaints) keeps it in Watch rather than Critical, but 68% Detractor rate is highest among Watch quadrant.',
        },
      ],
      suggestedActions: [
        'Implement real-time fraud alerting (<5 minute target)',
        'Extend 24/7 fraud monitoring coverage to weekends',
        'Add push notification in addition to SMS for fraud alerts',
        'Review alert thresholds to balance speed vs false positives',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'No - Fraud Alert Delays remains in Watch with NPS -45. While lower volume prevents Critical classification, the 68% Detractor rate and £340 average additional fraud loss per incident make this a priority. Weekend detection is 3x slower than weekdays.',
      },
    },
    'topic-loan-applications': {
      summary:
        'Loan Application Errors is in the WATCH quadrant with NPS -38 (60% Detractors) and 38 complaints. Technical errors during loan applications lose high-value customers - average loan value for affected customers is £45,000.',
      confidence: 'medium',
      keyDrivers: [
        'Application timeout rate: 8% (causes form restart)',
        'Average affected customer loan value: £45,000',
        'Document upload failures: 15% of applications',
        '60% cite "wasted time" as primary frustration',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Loan Application Errors is in Watch. Let me understand the technical issues and customer value at risk.',
          action: 'Analyse Application Failures',
          observation:
            'Application timeout rate: 8% (causes form restart). Document upload failures: 15%. Average affected customer loan value: £45,000. 60% cite "wasted time" as primary frustration.',
        },
        {
          step: 2,
          thought:
            'Let me check if there are any event correlations or if this is a chronic issue.',
          action: 'Check Temporal Patterns',
          observation:
            'Steady baseline with no event correlation. Issues are chronic rather than incident-driven. Timeout rate improved from 12% to 8% last quarter.',
        },
      ],
      suggestedActions: [
        'Implement application save/resume functionality',
        'Fix document upload timeout issues',
        'Add progress indicator and estimated completion time',
        'Create VIP support channel for high-value loan applicants',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Partially - The 8% timeout rate has improved from 12% last quarter, but 60% of Detractors still cite wasted time. With £45,000 average loan value at stake, each lost application has significant revenue impact.',
      },
    },
    'topic-interest-calculation': {
      summary:
        'Interest Calculation Issues is in the WATCH quadrant with NPS -30 (54% Detractors) and 28 complaints. Lower Detractor rate than other Watch issues, but high reputational risk - calculation errors erode fundamental trust in banking accuracy.',
      confidence: 'medium',
      keyDrivers: [
        'Rounding errors in 0.3% of interest calculations',
        '54% Detractor rate lowest among negative-sentiment topics',
        'Average customer impact: £12 per incident',
        'High media/regulatory risk despite low per-incident impact',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Interest Calculation Issues is in Watch with regulatory risk. Let me assess the scope.',
          action: 'Analyse Calculation Errors',
          observation:
            'Rounding errors in 0.3% of calculations. Average customer impact: £12 per incident. 54% Detractor rate - lowest among negative topics. 28 complaints.',
        },
        {
          step: 2,
          thought:
            'Despite low per-incident impact, this could be a regulatory risk. Let me check the pattern.',
          action: 'Assess Regulatory Risk',
          observation:
            'Issues sporadic with no event correlation. Low volume and moderate Detractor rate keep this in Watch. However, calculation errors erode fundamental trust in banking accuracy and carry media/regulatory risk.',
        },
      ],
      suggestedActions: [
        'Audit interest calculation logic for rounding edge cases',
        'Implement automated reconciliation checks',
        'Proactive customer notification when corrections made',
        'Create transparent interest calculation explainer in app',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Marginal improvement - Interest calculation complaints dropped 15% after we fixed the main rounding issue. However, 54% remain Detractors due to eroded trust. These customers need personalized outreach to restore confidence in our accuracy.',
      },
    },
    'topic-mobile-app': {
      summary:
        'Mobile App Experience is a STRENGTH with NPS +32 (48% Promoters) and 167 positive mentions. This is our highest-performing digital touchpoint - the recent v4.2.1 update with dark mode drove NPS up 15 points.',
      confidence: 'high',
      keyDrivers: [
        'Dark mode launch drove +15 NPS improvement',
        '48% Promoter rate highest among all topics',
        'Biometric login satisfaction: 4.6/5 stars',
        'App Store rating: 4.4 stars (up from 4.1)',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Mobile App Experience is a Strength. Let me understand what is driving the positive NPS.',
          action: 'Analyse App Satisfaction Drivers',
          observation:
            'NPS +32 with 48% Promoters. Dark mode drove +15 NPS improvement. Biometric login satisfaction: 4.6/5 stars. App Store rating: 4.4 stars (up from 4.1).',
        },
        {
          step: 2,
          thought:
            'Let me check if there are any negative signals that could undermine this strength.',
          action: 'Check Detractor Drivers',
          observation:
            'Payee migration bug affected 8% of users. Navigation changes generated 15% increase in support calls. These are addressable issues that could push NPS above +40.',
        },
      ],
      suggestedActions: [
        'Feature dark mode success in marketing campaigns',
        'Survey Promoters for next feature priorities',
        'Address remaining payee migration issues (8% affected)',
        'Consider app-exclusive benefits to drive adoption',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Yes! Mobile App is our strongest CX asset with NPS +32 and 48% Promoters. The v4.2.1 update drove a 15-point NPS improvement. However, 8% of users experienced payee migration issues - addressing this could push NPS above +40.',
      },
    },
    'topic-branch-service': {
      summary:
        'Branch Service Quality is a STRENGTH with NPS +42 (55% Promoters) and 134 positive mentions. This is our highest NPS topic - in-person service continues to differentiate us from digital-only competitors.',
      confidence: 'high',
      keyDrivers: [
        '55% Promoter rate - highest across all topics',
        'Average wait time: 4.2 minutes (target: <5 minutes)',
        'Staff knowledge satisfaction: 4.7/5 stars',
        'Problem resolution rate: 78% first-visit resolution',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Branch Service Quality is our highest NPS topic. Let me understand what makes it successful.',
          action: 'Analyse Branch Performance',
          observation:
            'NPS +42 with 55% Promoters - highest across all topics. Average wait time: 4.2 minutes (target: <5). Staff knowledge satisfaction: 4.7/5. 78% first-visit resolution rate.',
        },
        {
          step: 2,
          thought:
            'Let me check if this is event-driven or consistent operational excellence.',
          action: 'Analyse Temporal Stability',
          observation:
            'Stable positive NPS without event correlation. This is consistent operational excellence - human touchpoint differentiating us from digital-only competitors.',
        },
      ],
      suggestedActions: [
        'Document and share best practices from top-performing branches',
        'Recognize high-performing staff to maintain morale',
        'Consider branch-digital hybrid service model',
        'Survey Promoters for testimonials and case studies',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Yes - Branch Service is our CX crown jewel with NPS +42, the highest of any topic. 55% Promoters and 78% first-visit resolution demonstrate operational excellence. This human touchpoint differentiates us from digital-only competitors.',
      },
    },
    'topic-rewards-program': {
      summary:
        'Rewards Program sits in the NOISE quadrant with NPS +25 (42% Promoters) and 45 mentions. Positive but low-volume - indicates satisfied but not passionate customers. Opportunity to amplify this strength.',
      confidence: 'medium',
      keyDrivers: [
        '42% Promoter rate indicates satisfaction',
        'Low volume suggests low awareness or engagement',
        'Cashback redemption rate: 68% (32% unredeemed)',
        'Competitor rewards programs cited in 22% of neutral feedback',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Rewards Program is in the Noise quadrant - positive but low volume. Let me understand the engagement gap.',
          action: 'Analyse Rewards Engagement',
          observation:
            'NPS +25 with 42% Promoters. Low volume (45 mentions) suggests low awareness. Cashback redemption rate: 68% (32% unredeemed). Competitor rewards programs cited in 22% of neutral feedback.',
        },
      ],
      suggestedActions: [
        'Increase rewards program awareness through in-app prompts',
        'Simplify redemption process to improve 68% redemption rate',
        'Consider rewards program refresh to match competitor offers',
        'Target Passives with enhanced rewards tier offer',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Neutral - Rewards Program has positive NPS (+25) but low engagement. The 32% unredeemed cashback suggests customers may not fully understand or value the program. Opportunity to amplify this from Noise to Strength through better awareness.',
      },
    },
    'topic-online-statements': {
      summary:
        'Online Statement Access is in the NOISE quadrant with NPS +28 (45% Promoters) and 29 mentions. Basic utility feature performing well - customers expect it to work and notice when it does not.',
      confidence: 'medium',
      keyDrivers: [
        '45% Promoter rate for core utility feature',
        'PDF download success rate: 99.2%',
        'Average page load time: 1.8 seconds',
        'Low volume indicates feature meets expectations',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Online Statement Access is in the Noise quadrant. Let me assess its performance as a utility feature.',
          action: 'Query Statement Access Metrics',
          observation:
            'NPS +28 with 45% Promoters. PDF download success rate: 99.2%. Average page load: 1.8 seconds. Low volume (29 mentions) - customers expect it to work and notice when it does not.',
        },
      ],
      suggestedActions: [
        'Maintain current performance levels',
        'Consider statement customization features',
        'Add carbon footprint savings badge for paperless customers',
        'Monitor for any degradation that could shift to Watch',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Maintained - Online Statement Access meets expectations with NPS +28. This is a utility feature where customers expect reliability. The 99.2% success rate and 1.8s load time are performing well. Focus is on maintaining this baseline.',
      },
    },
    'topic-communication': {
      summary:
        'Communication issues span multiple channels with NPS -15 (38% Detractors). Customers cite unclear messaging, delayed notifications, and inconsistent information across channels as primary concerns.',
      confidence: 'medium',
      keyDrivers: [
        '38% Detractor rate driven by delayed or missing notifications',
        'SMS delivery rate: 94% (below 99% target)',
        'Email open rate: 18% (industry avg: 22%)',
        'Inconsistent messaging across app, email, and SMS',
      ],
      evidence: [],
      reasoningSteps: [
        {
          step: 1,
          thought:
            'Communication issues span multiple channels. Let me identify the key failure points.',
          action: 'Analyse Communication Metrics',
          observation:
            'NPS -15 with 38% Detractors. SMS delivery rate: 94% (below 99% target). Email open rate: 18% (industry avg: 22%). Inconsistent messaging across app, email, and SMS.',
        },
        {
          step: 2,
          thought:
            'Let me check when communication complaints spike to understand timing issues.',
          action: 'Analyse Complaint Timing',
          observation:
            'Communication complaints spike 24-48 hours after major account events (payments, statement generation). Pattern suggests notification timing and clarity issues rather than system failures.',
        },
      ],
      suggestedActions: [
        'Audit notification templates for clarity and consistency',
        'Implement real-time delivery confirmation tracking',
        'Add customer preference center for communication channels',
        'A/B test message timing for optimal engagement',
      ],
      suggestedFollowUp: {
        question: 'Did we improve the customer experience?',
        answer:
          'Partially - Communication improvements are needed. NPS -15 indicates customers are frustrated with notification quality and timing. The 94% SMS delivery rate needs attention. Recommend prioritizing notification reliability before expanding channel options.',
      },
    },
  };

  // Data access methods - now use API with fallback to mock
  getTimelineEvents(
    filters?: Partial<FilterState>,
  ): Observable<TimelineEvent[]> {
    if (this.useApi) {
      return this.apiService.getTimelineEvents(filters);
    }
    return of(this.events).pipe(delay(100));
  }

  getSentimentBubbles(
    filters?: Partial<FilterState>,
  ): Observable<SentimentBubble[]> {
    if (this.useApi) {
      return this.apiService.getSentimentBubbles(filters);
    }
    return of(this.generateBubbles()).pipe(delay(150));
  }

  getJourneyStages(
    context?: AnalysisContext,
    filters?: Partial<FilterState>,
  ): Observable<JourneyStage[]> {
    if (this.useApi) {
      // For journey stages, we want the full date range (not a single-day
      // bubble window) so there is enough survey data to populate the chart.
      // We keep the product from context so the journey is product-specific.
      const effectiveFilters = this.mergeContextForJourney(context, filters);
      const requestedProduct = effectiveFilters.product;
      const isProductSpecific =
        !!requestedProduct && requestedProduct !== 'all';

      return this.apiService.getJourneyStages(effectiveFilters).pipe(
        switchMap((stages) => {
          const totalResponses = stages.reduce(
            (sum, st) => sum + st.communications,
            0,
          );

          // If a product filter was applied but there aren't enough survey
          // responses to produce a meaningful waterfall, retry without the
          // product filter so the chart isn't blank.
          if (isProductSpecific && totalResponses < MIN_JOURNEY_RESPONSES) {
            const fallbackFilters = { ...effectiveFilters };
            delete fallbackFilters.product;
            this.journeyFallbackProduct.set(requestedProduct!);
            return this.apiService.getJourneyStages(fallbackFilters);
          }

          // Product-specific data was sufficient (or no product was set)
          this.journeyFallbackProduct.set(null);
          return of(stages);
        }),
        map((stages) => this.applyContextToStages(stages, context)),
      );
    }
    this.journeyFallbackProduct.set(null);
    const stages = this.generateJourneyForContext(context);
    return of(stages).pipe(delay(100));
  }

  /**
   * Merge context parameters into filters for API calls.
   * Context parameters (from clicked bubble/event) override global filter values.
   */
  private mergeContextIntoFilters(
    context?: AnalysisContext,
    filters?: Partial<FilterState>,
  ): Partial<FilterState> {
    const merged: Partial<FilterState> = { ...filters };

    // If context has a timeWindow (from clicked bubble/event), use it instead of global date range
    if (context?.timeWindow) {
      merged.dateRangeObj = {
        start: context.timeWindow.start,
        end: context.timeWindow.end,
      };
    }

    // If context has a product, use it instead of global product filter
    if (context?.product) {
      merged.product = context.product;
    }

    // If context has a channel, use it instead of global channel filter
    if (context?.channel) {
      merged.channel = context.channel;
    }

    return merged;
  }

  /**
   * Build filters for journey stages API.
   * Unlike other charts, journey stages keep the global date range so the
   * survey scope matches what the user sees in the timeline. When a bubble
   * is clicked the context carries a single-day time window, but we ignore
   * it and keep the wider global range from filters. We do pick up the
   * bubble's product so the journey chart is product-specific.
   */
  private mergeContextForJourney(
    context?: AnalysisContext,
    filters?: Partial<FilterState>,
  ): Partial<FilterState> {
    const merged: Partial<FilterState> = { ...filters };

    // Use product from context (clicked bubble / event) but keep global
    // date range from the dashboard filters — do NOT narrow to the 1-day
    // bubble window and do NOT drop the date range entirely.
    if (context?.product && context.product !== 'all') {
      merged.product = context.product;
    }

    return merged;
  }

  private applyContextToStages(
    stages: JourneyStage[],
    context?: AnalysisContext,
  ): JourneyStage[] {
    // If no context or API returned data, use as-is
    // Otherwise apply context-aware transformations
    if (!context || (!context.event && !context.quadrant)) {
      return stages;
    }
    // For specific contexts, we can modify the API response
    // For now, return as-is since API handles context
    return stages;
  }

  private generateJourneyForContext(context?: AnalysisContext): JourneyStage[] {
    // Helper to add NPS fields to a journey stage based on sentiment
    const addNPS = (
      stage: Omit<
        JourneyStage,
        'npsScore' | 'promoterPct' | 'passivePct' | 'detractorPct'
      >,
    ): JourneyStage => {
      const nps = this.sentimentToNPS(stage.sentiment);
      return { ...stage, ...nps } as JourneyStage;
    };

    // Default/average journey
    if (
      !context ||
      (!context.event &&
        !context.timeWindow &&
        !context.quadrant &&
        !context.product)
    ) {
      return this.journeyStages;
    }

    // Outage-related journey - DRAMATIC: steep drop, very slow recovery, ends negative
    if (
      context.event?.type === 'outage' ||
      context.signal?.toLowerCase().includes('outage') ||
      context.signal?.toLowerCase().includes('payment')
    ) {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.85,
          previousSentiment: 0,
          change: -0.85,
          communications: 1847,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.82,
          previousSentiment: -0.85,
          change: 0.03,
          communications: 1756,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.68,
          previousSentiment: -0.82,
          change: 0.14,
          communications: 1423,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: -0.35,
          previousSentiment: -0.68,
          change: 0.33,
          communications: 1198,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: -0.12,
          previousSentiment: -0.35,
          change: 0.23,
          communications: 834,
        }),
      ];
    }

    // Fee-related journey - frustrating: gets worse before better, ends still negative
    if (
      context.event?.type === 'announcement' ||
      context.signal?.toLowerCase().includes('fee') ||
      context.signal?.toLowerCase().includes('overdraft')
    ) {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.62,
          previousSentiment: 0,
          change: -0.62,
          communications: 723,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.71,
          previousSentiment: -0.62,
          change: -0.09,
          communications: 698,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.65,
          previousSentiment: -0.71,
          change: 0.06,
          communications: 612,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: -0.42,
          previousSentiment: -0.65,
          change: 0.23,
          communications: 534,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: -0.28,
          previousSentiment: -0.42,
          change: 0.14,
          communications: 389,
        }),
      ];
    }

    // Product launch - POSITIVE: starts better, ends very positive
    if (
      context.event?.type === 'launch' ||
      context.signal?.toLowerCase().includes('launch') ||
      context.signal?.toLowerCase().includes('app')
    ) {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.25,
          previousSentiment: 0,
          change: -0.25,
          communications: 234,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.18,
          previousSentiment: -0.25,
          change: 0.07,
          communications: 212,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: 0.05,
          previousSentiment: -0.18,
          change: 0.23,
          communications: 187,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: 0.32,
          previousSentiment: 0.05,
          change: 0.27,
          communications: 156,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: 0.48,
          previousSentiment: 0.32,
          change: 0.16,
          communications: 98,
        }),
      ];
    }

    // Card product journey - moderate issues, good resolution
    if (context.product === 'cards' || context.event?.product === 'cards') {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.58,
          previousSentiment: 0,
          change: -0.58,
          communications: 567,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.52,
          previousSentiment: -0.58,
          change: 0.06,
          communications: 534,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.28,
          previousSentiment: -0.52,
          change: 0.24,
          communications: 456,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: 0.12,
          previousSentiment: -0.28,
          change: 0.4,
          communications: 378,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: 0.35,
          previousSentiment: 0.12,
          change: 0.23,
          communications: 245,
        }),
      ];
    }

    // Time window selection - varies based on date/position (simulate different periods)
    if (context.timeWindow) {
      // Make it noticeably different: volatile journey with ups and downs
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.48,
          previousSentiment: 0,
          change: -0.48,
          communications: 312,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.62,
          previousSentiment: -0.48,
          change: -0.14,
          communications: 289,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.45,
          previousSentiment: -0.62,
          change: 0.17,
          communications: 256,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: -0.08,
          previousSentiment: -0.45,
          change: 0.37,
          communications: 198,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: 0.22,
          previousSentiment: -0.08,
          change: 0.3,
          communications: 134,
        }),
      ];
    }

    // Critical quadrant - BAD: worst journey, barely recovers
    if (context.quadrant === 'critical') {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.78,
          previousSentiment: 0,
          change: -0.78,
          communications: 1234,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.75,
          previousSentiment: -0.78,
          change: 0.03,
          communications: 1189,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.58,
          previousSentiment: -0.75,
          change: 0.17,
          communications: 987,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: -0.25,
          previousSentiment: -0.58,
          change: 0.33,
          communications: 812,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: -0.05,
          previousSentiment: -0.25,
          change: 0.2,
          communications: 567,
        }),
      ];
    }

    // Strength quadrant - BEST: good journey, very positive outcome
    if (context.quadrant === 'strength') {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.22,
          previousSentiment: 0,
          change: -0.22,
          communications: 189,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.15,
          previousSentiment: -0.22,
          change: 0.07,
          communications: 176,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: 0.08,
          previousSentiment: -0.15,
          change: 0.23,
          communications: 145,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: 0.38,
          previousSentiment: 0.08,
          change: 0.3,
          communications: 112,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: 0.52,
          previousSentiment: 0.38,
          change: 0.14,
          communications: 78,
        }),
      ];
    }

    // Watch quadrant - concerning: slow improvement
    if (context.quadrant === 'watch') {
      return [
        addNPS({
          stage: 'initial-contact',
          label: 'Initial Contact',
          sentiment: -0.65,
          previousSentiment: 0,
          change: -0.65,
          communications: 234,
        }),
        addNPS({
          stage: 'triage',
          label: 'Triage',
          sentiment: -0.68,
          previousSentiment: -0.65,
          change: -0.03,
          communications: 223,
        }),
        addNPS({
          stage: 'investigation',
          label: 'Investigation',
          sentiment: -0.55,
          previousSentiment: -0.68,
          change: 0.13,
          communications: 198,
        }),
        addNPS({
          stage: 'resolution',
          label: 'Resolution',
          sentiment: -0.32,
          previousSentiment: -0.55,
          change: 0.23,
          communications: 167,
        }),
        addNPS({
          stage: 'post-resolution',
          label: 'Post-Resolution',
          sentiment: -0.08,
          previousSentiment: -0.32,
          change: 0.24,
          communications: 112,
        }),
      ];
    }

    // Default fallback
    return this.journeyStages;
  }

  getQuadrantItems(filters?: FilterState): Observable<QuadrantItem[]> {
    if (this.useApi) {
      return this.apiService
        .getQuadrantItems(filters)
        .pipe(
          catchError(() => of(this.generateQuadrantItems()).pipe(delay(100))),
        );
    }
    return of(this.generateQuadrantItems()).pipe(delay(100));
  }

  getEvidence(context?: AnalysisContext): Observable<EvidenceItem[]> {
    let filtered = [...this.evidence];

    // If an event is selected, prioritize evidence linked to that event
    if (context?.event) {
      filtered = this.evidence.filter(
        (e) =>
          e.linkedChartId === context.event!.id ||
          Math.abs(e.timestamp.getTime() - context.event!.date.getTime()) <
            2 * 24 * 60 * 60 * 1000,
      );
    }
    // If selection includes highlighted IDs (bubble clicks), match by linkedChartId
    else if (context?.selectedItems && context.selectedItems.length > 0) {
      const matchedByLink = this.evidence.filter(
        (e) =>
          e.linkedChartId && context.selectedItems!.includes(e.linkedChartId),
      );
      if (matchedByLink.length > 0) {
        filtered = matchedByLink;
      }
    }
    // Time window filter - expand to 3 days if narrow window yields no results
    else if (context?.timeWindow) {
      filtered = this.evidence.filter(
        (e) =>
          e.timestamp >= context.timeWindow!.start &&
          e.timestamp <= context.timeWindow!.end,
      );

      // If narrow time window found nothing, expand to ±3 days
      if (filtered.length === 0) {
        const midpoint = new Date(
          (context.timeWindow.start.getTime() +
            context.timeWindow.end.getTime()) /
            2,
        );
        const expandedStart = new Date(
          midpoint.getTime() - 3 * 24 * 60 * 60 * 1000,
        );
        const expandedEnd = new Date(
          midpoint.getTime() + 3 * 24 * 60 * 60 * 1000,
        );
        filtered = this.evidence.filter(
          (e) => e.timestamp >= expandedStart && e.timestamp <= expandedEnd,
        );
      }
    }

    // If still no evidence, return all (for demo purposes)
    if (filtered.length === 0) {
      filtered = [...this.evidence];
    }

    return of(filtered.slice(0, 6)).pipe(delay(200));
  }

  getInsight(context: AnalysisContext): Observable<ResearchInsight> {
    // Try API first, fall back to mock data if unavailable
    return this.apiService.getInsight(context).pipe(
      map((insight) => {
        // API may return without reasoningSteps - enrich from mock data
        if (!insight.reasoningSteps?.length) {
          const mockInsight = this.getMockInsightSync(context);
          if (mockInsight?.reasoningSteps?.length) {
            insight.reasoningSteps = mockInsight.reasoningSteps;
          }
        }
        return insight;
      }),
      catchError((err) => {
        console.warn('API insight unavailable, using mock data:', err.message);
        return this.getInsightFromMockData(context);
      }),
    );
  }

  /**
   * Ask a follow-up question with the current context - uses LLM with real data
   */
  askFollowUpQuestion(
    context: AnalysisContext,
    question: string,
  ): Observable<ResearchInsight> {
    return this.apiService.askFollowUpQuestion(context, question);
  }

  private getInsightFromMockData(
    context: AnalysisContext,
  ): Observable<ResearchInsight> {
    let insight = this.getMockInsightSync(context);

    // Properly attach evidence using switchMap
    return this.getEvidence(context).pipe(
      delay(300),
      map((evidence) => {
        insight.evidence = evidence;
        return insight;
      }),
    );
  }

  /**
   * Synchronously resolve the mock insight for a given context.
   * Used both for full mock fallback and to enrich API responses with reasoning steps.
   */
  private getMockInsightSync(context: AnalysisContext): ResearchInsight {
    // BUBBLE-SPECIFIC INSIGHTS - Generate contextual analysis when a bubble is selected
    if (context.selectedBubble) {
      return this.generateBubbleInsight(context.selectedBubble);
    }
    // Route to appropriate insight based on event type or context
    if (
      context.event?.type === 'outage' ||
      context.signal?.toLowerCase().includes('outage')
    ) {
      return { ...this.insights['payments-outage'] };
    }
    if (
      context.event?.type === 'resolution' ||
      context.signal?.toLowerCase().includes('resolved')
    ) {
      return { ...this.insights['outage-resolved'] };
    }
    if (
      context.event?.type === 'launch' ||
      context.signal?.toLowerCase().includes('premium card launch')
    ) {
      return { ...this.insights['card-launch'] };
    }
    if (
      context.event?.type === 'issue' ||
      context.signal?.toLowerCase().includes('mobile app update')
    ) {
      return { ...this.insights['app-update'] };
    }
    if (
      context.event?.type === 'announcement' ||
      context.signal?.toLowerCase().includes('fee change')
    ) {
      return { ...this.insights['fee-changes'] };
    }
    // Topic insights for quadrant items - match both old format and category labels from ES
    if (
      context.signal?.toLowerCase().includes('payment processing') ||
      context.signal?.toLowerCase().includes('payment issue')
    ) {
      return { ...this.insights['topic-payment-processing'] };
    }
    if (
      context.signal?.toLowerCase().includes('overdraft fee') ||
      context.signal?.toLowerCase().includes('fee dispute')
    ) {
      return { ...this.insights['topic-overdraft-fees'] };
    }
    if (context.signal?.toLowerCase().includes('card declined')) {
      return { ...this.insights['topic-card-declined'] };
    }
    if (
      context.signal?.toLowerCase().includes('fraud alert') ||
      context.signal?.toLowerCase().includes('fraud & security') ||
      context.signal?.toLowerCase().includes('fraud')
    ) {
      return { ...this.insights['topic-fraud-alerts'] };
    }
    if (context.signal?.toLowerCase().includes('loan application')) {
      return { ...this.insights['topic-loan-applications'] };
    }
    if (context.signal?.toLowerCase().includes('interest calculation')) {
      return { ...this.insights['topic-interest-calculation'] };
    }
    if (
      context.signal?.toLowerCase().includes('mobile app experience') ||
      context.signal?.toLowerCase().includes('technical problem')
    ) {
      return { ...this.insights['topic-mobile-app'] };
    }
    if (
      context.signal?.toLowerCase().includes('branch service') ||
      context.signal?.toLowerCase().includes('service quality')
    ) {
      return { ...this.insights['topic-branch-service'] };
    }
    if (
      context.signal?.toLowerCase().includes('rewards program') ||
      context.signal?.toLowerCase().includes('product feature')
    ) {
      return { ...this.insights['topic-rewards-program'] };
    }
    if (
      context.signal?.toLowerCase().includes('online statement') ||
      context.signal?.toLowerCase().includes('account access')
    ) {
      return { ...this.insights['topic-online-statements'] };
    }
    if (context.signal?.toLowerCase().includes('communication')) {
      return { ...this.insights['topic-communication'] };
    }
    return { ...this.insights['default'] };
  }

  /**
   * Generate bubble-specific insight based on the bubble's data and how it compares
   * to the overall dataset. This provides contextual analysis matching the tooltip insights.
   */
  private generateBubbleInsight(bubble: SentimentBubble): ResearchInsight {
    const allBubbles = this.generateBubbles();
    const bubbleIndex = allBubbles.findIndex((b) => b.id === bubble.id);

    // Calculate statistics
    const avgNps =
      allBubbles.reduce((sum, b) => sum + b.npsScore, 0) / allBubbles.length;
    const avgVolume =
      allBubbles.reduce((sum, b) => sum + b.volume, 0) / allBubbles.length;
    const maxNps = Math.max(...allBubbles.map((b) => b.npsScore));
    const minNps = Math.min(...allBubbles.map((b) => b.npsScore));

    // Standard deviation for outlier detection (>1.5σ from mean)
    const npsStdDev = Math.sqrt(
      allBubbles.reduce((sum, b) => sum + (b.npsScore - avgNps) ** 2, 0) /
        allBubbles.length,
    );

    // Trend analysis
    const prevBubble = bubbleIndex > 0 ? allBubbles[bubbleIndex - 1] : null;
    const npsChange = prevBubble ? bubble.npsScore - prevBubble.npsScore : 0;

    // Determine bubble characteristics
    const isPeak = bubble.npsScore === maxNps;
    const isTrough = bubble.npsScore === minNps;
    const isOutlier =
      npsStdDev > 0 &&
      Math.abs(bubble.npsScore - avgNps) > 1.5 * npsStdDev &&
      !isPeak &&
      !isTrough;
    const npsVsAvg = bubble.npsScore - avgNps;
    const volumeRatio = bubble.volume / avgVolume;
    const socialDiff = bubble.socialSentiment - bubble.sentiment;
    const socialLeading =
      socialDiff > 0.1
        ? 'positive'
        : socialDiff < -0.1
          ? 'negative'
          : 'aligned';

    // Format date
    const dateStr = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(bubble.date);

    // Build summary based on characteristics
    let summary = `**${dateStr}** - `;
    if (isPeak) {
      summary += `📈 **PEAK** — This is the highest NPS point in the period at ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}. `;
      summary += `${bubble.promoterPct}% of ${bubble.volume} respondents were Promoters (9-10 scores). `;
      summary += `Key themes: ${bubble.themes.slice(0, 2).join(' and ')}.`;
    } else if (isTrough) {
      summary += `📉 **TROUGH** — This is the lowest NPS point in the period at ${bubble.npsScore}. `;
      summary += `${bubble.detractorPct}% were Detractors (0-6 scores) from ${bubble.volume} responses. `;
      summary += `Primary concerns: ${bubble.themes.slice(0, 2).join(' and ')}.`;
    } else if (isOutlier) {
      const deviation = ((bubble.npsScore - avgNps) / npsStdDev).toFixed(1);
      summary += `⚠️ **OUTLIER** — NPS of ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} is statistically unusual (${deviation}σ from mean of ${avgNps.toFixed(0)}). `;
      summary += `This ${bubble.npsScore > avgNps ? 'outperformance' : 'underperformance'} warrants investigation. `;
      summary += `${bubble.volume} responses across themes: ${bubble.themes.slice(0, 2).join(' and ')}.`;
    } else if (npsVsAvg > 5) {
      summary += `NPS of ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} outperforms the period average (${avgNps.toFixed(0)}) by ${npsVsAvg.toFixed(0)} points. `;
      summary += `Strong Promoter base at ${bubble.promoterPct}% driving positive momentum.`;
    } else if (npsVsAvg < -5) {
      summary += `NPS of ${bubble.npsScore} underperforms the period average (${avgNps.toFixed(0)}) by ${Math.abs(npsVsAvg).toFixed(0)} points. `;
      summary += `Detractor rate at ${bubble.detractorPct}% requires investigation.`;
    } else {
      summary += `NPS of ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} is within typical range for this period. `;
      summary += `${bubble.volume} survey responses with balanced Promoter/Detractor distribution.`;
    }

    // Build key drivers
    const keyDrivers: string[] = [];

    // Outlier alert
    if (isOutlier) {
      const deviation = ((bubble.npsScore - avgNps) / npsStdDev).toFixed(1);
      keyDrivers.push(
        `⚠️ Statistical outlier: NPS is ${deviation}σ from the period mean (${avgNps.toFixed(0)}) — beyond the 1.5σ threshold`,
      );
    }

    // NPS composition insight
    if (bubble.detractorPct > 50) {
      keyDrivers.push(
        `High Detractor concentration (${bubble.detractorPct}%) indicates systemic dissatisfaction`,
      );
    } else if (bubble.promoterPct > 40) {
      keyDrivers.push(
        `Strong Promoter base (${bubble.promoterPct}%) suggests positive customer experience`,
      );
    } else {
      keyDrivers.push(
        `Balanced NPS composition: ${bubble.promoterPct}% Promoters, ${bubble.passivePct}% Passives, ${bubble.detractorPct}% Detractors`,
      );
    }

    // Trend insight
    if (prevBubble) {
      if (npsChange >= 10) {
        keyDrivers.push(
          `Significant improvement of +${npsChange} pts from previous period`,
        );
      } else if (npsChange <= -10) {
        keyDrivers.push(
          `Sharp decline of ${npsChange} pts from previous period - investigate drivers`,
        );
      } else if (npsChange > 0) {
        keyDrivers.push(
          `Gradual improvement of +${npsChange} pts vs previous period`,
        );
      } else if (npsChange < 0) {
        keyDrivers.push(
          `Slight decline of ${npsChange} pts vs previous period`,
        );
      }
    }

    // Social sentiment insight
    if (socialLeading === 'positive') {
      keyDrivers.push(
        `Social sentiment (${bubble.socialSentiment.toFixed(2)}) more positive than survey NPS - customers venting less publicly`,
      );
    } else if (socialLeading === 'negative') {
      keyDrivers.push(
        `Social sentiment (${bubble.socialSentiment.toFixed(2)}) more negative than surveys - public complaints outpacing formal feedback`,
      );
    }

    // Volume insight
    if (volumeRatio > 1.3) {
      keyDrivers.push(
        `High survey volume (${bubble.volume}) suggests significant customer engagement or event-driven activity`,
      );
    } else if (volumeRatio < 0.7) {
      keyDrivers.push(
        `Lower survey volume (${bubble.volume}) - consider if sample size affects reliability`,
      );
    }

    // Theme insight
    keyDrivers.push(`Top themes: ${bubble.themes.slice(0, 3).join(', ')}`);

    // Build reasoning steps for the bubble analysis
    const reasoningSteps = [
      {
        step: 1,
        thought: `I need to analyse the NPS data for ${dateStr} and compare it against the period average.`,
        action: 'Query NPS Metrics',
        observation: `NPS: ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} (${npsVsAvg >= 0 ? '+' : ''}${npsVsAvg.toFixed(0)} vs period average). Promoters: ${bubble.promoterPct}%, Passives: ${bubble.passivePct}%, Detractors: ${bubble.detractorPct}%. Volume: ${bubble.volume} responses.`,
      },
      {
        step: 2,
        thought:
          'Let me check social sentiment alignment and identify any leading indicators.',
        action: 'Analyse Social Alignment',
        observation: `Social sentiment: ${socialLeading === 'aligned' ? 'aligned with surveys' : socialLeading === 'positive' ? 'more positive than surveys' : 'more negative than surveys - potential early warning'}. Key themes: ${bubble.themes.join(', ')}.`,
      },
    ];

    if (prevBubble) {
      reasoningSteps.push({
        step: 3,
        thought:
          'Let me compare with the previous period to identify the trend.',
        action: 'Compare Trend',
        observation: `${npsChange >= 0 ? 'Improvement' : 'Decline'} of ${Math.abs(npsChange)} points from ${prevBubble.npsScore > 0 ? '+' : ''}${prevBubble.npsScore} to ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}.`,
      });
    }

    // Build suggested actions
    const suggestedActions: string[] = [];

    if (bubble.detractorPct > 40) {
      suggestedActions.push(
        `Prioritize Detractor recovery outreach for ${bubble.themes[0] || 'top issues'}`,
      );
    }
    if (npsChange <= -10 && prevBubble) {
      suggestedActions.push(
        'Investigate root cause of NPS decline - compare themes between periods',
      );
    }
    if (socialLeading === 'negative') {
      suggestedActions.push(
        'Monitor social channels for emerging complaints - consider proactive response',
      );
    }
    if (bubble.promoterPct > 40) {
      suggestedActions.push(
        'Leverage Promoter base for testimonials and referral program',
      );
    }
    if (bubble.passivePct > 40) {
      suggestedActions.push(
        'Target Passives with personalized engagement to convert to Promoters',
      );
    }

    // Ensure we have at least 2 actions
    if (suggestedActions.length < 2) {
      suggestedActions.push(
        `Drill into ${bubble.themes[0] || 'top theme'} to understand detailed feedback`,
      );
      suggestedActions.push(
        'Compare this period with previous months for trend validation',
      );
    }

    // Determine confidence based on volume
    const confidence: 'high' | 'medium' | 'low' =
      bubble.volume > avgVolume * 1.2
        ? 'high'
        : bubble.volume > avgVolume * 0.8
          ? 'medium'
          : 'low';

    return {
      summary,
      confidence,
      keyDrivers,
      evidence: [], // Will be populated by getEvidence call
      totalCommunications: bubble.volume, // Use bubble volume as the total
      reasoningSteps,
      suggestedActions,
      suggestedFollowUp: {
        question: `What drove ${bubble.npsScore < avgNps ? 'the lower' : 'the higher'} NPS on ${dateStr}?`,
        answer:
          bubble.npsScore < avgNps
            ? `The NPS of ${bubble.npsScore} was driven primarily by ${bubble.themes[0] || 'service issues'} affecting ${bubble.detractorPct}% of respondents who scored 0-6. ${volumeRatio > 1.2 ? 'High survey volume suggests an event increased feedback rates.' : ''} Focus on addressing ${bubble.themes.slice(0, 2).join(' and ')} to improve Detractor recovery rates.`
            : `The NPS of ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} reflects strong performance in ${bubble.themes[0] || 'key areas'}. ${bubble.promoterPct}% of respondents scored 9-10, indicating high satisfaction. ${socialLeading === 'positive' ? 'Social sentiment aligns positively.' : ''} Consider documenting success factors for replication.`,
      },
    };
  }
}

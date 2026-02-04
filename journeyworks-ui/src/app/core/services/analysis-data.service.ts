import { Injectable, inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class AnalysisDataService {
  // Inject the API service for real data
  private readonly apiService = inject(AnalysisApiService);

  // Flag to use API vs mock data (can be toggled for demos)
  private useApi = true;

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
      timelineReasoning:
        'Social NPS dropped 2-3 days before complaint volume increased, suggesting social monitoring could provide early warning. The sentiment band shows this predictive lead time clearly - watch for social NPS dips as precursors to complaint surges.',
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
      timelineReasoning:
        'Unlike technical issues which show NPS recovery patterns, fee-related complaints show sustained negative NPS. The social sentiment band clearly led formal complaints by ~3 days, suggesting customers vented on social media before filing formal complaints.',
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
      timelineReasoning:
        'Post-resolution, the social sentiment band shows more rapid NPS improvement than formal complaints - customers acknowledged the fix on social media before updating formal feedback. The 3-day lead pattern reversed during recovery.',
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
      timelineReasoning:
        'The social sentiment band shows an initial positive spike (early adopters celebrating approval) followed by decline as rejection notifications went out. The 3-day lead pattern shows social discontent building before formal complaints emerged.',
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
      timelineReasoning:
        'Social NPS spiked positive immediately as tech-savvy users praised new features. The 3-day lead pattern showed negative sentiment building among users who lost payee data, culminating in formal complaints by day 3.',
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
      timelineReasoning:
        'Select a specific event or time period for detailed NPS analysis. Note: The purple-bordered sentiment band shows social chatter NPS that precedes formal complaints.',
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
      timelineReasoning:
        'Payment errors correlate strongly with the January 3rd outage. Post-outage, baseline error rate increased from 0.8% to 2.3%. Social media complaints about payment failures precede formal complaints by 2-3 days.',
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
      timelineReasoning:
        'Fee complaints spiked following the January 22nd announcement. Unlike technical issues which show sentiment recovery, fee-related NPS shows sustained negative trajectory. Social sentiment provides 3-day early warning of formal complaint surges.',
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
      timelineReasoning:
        'Card declined events correlate with payment infrastructure issues. The social sentiment band shows customers immediately tweet about declined cards - this provides real-time signal for infrastructure problems.',
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
      timelineReasoning:
        'Fraud alert delays show no correlation with timeline events - this is a chronic infrastructure issue rather than incident-driven. Low volume keeps it in Watch rather than Critical.',
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
      timelineReasoning:
        'Loan application errors show steady baseline with no event correlation. Issues are chronic rather than incident-driven, keeping this in Watch quadrant.',
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
      timelineReasoning:
        'Interest calculation issues are sporadic with no event correlation. Low volume and moderate Detractor rate keep this in Watch, but regulatory risk warrants attention.',
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
      timelineReasoning:
        'App satisfaction shows strong positive correlation with the January 20th update. The social sentiment band spiked positive immediately as users discovered dark mode and faster biometrics.',
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
      timelineReasoning:
        'Branch service shows stable positive NPS without event correlation - this is consistent operational excellence rather than incident-driven improvement.',
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
      timelineReasoning:
        'Rewards mentions show no event correlation - steady positive baseline. The Premium Card launch on January 15th drove temporary increase in rewards-related mentions.',
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
      timelineReasoning:
        'Online statements show stable baseline with no event correlation. This is a "hygiene factor" - customers expect it to work but do not actively praise it.',
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
      timelineReasoning:
        'Communication complaints spike 24-48 hours after major account events (payments, statement generation). Pattern suggests notification timing and clarity issues rather than system failures.',
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
      // Merge context into filters - context timeWindow/product override global filters
      const effectiveFilters = this.mergeContextIntoFilters(context, filters);
      return this.apiService.getJourneyStages(effectiveFilters).pipe(
        // Apply context-aware modifications on top of API data
        map((stages) => this.applyContextToStages(stages, context)),
      );
    }
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
    // Use API only - no mock fallback for consistent demo data
    return this.apiService.getInsight(context);
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
    let insight: ResearchInsight;

    // BUBBLE-SPECIFIC INSIGHTS - Generate contextual analysis when a bubble is selected
    if (context.selectedBubble) {
      insight = this.generateBubbleInsight(context.selectedBubble);
    }
    // Route to appropriate insight based on event type or context
    else if (
      context.event?.type === 'outage' ||
      context.signal?.toLowerCase().includes('outage')
    ) {
      insight = { ...this.insights['payments-outage'] };
    } else if (
      context.event?.type === 'resolution' ||
      context.signal?.toLowerCase().includes('resolved')
    ) {
      insight = { ...this.insights['outage-resolved'] };
    } else if (
      context.event?.type === 'launch' ||
      context.signal?.toLowerCase().includes('premium card launch')
    ) {
      insight = { ...this.insights['card-launch'] };
    } else if (
      context.event?.type === 'issue' ||
      context.signal?.toLowerCase().includes('mobile app update')
    ) {
      insight = { ...this.insights['app-update'] };
    } else if (
      context.event?.type === 'announcement' ||
      context.signal?.toLowerCase().includes('fee change')
    ) {
      insight = { ...this.insights['fee-changes'] };
    }
    // Topic insights for quadrant items - match both old format and category labels from ES
    else if (
      context.signal?.toLowerCase().includes('payment processing') ||
      context.signal?.toLowerCase().includes('payment issue')
    ) {
      insight = { ...this.insights['topic-payment-processing'] };
    } else if (
      context.signal?.toLowerCase().includes('overdraft fee') ||
      context.signal?.toLowerCase().includes('fee dispute')
    ) {
      insight = { ...this.insights['topic-overdraft-fees'] };
    } else if (context.signal?.toLowerCase().includes('card declined')) {
      insight = { ...this.insights['topic-card-declined'] };
    } else if (
      context.signal?.toLowerCase().includes('fraud alert') ||
      context.signal?.toLowerCase().includes('fraud & security') ||
      context.signal?.toLowerCase().includes('fraud')
    ) {
      insight = { ...this.insights['topic-fraud-alerts'] };
    } else if (context.signal?.toLowerCase().includes('loan application')) {
      insight = { ...this.insights['topic-loan-applications'] };
    } else if (context.signal?.toLowerCase().includes('interest calculation')) {
      insight = { ...this.insights['topic-interest-calculation'] };
    } else if (
      context.signal?.toLowerCase().includes('mobile app experience') ||
      context.signal?.toLowerCase().includes('technical problem')
    ) {
      insight = { ...this.insights['topic-mobile-app'] };
    } else if (
      context.signal?.toLowerCase().includes('branch service') ||
      context.signal?.toLowerCase().includes('service quality')
    ) {
      insight = { ...this.insights['topic-branch-service'] };
    } else if (
      context.signal?.toLowerCase().includes('rewards program') ||
      context.signal?.toLowerCase().includes('product feature')
    ) {
      insight = { ...this.insights['topic-rewards-program'] };
    } else if (
      context.signal?.toLowerCase().includes('online statement') ||
      context.signal?.toLowerCase().includes('account access')
    ) {
      insight = { ...this.insights['topic-online-statements'] };
    } else if (context.signal?.toLowerCase().includes('communication')) {
      insight = { ...this.insights['topic-communication'] };
    } else {
      insight = { ...this.insights['default'] };
    }

    // Generate context-specific timeline reasoning (only override if specific content returned)
    const generatedReasoning = this.generateTimelineReasoning(context);
    if (!generatedReasoning.startsWith('Select a specific')) {
      insight.timelineReasoning = generatedReasoning;
    }

    // Properly attach evidence using switchMap
    return this.getEvidence(context).pipe(
      delay(300),
      map((evidence) => {
        insight.evidence = evidence;
        return insight;
      }),
    );
  }

  private generateTimelineReasoning(context: AnalysisContext): string {
    // Event-specific reasoning
    if (
      context.event?.type === 'outage' ||
      context.signal?.toLowerCase().includes('outage')
    ) {
      return `**Incident Timeline Analysis:**

• **T-3 days**: Social sentiment band shows early decline - customers discussing issues on Twitter/Reddit
• **T-1 day**: Social chatter intensifies, sentiment drops sharply
• **T-0 (14:42)**: Payment gateway failure detected by monitoring systems  
• **T+15 min**: First wave of formal complaints submitted via digital channels
• **T+2 hours**: Peak complaint volume reached (312 complaints/hour)
• **T+36 min**: Services restored after database failover
• **T+72 hours**: Sentiment recovered to pre-incident levels

**Key Pattern:** The social sentiment band (purple-bordered on timeline) led formal complaints by ~3 days. Monitoring this band could enable proactive intervention before complaint volumes surge.`;
    }

    if (
      context.event?.type === 'announcement' ||
      context.signal?.toLowerCase().includes('fee')
    ) {
      return `**Fee Change Impact Timeline:**

• **Pre-announcement**: Baseline sentiment at -0.15 (within normal range)
• **Day 0**: Fee change announced - immediate sentiment drop to -0.52
• **Day 1-3**: Sustained complaint volume, primarily from 5+ year customers
• **Day 7**: Media coverage amplified negative sentiment (-0.68 peak)
• **Day 14**: Complaint volume stabilizing but sentiment remains depressed
• **Day 30+**: Projected recovery to -0.30 (below pre-announcement baseline)

**Key Pattern:** Unlike technical issues, fee-related sentiment shows no "resolution bounce". Customer trust degradation creates a persistent negative sentiment band.`;
    }

    // Resolution event
    if (
      context.event?.type === 'resolution' ||
      context.signal?.toLowerCase().includes('resolved')
    ) {
      return `**Post-Resolution Recovery Timeline:**

• **T+0**: Services restored - social media acknowledges fix immediately
• **T+4 hours**: NPS begins recovering, social NPS leads by showing +15 point improvement
• **T+24 hours**: Formal complaint volume drops 60%, NPS at -42 (up from -58)
• **T+48 hours**: Compensation requests peak (35% of affected customers)
• **T+7 days**: NPS stabilizes at -32, Detractor rate drops from 74% to 55%
• **T+14 days**: Only 18% of Detractors converted to Passives or Promoters

**Key Pattern:** Social sentiment leads recovery by ~12 hours. Proactive compensation outreach accelerates Detractor-to-Passive conversion by 40%.`;
    }

    // Card launch
    if (
      context.event?.type === 'launch' ||
      context.signal?.toLowerCase().includes('launch') ||
      context.signal?.toLowerCase().includes('premium') ||
      context.signal?.toLowerCase().includes('card')
    ) {
      return `**Premium Card Launch Timeline:**

• **Pre-launch**: Social buzz positive (NPS +25 among engaged followers)
• **Day 0 AM**: Launch - early adopters celebrate approvals (NPS +32)
• **Day 0 PM**: First rejection notifications sent
• **Day 1-2**: Rejected applicant complaints surge, NPS drops to -15
• **Day 3**: Social sentiment stabilizes, formal complaints plateau
• **Day 7**: Overall NPS settles at +8 (mixed: approved +32, rejected -45)

**Key Pattern:** Two distinct customer cohorts with opposite NPS trajectories. The 3-day social lead shows rejection frustration building on Twitter before formal complaints.`;
    }

    // App update
    if (
      context.event?.type === 'issue' ||
      context.signal?.toLowerCase().includes('app') ||
      context.signal?.toLowerCase().includes('update')
    ) {
      return `**App Update (v4.2.1) Impact Timeline:**

• **T+0**: Update released - immediate positive social response (dark mode!)
• **T+2 hours**: Tech reviewers praise biometric improvements (NPS +38)
• **T+4 hours**: First payee data loss reports surface on social media
• **T+12 hours**: Payee bug becomes trending complaint topic
• **T+24 hours**: Formal complaints peak, affected users NPS -28
• **T+48 hours**: Bug acknowledged, workaround published

**Key Pattern:** Positive features masked emerging bug in aggregate NPS. Social monitoring detected payee issue 12+ hours before complaint surge - segmented NPS tracking by feature would catch this earlier.`;
    }

    // Time window reasoning
    if (context.timeWindow) {
      const start = context.timeWindow.start.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      const end = context.timeWindow.end.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      return `**Selected Period Analysis (${start} – ${end}):**

• **Volume Pattern**: Peak activity observed mid-week (Tuesday-Thursday)
• **Sentiment Trend**: Gradual improvement through period (+0.12 change)
• **Channel Mix**: 45% complaint portal, 32% social, 18% phone, 5% email
• **Resolution Rate**: 67% resolved within SLA (target: 72%)

**Anomaly Detected**: Unusual spike in card-related complaints on Tuesday correlates with batch processing delay identified at 14:30.

**Comparison**: Volume is 13% higher than same period last month, primarily driven by new product issues.`;
    }

    // Quadrant-specific reasoning
    if (context.quadrant === 'critical') {
      return `**Critical Quadrant Pattern Analysis:**

• **Common Thread**: Top 3 issues share backend system dependencies
• **Escalation Rate**: 34% of critical issues escalate beyond first contact
• **Time to Resolution**: Average 4.2 days (vs 2.1 days for other quadrants)
• **Repeat Rate**: 23% of customers had prior critical issues in past 90 days

**Root Cause Mapping**:
- Payment Processing Errors → Core banking integration
- Overdraft Fee Disputes → Policy/system mismatch
- Card Declined → Real-time authorization timeout

**Recommendation**: System architecture review for shared dependencies.`;
    }

    if (context.quadrant === 'strength') {
      return `**Strength Quadrant Success Factors:**

• **First Contact Resolution**: 78% (vs 45% in Critical quadrant)
• **Agent Empowerment**: Higher decision authority correlates with satisfaction
• **Digital Self-Service**: 45% resolved via app without human intervention
• **Proactive Communication**: Status updates every 24 hours

**Why These Work**:
- Mobile app issues have clear troubleshooting flows
- Branch service benefits from face-to-face relationship building
- Rewards inquiries have well-defined eligibility rules

**Replication Opportunity**: Apply branch service training patterns to call center.`;
    }

    if (context.quadrant === 'watch') {
      return `**Watch Quadrant Early Warning Analysis:**

• **Volume Trend**: +15% growth in past 30 days (approaching critical threshold)
• **Sentiment Trajectory**: Declining (-0.05/week)
• **Risk Assessment**: 2 of 3 issues likely to migrate to Critical within 60 days

**Emerging Patterns**:
- Fraud Alert Delays correlate with new security implementation
- Loan Application Errors increasing with online channel usage
- Interest Calculation issues spike at statement generation time

**Intervention Window**: Addressing root causes now prevents escalation.`;
    }

    // Journey stage reasoning
    if (context.journeyStage) {
      const stage = context.journeyStage.label;
      return `**${stage} Stage Deep Dive:**

• **Current Performance**: ${context.journeyStage.sentiment > 0 ? 'Positive' : 'Negative'} sentiment (${context.journeyStage.sentiment.toFixed(2)})
• **Volume at Stage**: ${context.journeyStage.communications} communications
• **Drop-off Rate**: 12% of cases stall at this stage

**Bottleneck Analysis**:
- Handoff friction between departments
- System lookup delays averaging 4 minutes
- Agent knowledge gaps for edge cases

**Quick Wins**: Pre-populated templates could reduce handling time by 25%.`;
    }

    // Default reasoning
    return 'Select a specific event, time range, or quadrant to see detailed timeline reasoning and pattern analysis.';
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

    // Trend analysis
    const prevBubble = bubbleIndex > 0 ? allBubbles[bubbleIndex - 1] : null;
    const npsChange = prevBubble ? bubble.npsScore - prevBubble.npsScore : 0;

    // Determine bubble characteristics
    const isPeak = bubble.npsScore === maxNps;
    const isTrough = bubble.npsScore === minNps;
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
      summary += `This is the highest NPS point in the period at ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}. `;
      summary += `${bubble.promoterPct}% of ${bubble.volume} respondents were Promoters (9-10 scores). `;
      summary += `Key themes: ${bubble.themes.slice(0, 2).join(' and ')}.`;
    } else if (isTrough) {
      summary += `This is the lowest NPS point in the period at ${bubble.npsScore}. `;
      summary += `${bubble.detractorPct}% were Detractors (0-6 scores) from ${bubble.volume} responses. `;
      summary += `Primary concerns: ${bubble.themes.slice(0, 2).join(' and ')}.`;
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

    // Build timeline reasoning
    let timelineReasoning = `**Period Analysis for ${dateStr}:**\n\n`;
    timelineReasoning += `• **NPS Performance:** ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore} (${npsVsAvg >= 0 ? '+' : ''}${npsVsAvg.toFixed(0)} vs period average)\n`;
    timelineReasoning += `• **Survey Volume:** ${bubble.volume} responses (${volumeRatio > 1.1 ? 'above' : volumeRatio < 0.9 ? 'below' : 'at'} typical)\n`;
    timelineReasoning += `• **Promoters:** ${bubble.promoterPct}% ▲ | **Passives:** ${bubble.passivePct}% ● | **Detractors:** ${bubble.detractorPct}% ▼\n`;
    timelineReasoning += `• **Social Alignment:** ${socialLeading === 'aligned' ? 'Social and survey sentiment aligned' : socialLeading === 'positive' ? 'Social more positive than surveys' : 'Social more negative than surveys'}\n\n`;

    if (prevBubble) {
      timelineReasoning += `**Trend:** ${npsChange >= 0 ? 'Improvement' : 'Decline'} of ${Math.abs(npsChange)} points from ${prevBubble.npsScore > 0 ? '+' : ''}${prevBubble.npsScore} to ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}.\n\n`;
    }

    timelineReasoning += `**Key Themes:** ${bubble.themes.join(', ')}`;

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
      timelineReasoning,
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

/**
 * Analysis API Service
 *
 * Provides API integration for analysis dashboard data.
 * Calls backend endpoints and falls back to mock data on error.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  TimelineEvent,
  SentimentBubble,
  JourneyStage,
  QuadrantItem,
  ResearchInsight,
  AnalysisContext,
  FilterState,
} from '../models/analysis.model';

@Injectable({
  providedIn: 'root',
})
export class AnalysisApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/analysis`;
  private readonly researchUrl = `${environment.apiUrl}/research`;

  /**
   * Get timeline events from API
   */
  getTimelineEvents(
    filters?: Partial<FilterState>,
  ): Observable<TimelineEvent[]> {
    let params = new HttpParams();

    if (filters?.dateRangeObj?.start) {
      params = params.set(
        'startDate',
        filters.dateRangeObj.start.toISOString(),
      );
    }
    if (filters?.dateRangeObj?.end) {
      params = params.set('endDate', filters.dateRangeObj.end.toISOString());
    }
    if (filters?.product && filters.product !== 'all') {
      params = params.set('product', filters.product);
    }

    return this.http
      .get<TimelineEvent[]>(`${this.baseUrl}/timeline/events`, { params })
      .pipe(
        map((events) =>
          events.map((e) => ({
            ...e,
            date: new Date(e.date),
          })),
        ),
        catchError((err) => {
          console.warn('API unavailable, using mock timeline events', err);
          return of(this.getMockEvents());
        }),
      );
  }

  /**
   * Get sentiment bubbles from API
   */
  getSentimentBubbles(
    filters?: Partial<FilterState>,
  ): Observable<SentimentBubble[]> {
    let params = new HttpParams();

    if (filters?.dateRangeObj?.start) {
      params = params.set(
        'startDate',
        filters.dateRangeObj.start.toISOString(),
      );
    }
    if (filters?.dateRangeObj?.end) {
      params = params.set('endDate', filters.dateRangeObj.end.toISOString());
    }
    if (filters?.product && filters.product !== 'all') {
      params = params.set('product', filters.product);
    }
    if (filters?.channel && filters.channel !== 'all') {
      params = params.set('channel', filters.channel);
    }

    return this.http
      .get<SentimentBubble[]>(`${this.baseUrl}/timeline/bubbles`, { params })
      .pipe(
        map((bubbles) =>
          bubbles.map((b) => ({
            ...b,
            date: new Date(b.date),
          })),
        ),
        catchError((err) => {
          console.warn('API unavailable, using mock bubbles', err);
          return of(this.getMockBubbles());
        }),
      );
  }

  /**
   * Get journey stages from API
   */
  getJourneyStages(filters?: Partial<FilterState>): Observable<JourneyStage[]> {
    let params = new HttpParams();

    if (filters?.dateRangeObj?.start) {
      params = params.set(
        'startDate',
        filters.dateRangeObj.start.toISOString(),
      );
    }
    if (filters?.dateRangeObj?.end) {
      params = params.set('endDate', filters.dateRangeObj.end.toISOString());
    }
    if (filters?.product && filters.product !== 'all') {
      params = params.set('product', filters.product);
    }

    return this.http
      .get<JourneyStage[]>(`${this.baseUrl}/journey/stages`, { params })
      .pipe(
        catchError((err) => {
          console.warn('API unavailable, using mock journey stages', err);
          return of(this.getMockJourneyStages());
        }),
      );
  }

  /**
   * Get quadrant items from API
   */
  getQuadrantItems(filters?: Partial<FilterState>): Observable<QuadrantItem[]> {
    let params = new HttpParams();

    if (filters?.dateRangeObj?.start) {
      params = params.set(
        'startDate',
        filters.dateRangeObj.start.toISOString(),
      );
    }
    if (filters?.dateRangeObj?.end) {
      params = params.set('endDate', filters.dateRangeObj.end.toISOString());
    }
    if (filters?.product && filters.product !== 'all') {
      params = params.set('product', filters.product);
    }
    if (filters?.channel && filters.channel !== 'all') {
      params = params.set('channel', filters.channel);
    }

    return this.http
      .get<QuadrantItem[]>(`${this.baseUrl}/quadrant/items`, { params })
      .pipe(
        catchError((err) => {
          console.warn('API unavailable, using mock quadrant items', err);
          return of(this.getMockQuadrantItems());
        }),
      );
  }

  /**
   * Get context-aware insight from API
   */
  getInsight(context: AnalysisContext): Observable<ResearchInsight> {
    // Transform context for API
    const requestBody = {
      context: {
        event: context.event
          ? {
              id: context.event.id,
              date:
                context.event.date instanceof Date
                  ? context.event.date.toISOString()
                  : context.event.date,
              type: context.event.type,
              label: context.event.label,
              product: context.event.product,
              severity: context.event.severity,
              description: context.event.description,
            }
          : undefined,
        timeWindow: context.timeWindow
          ? {
              start: context.timeWindow.start.toISOString(),
              end: context.timeWindow.end.toISOString(),
            }
          : undefined,
        product: context.product,
        channel: context.channel,
        journeyStage: context.journeyStage,
        quadrant: context.quadrant,
        selectedItems: context.selectedItems,
        selectedBubble: context.selectedBubble
          ? {
              id: context.selectedBubble.id,
              date: context.selectedBubble.date,
              themes: context.selectedBubble.themes,
              sentiment: context.selectedBubble.sentiment,
              npsScore: context.selectedBubble.npsScore,
              volume: context.selectedBubble.volume,
            }
          : undefined,
      },
    };

    return this.http
      .post<ResearchInsight>(`${this.researchUrl}/insight`, requestBody)
      .pipe(
        catchError((err) => {
          console.error('API insight request failed:', err);
          throw err; // Re-throw to let caller handle
        }),
      );
  }

  /**
   * Ask a follow-up question with context - routes through ReAct agent for comprehensive analysis
   */
  askFollowUpQuestion(
    context: AnalysisContext,
    question: string,
    sessionId?: string,
  ): Observable<ResearchInsight> {
    // Use or create a conversation ID for multi-turn context
    const conversationId = sessionId || `followup_${crypto.randomUUID()}`;

    // Transform context for the conversation endpoint
    const requestBody = {
      query: question,
      context: {
        event: context.event
          ? {
              id: context.event.id,
              date:
                context.event.date instanceof Date
                  ? context.event.date.toISOString()
                  : context.event.date,
              type: context.event.type,
              label: context.event.label,
              product: context.event.product,
              severity: context.event.severity,
              description: context.event.description,
            }
          : undefined,
        timeWindow: context.timeWindow
          ? {
              start: context.timeWindow.start.toISOString(),
              end: context.timeWindow.end.toISOString(),
            }
          : undefined,
        product: context.product,
        channel: context.channel,
        journeyStage: context.journeyStage,
        quadrant: context.quadrant,
        selectedItems: context.selectedItems,
        selectedBubble: context.selectedBubble
          ? {
              id: context.selectedBubble.id,
              date: context.selectedBubble.date,
              themes: context.selectedBubble.themes,
              sentiment: context.selectedBubble.sentiment,
              npsScore: context.selectedBubble.npsScore,
              volume: context.selectedBubble.volume,
            }
          : undefined,
      },
    };

    // Route through the ReAct agent's conversation endpoint
    return this.http
      .post<any>(
        `${this.researchUrl}/conversation/${conversationId}`,
        requestBody,
      )
      .pipe(
        map((response: any) => {
          // Transform ResearchResponse to ResearchInsight format
          return {
            title: 'Follow-up Analysis',
            summary: response.answer,
            themeBreakdown: [],
            sentimentTrend: [],
            keyInsights:
              response.reasoning?.map((r: any) => r.thought || r.content) || [],
            keyDrivers: [],
            recommendations: [],
            suggestedActions: [],
            evidence: [],
            reasoningSteps: response.reasoning?.map(
              (r: any, index: number) => ({
                step: r.step || index + 1,
                thought: r.thought || '',
                action: r.action || 'Analyse',
                observation: r.observation,
              }),
            ),
            confidence: response.confidence || 0.8,
            sources: response.sources || [],
          } as ResearchInsight;
        }),
        catchError((err) => {
          console.error('Follow-up question failed:', err);
          throw err;
        }),
      );
  }

  // =========================================================================
  // Mock Data Fallbacks (for offline/demo mode)
  // =========================================================================

  private getMockEvents(): TimelineEvent[] {
    return [
      {
        id: 'evt-001',
        date: new Date('2025-01-03T14:30:00'),
        type: 'outage',
        label: 'Payments Outage',
        product: 'cards',
        severity: 'critical',
        description:
          'Card payment processing failure affecting 45,000 customers',
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
        description:
          'Launch of new Premium Rewards Card with enhanced benefits',
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
  }

  private getMockBubbles(): SentimentBubble[] {
    const bubbles: SentimentBubble[] = [];
    const startDate = new Date('2025-01-01');

    for (let i = 0; i < 31; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      let baseSentiment = -0.2;
      let baseVolume = 45;
      let socialSentiment = -0.1;
      let themes = ['General Inquiry', 'App Issues', 'Wait Times'];
      let product = 'all';

      // Payments outage impact (Jan 3-6)
      if (i >= 2 && i <= 5) {
        baseSentiment = -0.7 - Math.random() * 0.2;
        baseVolume = 180 + Math.floor(Math.random() * 60);
        socialSentiment = -0.8;
        themes = ['Payment Failure', 'Card Declined', 'POS Error'];
        product = 'cards';
      }
      // Recovery period (Jan 7-10)
      else if (i >= 6 && i <= 9) {
        baseSentiment = -0.4 + (i - 6) * 0.1;
        baseVolume = 90 - (i - 6) * 15;
        socialSentiment = -0.4;
        product = 'cards';
      }
      // Fee announcement (Jan 22+)
      else if (i >= 21) {
        baseSentiment = -0.5 - (i - 21) * 0.03;
        baseVolume = 100 + (i - 21) * 8;
        socialSentiment = -0.6;
        themes = ['Overdraft Fees', 'Fee Increase', 'Account Closure'];
        product = 'current-account';
      }

      const sentiment = baseSentiment + (Math.random() * 0.1 - 0.05);
      const nps = this.sentimentToNPS(sentiment);

      bubbles.push({
        id: `bubble-${i}`,
        date,
        volume: baseVolume + Math.floor(Math.random() * 20),
        surveyCount: Math.floor(
          (baseVolume + Math.floor(Math.random() * 20)) * 0.3,
        ),
        sentiment,
        socialSentiment: socialSentiment + Math.random() * 0.1,
        themes,
        product,
        channel: 'complaints',
        ...nps,
      });
    }
    return bubbles;
  }

  private getMockJourneyStages(): JourneyStage[] {
    return [
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
  }

  private getMockQuadrantItems(): QuadrantItem[] {
    return [
      // Critical
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
      // Watch
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
      // Strength
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
      // Noise
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
    ];
  }

  private getMockInsight(context: AnalysisContext): ResearchInsight {
    // Return context-aware mock insight
    if (context.event?.type === 'outage') {
      return {
        summary:
          'The January 3rd payments outage was a critical incident affecting 45,000 customers. Root cause: database failover failure. Average resolution time: 4.2 hours.',
        confidence: 'high',
        keyDrivers: [
          'Database failover stuck at 67%',
          'Manual intervention delayed 8 minutes',
          'No automatic rollback triggered',
        ],
        evidence: [],
        totalCommunications: context.selectedBubble?.volume,
        reasoningSteps: [
          {
            step: 1,
            thought: 'Analysing the January 3rd payments outage incident data.',
            action: 'Search Incidents',
            observation:
              'Database failover stuck at 67%. Manual intervention delayed 8 minutes. No automatic rollback triggered.',
          },
          {
            step: 2,
            thought: 'Checking social media vs formal complaint timing.',
            action: 'Analyse Social Signals',
            observation:
              'Social media detected the issue within 3 minutes, formal complaints peaked 97 minutes later.',
          },
        ],
        suggestedActions: [
          'Review failover automation',
          'Add monitoring alerts',
          'Implement automatic rollback',
        ],
      };
    }

    return {
      summary:
        'Select an event, bubble, or quadrant item to see contextual AI insights.',
      confidence: 'medium',
      keyDrivers: [],
      evidence: [],
      totalCommunications: context.selectedBubble?.volume,
      suggestedActions: [],
    };
  }

  private sentimentToNPS(sentiment: number): {
    npsScore: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
  } {
    if (sentiment < -0.5) {
      const detractorPct = 70 + Math.floor(Math.random() * 15);
      const passivePct = 15 + Math.floor(Math.random() * 10);
      const promoterPct = 100 - detractorPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else if (sentiment < 0.2) {
      const detractorPct = 30 + Math.floor(Math.random() * 10);
      const passivePct = 35 + Math.floor(Math.random() * 10);
      const promoterPct = 100 - detractorPct - passivePct;
      return {
        npsScore: promoterPct - detractorPct,
        promoterPct,
        passivePct,
        detractorPct,
      };
    } else {
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
}

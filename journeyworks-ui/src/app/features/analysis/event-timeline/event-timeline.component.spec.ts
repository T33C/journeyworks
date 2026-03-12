import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';

import { EventTimelineComponent } from './event-timeline.component';
import { AnalysisDataService } from '../../../core/services/analysis-data.service';
import { AnalysisStateService } from '../../../core/services/analysis-state.service';
import { SentimentBubble } from '../../../core/models/analysis.model';

describe('EventTimelineComponent bubble selection', () => {
  let fixture: ComponentFixture<EventTimelineComponent>;
  let component: EventTimelineComponent;
  let stateService: AnalysisStateService;

  const bubble: SentimentBubble = {
    id: 'bubble-1',
    date: new Date('2026-03-10T00:00:00Z'),
    volume: 42,
    surveyCount: 12,
    sentiment: -0.2,
    socialSentiment: -0.1,
    themes: ['support delays'],
    product: 'cards',
    channel: 'phone',
    npsScore: -18,
    promoterPct: 20,
    passivePct: 42,
    detractorPct: 38,
  };

  const anotherBubble: SentimentBubble = {
    id: 'bubble-2',
    date: new Date('2026-03-11T00:00:00Z'),
    volume: 55,
    surveyCount: 18,
    sentiment: 0.25,
    socialSentiment: 0.2,
    themes: ['mobile app experience'],
    product: 'cards',
    channel: 'chat',
    npsScore: 22,
    promoterPct: 44,
    passivePct: 34,
    detractorPct: 22,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventTimelineComponent],
      providers: [
        {
          provide: AnalysisDataService,
          useValue: {
            getSentimentBubbles: () => NEVER,
            getTimelineEvents: () => NEVER,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventTimelineComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(AnalysisStateService);
    fixture.detectChanges();
  });

  it('selects a bubble on first click and clears on second click of the same bubble', () => {
    (component as any).onBubbleClick(new MouseEvent('click'), bubble);

    expect(stateService.context().selectedBubble?.id).toBe('bubble-1');
    expect(Array.from(stateService.highlightedIds())).toEqual(['bubble-1']);

    (component as any).onBubbleClick(new MouseEvent('click'), bubble);

    expect(stateService.context().selectedBubble).toBeUndefined();
    expect(stateService.context().selectedItems).toBeUndefined();
    expect(stateService.highlightedIds().size).toBe(0);
  });

  it('switches selection when clicking a different bubble', () => {
    (component as any).onBubbleClick(new MouseEvent('click'), bubble);
    (component as any).onBubbleClick(new MouseEvent('click'), anotherBubble);

    expect(stateService.context().selectedBubble?.id).toBe('bubble-2');
    expect(stateService.context().selectedItems).toEqual(['bubble-2']);
    expect(Array.from(stateService.highlightedIds())).toEqual(['bubble-2']);
  });
});

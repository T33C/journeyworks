import { Injectable, signal, computed } from '@angular/core';
import {
  AnalysisContext,
  FilterState,
  TimelineEvent,
  JourneyStage,
  SentimentBubble,
  QuadrantItem,
} from '../models/analysis.model';

@Injectable({
  providedIn: 'root',
})
export class AnalysisStateService {
  // Filter state - default to match real ES data range
  private _filters = signal<FilterState>({
    dateRange: '30d',
    dateRangeObj: {
      start: new Date('2026-01-01'),
      end: new Date('2026-02-01'),
    },
    products: ['all'],
    channels: ['all'],
    product: 'all',
    channel: 'all',
    showEvents: true,
    surveysOnly: false,
  });

  // Current selection/context
  private _context = signal<AnalysisContext>({});

  // Highlighted items (for cross-chart coordination)
  private _highlightedIds = signal<Set<string>>(new Set());

  // Selected time window for brush selection
  private _selectedTimeWindow = signal<{ start: Date; end: Date } | null>(null);

  // Public signals
  filters = this._filters.asReadonly();
  context = this._context.asReadonly();
  highlightedIds = this._highlightedIds.asReadonly();
  selectedTimeWindow = this._selectedTimeWindow.asReadonly();

  // Check if item is highlighted
  isHighlighted = computed(() => {
    const ids = this._highlightedIds();
    return (id: string) => ids.size === 0 || ids.has(id);
  });

  // Update filters
  updateFilters(partial: Partial<FilterState>) {
    this._filters.update((current) => ({ ...current, ...partial }));
    // Clear context when filters change
    this._context.set({});
    this._highlightedIds.set(new Set());
  }

  // Set context from chart interaction
  setContext(context: AnalysisContext) {
    this._context.set(context);
  }

  // Update context (merge with existing)
  updateContext(partial: Partial<AnalysisContext>) {
    this._context.update((current) => ({ ...current, ...partial }));
  }

  // Set highlighted items
  setHighlightedIds(ids: string[]) {
    this._highlightedIds.set(new Set(ids));
  }

  // Add to highlighted items
  addHighlightedId(id: string) {
    this._highlightedIds.update((current) => new Set([...current, id]));
  }

  // Clear highlights
  clearHighlights() {
    this._highlightedIds.set(new Set());
  }

  // Set time window selection (from brush)
  setTimeWindow(start: Date, end: Date) {
    this._selectedTimeWindow.set({ start, end });
    this.updateContext({ timeWindow: { start, end } });
  }

  // Clear time window
  clearTimeWindow() {
    this._selectedTimeWindow.set(null);
    this._context.update((current) => {
      const { timeWindow, ...rest } = current;
      return rest;
    });
  }

  // Select event
  selectEvent(event: TimelineEvent) {
    this.setContext({
      event,
      signal: `Event: ${event.label}`,
      product: event.product,
      timeWindow: {
        start: new Date(event.date.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
        end: new Date(event.date.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days after
      },
    });
  }

  // Select bubble on timeline
  selectBubble(bubble: SentimentBubble) {
    // Use the full calendar day since bubbles aggregate surveys by day
    const bubbleDate = new Date(bubble.date);
    const startOfDay = new Date(
      Date.UTC(
        bubbleDate.getUTCFullYear(),
        bubbleDate.getUTCMonth(),
        bubbleDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        bubbleDate.getUTCFullYear(),
        bubbleDate.getUTCMonth(),
        bubbleDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    this.setContext({
      timeWindow: {
        start: startOfDay,
        end: endOfDay,
      },
      product: bubble.product,
      channel: bubble.channel,
      signal: `Volume: ${bubble.volume}, NPS: ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}`,
      selectedItems: [bubble.id],
      selectedBubble: bubble, // Pass full bubble data for contextual insights
    });
    this.setHighlightedIds([bubble.id]);
  }

  // Select journey stage
  selectJourneyStage(stage: JourneyStage) {
    this.updateContext({
      journeyStage: stage,
      signal: `Journey Stage: ${stage.label}`,
    });
  }

  // Select quadrant
  selectQuadrant(quadrant: string, items: QuadrantItem[]) {
    this.setContext({
      quadrant,
      signal: `Quadrant: ${quadrant}`,
      selectedItems: items.map((i) => i.id),
    });
    this.setHighlightedIds(items.map((i) => i.id));
  }

  // Clear all selections
  clearSelection() {
    this._context.set({});
    this._highlightedIds.set(new Set());
    this._selectedTimeWindow.set(null);
  }
}

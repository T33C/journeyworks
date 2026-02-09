import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as d3 from 'd3';

import { AnalysisStateService } from '../../../core/services/analysis-state.service';
import { AnalysisDataService } from '../../../core/services/analysis-data.service';
import {
  SentimentBubble,
  TimelineEvent,
} from '../../../core/models/analysis.model';
import { THEME, RAG, GREY, DATA_VIS } from '../../../core/config/chart.config';

@Component({
  selector: 'app-event-timeline',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="timeline-container">
      <div class="chart-header">
        <div class="chart-title">
          <mat-icon>timeline</mat-icon>
          <h3>Sentiment-Weighted Event Timeline</h3>
        </div>
        <span class="chart-subtitle"
          >Click bubbles or events to explore. Drag to select a time range for
          AI analysis. Use the navigator below to zoom.</span
        >
      </div>
      <div class="chart-area-wrapper">
        <div #chartContainer class="chart-area"></div>
        @if (pendingTimeWindow()) {
          <div
            class="analyse-chip"
            [style.left.px]="pendingTimeWindow()!.chipX"
          >
            <mat-icon class="chip-icon">insights</mat-icon>
            <span class="chip-label">
              Analyse
              {{ pendingTimeWindow()!.start | date: 'd MMM' }}
              –
              {{ pendingTimeWindow()!.end | date: 'd MMM' }}
            </span>
            <button class="chip-action confirm" (click)="confirmAnalysis()">
              <mat-icon>check</mat-icon>
            </button>
            <button class="chip-action dismiss" (click)="dismissSelection()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      </div>
      <div #miniChartContainer class="mini-chart-area"></div>
      <div class="legend">
        <div class="legend-item">
          <span class="bubble negative"></span>
          <span>Negative</span>
        </div>
        <div class="legend-item">
          <span class="bubble neutral"></span>
          <span>Neutral</span>
        </div>
        <div class="legend-item">
          <span class="bubble positive"></span>
          <span>Positive</span>
        </div>
        <div class="legend-separator"></div>
        <div class="legend-item">
          <span class="event-marker"></span>
          <span>Bank Event</span>
        </div>
        <div class="legend-item">
          <span class="social-band"></span>
          <span>Social Sentiment</span>
        </div>
        <div class="legend-separator"></div>
        <div class="legend-item">
          <span class="bubble-with-survey"></span>
          <span>Has Survey Data</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .timeline-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 16px;
      }

      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .chart-title {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          color: #305a85;
        }

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333333;
        }
      }

      .chart-subtitle {
        font-size: 12px;
        color: #9b9b9b;
      }

      .chart-area-wrapper {
        position: relative;
        flex: 1;
        min-height: 200px;
      }

      .chart-area {
        width: 100%;
        height: 100%;
      }

      .analyse-chip {
        position: absolute;
        top: 40px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border: 1.5px solid #305a85;
        border-radius: 20px;
        padding: 4px 6px 4px 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        font-size: 12px;
        font-weight: 500;
        color: #305a85;
        z-index: 10;
        transform: translateX(-50%);
        animation: chipFadeIn 0.2s ease-out;
        white-space: nowrap;
      }

      @keyframes chipFadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .chip-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #305a85;
      }

      .chip-label {
        line-height: 1;
      }

      .chip-action {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        padding: 0;
        transition: background 0.15s;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      .chip-action.confirm {
        background: #305a85;
        color: white;

        &:hover {
          background: #1e3d5c;
        }
      }

      .chip-action.dismiss {
        background: #ededed;
        color: #666;

        &:hover {
          background: #d7d8d6;
        }
      }

      .mini-chart-area {
        height: 50px;
        flex-shrink: 0;
        margin-top: 4px;
        position: relative;

        ::ng-deep {
          .selection {
            fill: #305a85;
            fill-opacity: 0.15;
            stroke: #305a85;
            stroke-width: 1;
            rx: 3;
          }

          .handle {
            fill: #305a85;
            rx: 2;
          }

          .overlay {
            cursor: crosshair;
          }
        }
      }

      .legend {
        display: flex;
        gap: 16px;
        justify-content: center;
        padding-top: 12px;
        border-top: 1px solid #ededed;
        margin-top: 12px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #767676;
      }

      .legend-separator {
        width: 1px;
        height: 16px;
        background: #d7d8d6;
      }

      .bubble {
        width: 12px;
        height: 12px;
        border-radius: 50%;

        &.negative {
          background: #a8000b;
        }
        &.neutral {
          background: #ffbb33;
        }
        &.positive {
          background: #00847f;
        }
      }

      .event-marker {
        width: 2px;
        height: 14px;
        background: #305a85;
      }

      .social-band {
        width: 20px;
        height: 8px;
        background: linear-gradient(90deg, #a8000b, #ffbb33, #00847f);
        border-radius: 2px;
        border: 1.5px solid #f14e73;
      }

      .bubble-with-survey {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ffbb33;
        box-shadow:
          0 0 0 2.5px #ed500d,
          0 0 0 3.5px rgba(237, 80, 13, 0.4);
      }
    `,
  ],
})
export class EventTimelineComponent implements OnInit, AfterViewInit {
  private stateService = inject(AnalysisStateService);
  private dataService = inject(AnalysisDataService);

  @ViewChild('chartContainer') chartContainer!: ElementRef;
  @ViewChild('miniChartContainer') miniChartContainer!: ElementRef;

  events = signal<TimelineEvent[]>([]);

  /** Pending time window from the main chart brush — shown as a chip until confirmed */
  pendingTimeWindow = signal<{
    start: Date;
    end: Date;
    chipX: number;
  } | null>(null);

  // All-time bubble data — used by both the mini chart and main chart
  private allBubbles = signal<SentimentBubble[]>([]);

  // Store the full time domain so the mini chart brush can zoom the main chart
  private fullXDomain: [Date, Date] | null = null;
  private currentXDomain: [Date, Date] | null = null;
  private miniChartBrush: d3.BrushBehavior<unknown> | null = null;
  private miniXScale: d3.ScaleTime<number, number> | null = null;
  private mainBrushRef: d3.BrushBehavior<unknown> | null = null;
  // Prevent feedback loops when programmatically moving the brush
  private isBrushSyncing = false;
  private allTimeDataLoaded = false;

  constructor() {
    // Load all-time data for both the mini chart and main chart.
    // Both charts render from allBubbles; the brush controls the main chart's visible range.
    // Reload when channel/product filters change.
    effect(() => {
      const filters = this.stateService.filters();
      const channel = filters.channel;
      const product = filters.product;
      this.loadAllTimeData({ channel, product });
    });

    // Sync brush position when date range filter changes (e.g. dropdown selection)
    effect(() => {
      const filters = this.stateService.filters();
      const dateRangeObj = filters.dateRangeObj;
      if (dateRangeObj && this.miniXScale && this.miniChartBrush) {
        this.syncBrushToDateRange(dateRangeObj.start, dateRangeObj.end);
      }
    });

    // Apply visual filtering when surveysOnly changes
    effect(() => {
      const surveysOnly = this.stateService.filters().surveysOnly;
      // Use surveysOnly to trigger effect reactivity
      if (surveysOnly !== undefined) {
        this.applyBubbleFiltering();
      }
    });

    effect(() => {
      const highlightedIds = this.stateService.highlightedIds();
      this.applyHighlights(highlightedIds);
    });

    effect(() => {
      const timeWindow = this.stateService.selectedTimeWindow();
      if (!timeWindow) {
        this.clearBrushSelection();
      }
    });
  }

  /** Load all-time data for both charts (no date filter, only channel/product) */
  private loadAllTimeData(filters: { channel?: string; product?: string }) {
    const allTimeFilters: Partial<any> = {
      ...filters,
      dateRange: 'all',
      dateRangeObj: {
        start: new Date(2024, 0, 1),
        end: new Date(),
      },
    };
    this.dataService.getSentimentBubbles(allTimeFilters).subscribe((data) => {
      this.allBubbles.set(data);
      this.fullXDomain = null; // Recalculate from new all-time data
      this.allTimeDataLoaded = true;
      setTimeout(() => {
        this.renderMiniChart();
        this.renderChart();
      }, 100);
    });
    this.dataService
      .getTimelineEvents(allTimeFilters)
      .subscribe((data) => this.events.set(data));
  }

  ngOnInit() {
    // Initial load handled by effect
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderChart();
      // Mini chart renders after allTimeData loads via its own effect
      if (this.allTimeDataLoaded) {
        this.renderMiniChart();
      }
    }, 500);
  }

  private applyHighlights(highlightedIds: Set<string>) {
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const svg = d3.select(container).select('svg');
    const surveysOnly = this.stateService.filters().surveysOnly;

    svg
      .selectAll('.bubble')
      .transition()
      .duration(300)
      .attr('opacity', (d: any) => {
        // Apply surveys filter first
        const baseOpacity = surveysOnly && d.surveyCount === 0 ? 0.15 : 0.85;
        if (highlightedIds.size === 0) return baseOpacity;
        return highlightedIds.has(d.id) ? 1 : Math.min(baseOpacity, 0.3);
      })
      .attr('stroke', (d: any) => {
        if (highlightedIds.size === 0) return 'white';
        return highlightedIds.has(d.id) ? RAG.amber : 'white';
      })
      .attr('stroke-width', (d: any) => {
        if (highlightedIds.size === 0) return 2;
        return highlightedIds.has(d.id) ? 4 : 1;
      });

    // Also update survey rings
    svg
      .selectAll('.survey-ring')
      .transition()
      .duration(300)
      .attr('opacity', (d: any) => {
        if (highlightedIds.size === 0) return 0.9;
        return highlightedIds.has(d.id) ? 1 : 0.3;
      });
  }

  private clearBrushSelection() {
    // Clear the pending chip
    this.pendingTimeWindow.set(null);

    // Clear the main chart brush selection
    const container = this.chartContainer?.nativeElement;
    if (container) {
      const svg = d3.select(container).select('svg');
      svg.select('.main-brush').call(d3.brushX().move as any, null);
    }

    // Snap mini chart brush back to the current date range filter
    const dateRangeObj = this.stateService.filters().dateRangeObj;
    if (dateRangeObj && this.miniXScale && this.miniChartBrush) {
      this.syncBrushToDateRange(dateRangeObj.start, dateRangeObj.end);
    }
  }

  /** Programmatically move the mini chart brush to match a date range */
  private syncBrushToDateRange(start: Date, end: Date) {
    const miniContainer = this.miniChartContainer?.nativeElement;
    if (!miniContainer || !this.miniChartBrush || !this.miniXScale) return;

    this.isBrushSyncing = true;

    const x0 = Math.max(0, this.miniXScale(start));
    const x1 = Math.min(this.miniXScale.range()[1], this.miniXScale(end));

    const svg = d3.select(miniContainer).select('svg');
    svg
      .select<SVGGElement>('.mini-brush')
      .call(this.miniChartBrush.move as any, [x0, x1]);

    // Update main chart domain to match
    this.currentXDomain = [start, end];
    this.renderChart();

    // Reset flag after a tick so brush events from the programmatic move are ignored
    setTimeout(() => (this.isBrushSyncing = false), 0);
  }

  private renderChart() {
    const container = this.chartContainer.nativeElement;
    const allBubbles = this.allBubbles();
    const events = this.events();

    if (!container || allBubbles.length === 0) return;

    // Filter bubbles to the current visible domain
    const domain = this.currentXDomain;
    const bubbles = domain
      ? allBubbles.filter((b) => b.date >= domain[0] && b.date <= domain[1])
      : allBubbles;

    if (bubbles.length === 0) {
      // Show empty state if no bubbles in range
      d3.select(container).selectAll('*').remove();
      const emptyMsg = d3
        .select(container)
        .append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .style('height', '100%')
        .style('color', '#9b9b9b')
        .style('font-size', '13px');
      emptyMsg.text('No data in selected range. Drag the navigator to adjust.');
      return;
    }

    d3.select(container).selectAll('*').remove();

    const margin = { top: 50, right: 40, bottom: 30, left: 50 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = container.offsetHeight - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height);

    const chartContent = svg.append('g').attr('clip-path', 'url(#chart-clip)');

    // Scales
    const leadDays = 3;
    const xExtent = d3.extent(bubbles, (d) => d.date) as [Date, Date];
    const extendedStart = new Date(xExtent[0]);
    extendedStart.setDate(extendedStart.getDate() - leadDays);
    // Add 1 day padding at the end for bubbles near the edge
    const extendedEnd = new Date(xExtent[1]);
    extendedEnd.setDate(extendedEnd.getDate() + 1);

    // Use zoomed domain if set by the mini chart brush, otherwise data extent
    const activeDomain = this.currentXDomain || [extendedStart, extendedEnd];
    const x = d3.scaleTime().domain(activeDomain).range([0, width]);

    // Calculate y-extent from actual data with padding
    const sentimentExtent = d3.extent(bubbles, (d) => d.sentiment) as [
      number,
      number,
    ];
    const socialExtent = d3.extent(bubbles, (d) => d.socialSentiment) as [
      number,
      number,
    ];
    const yMin = Math.min(sentimentExtent[0], socialExtent[0], -1) - 0.1;
    const yMax = Math.max(sentimentExtent[1], socialExtent[1], 0.5) + 0.15;
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    const volumeMax = d3.max(bubbles, (d) => d.volume) || 300;
    const radiusScale = d3.scaleSqrt().domain([0, volumeMax]).range([4, 30]);

    // Social sentiment band
    const socialBandData = bubbles.map((b) => {
      const leadDate = new Date(b.date);
      leadDate.setDate(leadDate.getDate() - leadDays);
      return { date: leadDate, sentiment: b.socialSentiment };
    });

    const areaGenerator = d3
      .area<{ date: Date; sentiment: number }>()
      .x((d) => x(d.date))
      .y0(height)
      .y1((d) => y(d.sentiment))
      .curve(d3.curveMonotoneX);

    const lineGenerator = d3
      .line<{ date: Date; sentiment: number }>()
      .x((d) => x(d.date))
      .y((d) => y(d.sentiment))
      .curve(d3.curveMonotoneX);

    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'socialGradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', RAG.red)
      .attr('stop-opacity', 0.35);
    gradient
      .append('stop')
      .attr('offset', '50%')
      .attr('stop-color', RAG.amber)
      .attr('stop-opacity', 0.4);
    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', RAG.green)
      .attr('stop-opacity', 0.35);

    chartContent
      .append('path')
      .datum(socialBandData)
      .attr('class', 'social-sentiment-area')
      .attr('fill', 'url(#socialGradient)')
      .attr('d', areaGenerator);

    chartContent
      .append('path')
      .datum(socialBandData)
      .attr('class', 'social-sentiment-line')
      .attr('fill', 'none')
      .attr('stroke', DATA_VIS.pink[3])
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.7)
      .attr('d', lineGenerator);

    // Zero line
    chartContent
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', GREY[3])
      .attr('stroke-dasharray', '4,4');

    // Brush for date range selection — rendered early so bubbles sit above it
    const mainBrush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('end', (event) => {
        if (!event.selection) {
          this.pendingTimeWindow.set(null);
          return;
        }
        const [bx0, bx1] = event.selection as [number, number];
        const start = x.invert(bx0);
        const end = x.invert(bx1);
        // Position the chip at the midpoint of the brush selection, offset by left margin
        const chipX = margin.left + (bx0 + bx1) / 2;
        this.pendingTimeWindow.set({ start, end, chipX });
      });

    this.mainBrushRef = mainBrush;
    const mainBrushGroup = chartContent
      .append('g')
      .attr('class', 'main-brush')
      .call(mainBrush);

    // Event markers
    const showEvents = this.stateService.filters().showEvents;
    if (showEvents && events.length > 0) {
      const sortedEvents = [...events].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const labelPositions: { xPos: number; yLevel: number }[] = [];
      const minLabelSpacing = 80;

      sortedEvents.forEach((event) => {
        const shiftedEventDate = new Date(event.date);
        shiftedEventDate.setDate(shiftedEventDate.getDate() - leadDays);
        const xPos = x(shiftedEventDate);

        let yLevel = 0;
        for (let i = 0; i < labelPositions.length; i++) {
          if (Math.abs(xPos - labelPositions[i].xPos) < minLabelSpacing) {
            if (labelPositions[i].yLevel === yLevel) {
              yLevel++;
            }
          }
        }
        labelPositions.push({ xPos, yLevel });

        const labelY = -12 - yLevel * 14;

        svg
          .append('line')
          .attr('x1', xPos)
          .attr('x2', xPos)
          .attr('y1', labelY + 8)
          .attr('y2', height)
          .attr(
            'stroke',
            event.type === 'outage'
              ? RAG.red
              : event.type === 'launch'
                ? RAG.green
                : RAG.blue,
          )
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', event.type === 'outage' ? 'none' : '6,3')
          .style('cursor', 'pointer')
          .on('click', () => this.onEventClick(event));

        const textEl = svg
          .append('text')
          .attr('x', xPos)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .attr(
            'fill',
            event.type === 'outage'
              ? RAG.red
              : event.type === 'launch'
                ? RAG.green
                : RAG.blue,
          )
          .style('cursor', 'pointer')
          .text(
            event.label.length > 15
              ? event.label.substring(0, 15) + '…'
              : event.label,
          )
          .on('click', () => this.onEventClick(event));

        // Add native SVG tooltip showing the full event name
        textEl.append('title').text(event.label);
      });
    }

    // Gold rings for bubbles with surveys (rendered first so bubbles appear on top)
    const surveysOnly = this.stateService.filters().surveysOnly;
    const ringsGroup = chartContent
      .selectAll('.survey-ring')
      .data(bubbles.filter((b) => b.surveyCount > 0))
      .enter()
      .append('circle')
      .attr('class', 'survey-ring')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.sentiment))
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', DATA_VIS.orange[3])
      .attr('stroke-width', 3)
      .attr('opacity', 0)
      .style('pointer-events', 'none');

    ringsGroup
      .transition()
      .duration(500)
      .delay((d) => {
        const idx = bubbles.findIndex((b) => b.id === d.id);
        return idx * 30;
      })
      .attr('r', (d) => radiusScale(d.volume) + 4)
      .attr('opacity', 0.9);

    // Bubbles with animation
    const bubblesGroup = chartContent
      .selectAll('.bubble')
      .data(bubbles)
      .enter()
      .append('circle')
      .attr('class', 'bubble')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.sentiment))
      .attr('r', 0)
      .attr('fill', (d) => this.getSentimentColor(d.sentiment))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .on('click', (_, d) => this.onBubbleClick(d));

    bubblesGroup
      .transition()
      .duration(500)
      .delay((_, i) => i * 30)
      .attr('r', (d) => radiusScale(d.volume))
      .attr('opacity', (d) => {
        if (!surveysOnly) return 0.85;
        return d.surveyCount > 0 ? 0.85 : 0.15;
      });

    // Raise bubbles and rings above the brush overlay so they receive pointer events
    chartContent.selectAll('.survey-ring').raise();
    chartContent.selectAll('.bubble').raise();

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(8)
          .tickFormat(d3.timeFormat('%d %b') as any),
      )
      .selectAll('text')
      .attr('fill', GREY[6]);

    svg
      .append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => d3.format('+.1f')(d as number)),
      )
      .selectAll('text')
      .attr('fill', GREY[6]);

    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', GREY[6])
      .text('Net Promoter Score');
  }

  private renderMiniChart() {
    const container = this.miniChartContainer?.nativeElement;
    const allBubbles = this.allBubbles();

    if (!container || allBubbles.length === 0) return;

    d3.select(container).selectAll('*').remove();

    const margin = { top: 4, right: 40, bottom: 18, left: 50 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = container.offsetHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Aggregate all-time bubbles by day for volume area chart
    const volumeByDay = d3.rollup(
      allBubbles,
      (v) => d3.sum(v, (d) => d.volume),
      (d) => d3.timeDay.floor(d.date).getTime(),
    );

    const volumeData = Array.from(volumeByDay, ([time, vol]) => ({
      date: new Date(time),
      volume: vol,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate full domain from all-time data
    const xExtent = d3.extent(allBubbles, (d) => d.date) as [Date, Date];
    const extendedStart = new Date(xExtent[0]);
    extendedStart.setDate(extendedStart.getDate() - 3);
    const extendedEnd = new Date(xExtent[1]);
    extendedEnd.setDate(extendedEnd.getDate() + 1);
    this.fullXDomain = [extendedStart, extendedEnd];

    // X scale spans full all-time domain (always)
    const xMini = d3.scaleTime().domain(this.fullXDomain).range([0, width]);
    this.miniXScale = xMini;

    // Y scale for volume
    const maxVol = d3.max(volumeData, (d) => d.volume) || 1;
    const yMini = d3.scaleLinear().domain([0, maxVol]).range([height, 0]);

    // Clip path
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'mini-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    const content = svg.append('g').attr('clip-path', 'url(#mini-clip)');

    // Volume area
    const areaGen = d3
      .area<{ date: Date; volume: number }>()
      .x((d) => xMini(d.date))
      .y0(height)
      .y1((d) => yMini(d.volume))
      .curve(d3.curveMonotoneX);

    // Gradient
    const grad = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'miniGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#305a85')
      .attr('stop-opacity', 0.35);
    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#305a85')
      .attr('stop-opacity', 0.05);

    content
      .append('path')
      .datum(volumeData)
      .attr('fill', 'url(#miniGradient)')
      .attr('d', areaGen);

    // Volume line
    const lineGen = d3
      .line<{ date: Date; volume: number }>()
      .x((d) => xMini(d.date))
      .y((d) => yMini(d.volume))
      .curve(d3.curveMonotoneX);

    content
      .append('path')
      .datum(volumeData)
      .attr('fill', 'none')
      .attr('stroke', '#305a85')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('d', lineGen);

    // X axis (compact)
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xMini)
          .ticks(6)
          .tickFormat(d3.timeFormat('%b %y') as any)
          .tickSize(3),
      )
      .selectAll('text')
      .attr('fill', GREY[5])
      .attr('font-size', '9px');

    // Brush on mini chart
    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('brush', (event) => {
        // Ignore programmatic moves
        if (this.isBrushSyncing || !event.sourceEvent) return;
        if (!event.selection) return;
        const [x0, x1] = event.selection as [number, number];
        const start = xMini.invert(x0);
        const end = xMini.invert(x1);
        this.currentXDomain = [start, end];
        this.renderChart();
      })
      .on('end', (event) => {
        // Ignore programmatic moves
        if (this.isBrushSyncing || !event.sourceEvent) return;
        if (!event.selection) {
          // Brush cleared — snap back to current date range filter
          const dateRangeObj = this.stateService.filters().dateRangeObj;
          if (dateRangeObj) {
            this.syncBrushToDateRange(dateRangeObj.start, dateRangeObj.end);
          }
          this.stateService.clearBrushDateRange();
          return;
        }
        const [x0, x1] = event.selection as [number, number];
        const start = xMini.invert(x0);
        const end = xMini.invert(x1);
        this.currentXDomain = [start, end];
        // Propagate brush date range to other charts (quadrant, waterfall)
        this.stateService.setBrushDateRange(start, end);
        // Only zoom the main chart — do NOT call setTimeWindow (that's the main chart brush's job)
        this.renderChart();
      });

    this.miniChartBrush = brush;

    const brushGroup = content
      .append('g')
      .attr('class', 'mini-brush')
      .call(brush);

    // Initialize brush to match the current date range filter (always visible)
    const dateRangeObj = this.stateService.filters().dateRangeObj;
    if (dateRangeObj) {
      const x0 = Math.max(0, xMini(dateRangeObj.start));
      const x1 = Math.min(width, xMini(dateRangeObj.end));
      this.isBrushSyncing = true;
      brushGroup.call(brush.move as any, [x0, x1]);
      this.currentXDomain = [dateRangeObj.start, dateRangeObj.end];
      setTimeout(() => {
        this.isBrushSyncing = false;
        // Ensure main chart renders with the correct domain
        this.renderChart();
      }, 0);
    }
  }

  /** User confirmed the brush selection — trigger AI Research insights */
  confirmAnalysis() {
    const pending = this.pendingTimeWindow();
    if (!pending) return;
    this.stateService.setTimeWindow(pending.start, pending.end);
    this.pendingTimeWindow.set(null);
    // Clear the brush overlay since the selection is now committed
    const container = this.chartContainer?.nativeElement;
    if (container) {
      const svg = d3.select(container).select('svg');
      svg.select('.main-brush').call(d3.brushX().move as any, null);
    }
  }

  /** User dismissed the brush selection — clear without triggering insights */
  dismissSelection() {
    this.pendingTimeWindow.set(null);
    const container = this.chartContainer?.nativeElement;
    if (container) {
      const svg = d3.select(container).select('svg');
      svg.select('.main-brush').call(d3.brushX().move as any, null);
    }
  }

  private getSentimentColor(sentiment: number): string {
    if (sentiment < -0.4) return RAG.red;
    if (sentiment < 0) return RAG.amber;
    return RAG.green;
  }

  private showTooltip(event: MouseEvent, bubble: SentimentBubble) {
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', `1px solid ${GREY[3]}`)
      .style('border-radius', '8px')
      .style('padding', '14px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('max-width', '320px')
      .style('pointer-events', 'none')
      .html(
        `
        <strong>${d3.timeFormat('%d %B %Y')(bubble.date)}</strong><br/>
        <div style="margin-top: 8px;">
          <strong style="font-size: 16px; color:${this.getSentimentColor(bubble.sentiment)}">
            NPS: ${bubble.npsScore > 0 ? '+' : ''}${bubble.npsScore}
          </strong>
        </div>
        <div style="margin-top: 6px; font-size: 11px;">
          <span style="color: #66bb6a;">▲ ${bubble.promoterPct}%</span>
          <span style="color: #9e9e9e;">● ${bubble.passivePct}%</span>
          <span style="color: #ef5350;">▼ ${bubble.detractorPct}%</span>
        </div>
        <div style="margin-top: 8px;">Communications: <strong>${bubble.volume}</strong></div>
        <div style="margin-top: 4px;">Survey responses: <strong>${bubble.surveyCount || 0}</strong></div>
        <div style="margin-top: 6px; font-size: 11px; color: #666;">
          <strong>Themes:</strong> ${bubble.themes.slice(0, 3).join(', ')}
        </div>
        <div style="margin-top: 8px; font-size: 10px; color: #999;">Click for detailed analysis →</div>
      `,
      );

    // Position with viewport bounds checking
    const node = tooltip.node() as HTMLElement;
    const tooltipHeight = node.offsetHeight;
    const tooltipWidth = node.offsetWidth;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let left = event.pageX + 15;
    let top = event.pageY - 10;

    if (event.clientY + tooltipHeight + 12 > viewportHeight) {
      top = event.pageY - tooltipHeight - 12;
    }
    if (left + tooltipWidth > viewportWidth) {
      left = event.pageX - tooltipWidth - 12;
    }

    tooltip.style('left', left + 'px').style('top', top + 'px');
  }

  private hideTooltip() {
    d3.selectAll('.d3-tooltip').remove();
  }

  private onBubbleClick(bubble: SentimentBubble) {
    this.stateService.selectBubble(bubble);
  }

  private onEventClick(event: TimelineEvent) {
    this.stateService.selectEvent(event);
  }

  private applyBubbleFiltering() {
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const surveysOnly = this.stateService.filters().surveysOnly;
    const svg = d3.select(container).select('svg');

    // Update bubble opacity based on filter
    svg
      .selectAll('.bubble')
      .transition()
      .duration(300)
      .attr('opacity', (d: any) => {
        if (!surveysOnly) return 0.85;
        return d.surveyCount > 0 ? 0.85 : 0.15;
      });

    // Update rings opacity based on filter
    svg
      .selectAll('.survey-ring')
      .transition()
      .duration(300)
      .attr('opacity', (d: any) => {
        if (!surveysOnly) return 0.9;
        return d.surveyCount > 0 ? 0.9 : 0.15;
      });
  }
}

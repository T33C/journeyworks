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
          >Click bubbles or events to explore. Drag to select time range.</span
        >
      </div>
      <div #chartContainer class="chart-area"></div>
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
          color: #5c6bc0;
        }

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }
      }

      .chart-subtitle {
        font-size: 12px;
        color: #999;
      }

      .chart-area {
        flex: 1;
        min-height: 250px;
      }

      .legend {
        display: flex;
        gap: 16px;
        justify-content: center;
        padding-top: 12px;
        border-top: 1px solid #eee;
        margin-top: 12px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #666;
      }

      .legend-separator {
        width: 1px;
        height: 16px;
        background: #ddd;
      }

      .bubble {
        width: 12px;
        height: 12px;
        border-radius: 50%;

        &.negative {
          background: #ef5350;
        }
        &.neutral {
          background: #ffb74d;
        }
        &.positive {
          background: #66bb6a;
        }
      }

      .event-marker {
        width: 2px;
        height: 14px;
        background: #5c6bc0;
      }

      .social-band {
        width: 20px;
        height: 8px;
        background: linear-gradient(90deg, #f44336, #ffc107, #4caf50);
        border-radius: 2px;
        border: 1.5px solid #9c27b0;
      }

      .bubble-with-survey {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ffb74d;
        box-shadow:
          0 0 0 2.5px #ffc107,
          0 0 0 3.5px rgba(255, 193, 7, 0.4);
      }
    `,
  ],
})
export class EventTimelineComponent implements OnInit, AfterViewInit {
  private stateService = inject(AnalysisStateService);
  private dataService = inject(AnalysisDataService);

  @ViewChild('chartContainer') chartContainer!: ElementRef;

  bubbles = signal<SentimentBubble[]>([]);
  events = signal<TimelineEvent[]>([]);

  constructor() {
    // Re-fetch data and re-render when filters change (except surveysOnly which is visual only)
    effect(() => {
      const filters = this.stateService.filters();
      // surveysOnly is handled separately - doesn't need data refetch
      const { surveysOnly, ...dataFilters } = filters;
      this.loadData(dataFilters);
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

  private loadData(filters: any) {
    this.dataService.getSentimentBubbles(filters).subscribe((data) => {
      this.bubbles.set(data);
      setTimeout(() => this.renderChart(), 100);
    });
    this.dataService
      .getTimelineEvents(filters)
      .subscribe((data) => this.events.set(data));
  }

  ngOnInit() {
    // Initial load handled by effect
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderChart(), 500);
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
        return highlightedIds.has(d.id) ? '#ffeb3b' : 'white';
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
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const svg = d3.select(container).select('svg');
    svg.select('.brush').call(d3.brush().move as any, null);
  }

  private renderChart() {
    const container = this.chartContainer.nativeElement;
    const bubbles = this.bubbles();
    const events = this.events();

    if (!container || bubbles.length === 0) return;

    d3.select(container).selectAll('*').remove();

    const margin = { top: 50, right: 40, bottom: 50, left: 50 };
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
    const x = d3
      .scaleTime()
      .domain([extendedStart, xExtent[1]])
      .range([0, width]);
    const y = d3.scaleLinear().domain([-1, 0.6]).range([height, 0]);
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
      .attr('stop-color', '#f44336')
      .attr('stop-opacity', 0.35);
    gradient
      .append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#ffc107')
      .attr('stop-opacity', 0.4);
    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#4caf50')
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
      .attr('stroke', '#9c27b0')
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
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4,4');

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
              ? '#e53935'
              : event.type === 'launch'
                ? '#43a047'
                : '#5c6bc0',
          )
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', event.type === 'outage' ? 'none' : '6,3')
          .style('cursor', 'pointer')
          .on('click', () => this.onEventClick(event));

        svg
          .append('text')
          .attr('x', xPos)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .attr(
            'fill',
            event.type === 'outage'
              ? '#e53935'
              : event.type === 'launch'
                ? '#43a047'
                : '#5c6bc0',
          )
          .style('cursor', 'pointer')
          .text(
            event.label.length > 15
              ? event.label.substring(0, 15) + '…'
              : event.label,
          )
          .on('click', () => this.onEventClick(event));
      });
    }

    // Brush for date range selection
    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('end', (event) => {
        if (!event.selection) return;
        const [x0, x1] = event.selection as [number, number];
        const start = x.invert(x0);
        const end = x.invert(x1);
        this.stateService.setTimeWindow(start, end);
      });

    chartContent.append('g').attr('class', 'brush').call(brush);

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
      .attr('stroke', '#ffc107')
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
      .attr('fill', '#666');

    svg
      .append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => d3.format('+.1f')(d as number)),
      )
      .selectAll('text')
      .attr('fill', '#666');

    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .text('Net Promoter Score');
  }

  private getSentimentColor(sentiment: number): string {
    if (sentiment < -0.4) return '#ef5350';
    if (sentiment < 0) return '#ffb74d';
    return '#66bb6a';
  }

  private showTooltip(event: MouseEvent, bubble: SentimentBubble) {
    d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '8px')
      .style('padding', '14px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('max-width', '320px')
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
      )
      .style('left', event.pageX + 15 + 'px')
      .style('top', event.pageY - 10 + 'px');
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

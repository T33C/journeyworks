import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  effect,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';

import { AnalysisStateService } from '../../../core/services/analysis-state.service';
import { AnalysisDataService } from '../../../core/services/analysis-data.service';
import { QuadrantItem } from '../../../core/models/analysis.model';
import {
  CHART_CONFIG,
  THEME,
  getChartDimensions,
  getQuadrantColor,
  getQuadrantBgColor,
} from '../../../core/config/chart.config';

@Component({
  selector: 'app-quadrant-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="quadrant-container">
      <div class="chart-header">
        <div class="chart-title">
          <mat-icon>grid_view</mat-icon>
          <h3>Volume vs Sentiment</h3>
        </div>
        <span class="chart-subtitle">Click quadrant to filter</span>
      </div>
      <div #chartContainer class="chart-area"></div>
    </div>
  `,
  styles: [
    `
      .quadrant-container {
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
          color: var(--brand-primary, #5c6bc0);
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #333);
        }
      }

      .chart-subtitle {
        font-size: 11px;
        color: var(--text-muted, #999);
      }

      .chart-area {
        flex: 1;
        min-height: 180px;
      }
    `,
  ],
})
export class QuadrantChartComponent implements OnInit, AfterViewInit {
  private stateService = inject(AnalysisStateService);
  private dataService = inject(AnalysisDataService);

  @ViewChild('chartContainer') chartContainer!: ElementRef;

  items = signal<QuadrantItem[]>([]);

  constructor() {
    // Re-fetch data when filters change
    effect(() => {
      const filters = this.stateService.filters();
      this.loadData(filters);
    });
  }

  private loadData(filters: any) {
    this.dataService.getQuadrantItems(filters).subscribe((data) => {
      this.items.set(data);
      setTimeout(() => this.renderChart(), 100);
    });
  }

  ngOnInit() {
    // Initial load handled by effect
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderChart(), 700);
  }

  private renderChart() {
    const container = this.chartContainer.nativeElement;
    const items = this.items();

    if (!container || items.length === 0) return;

    d3.select(container).selectAll('*').remove();

    const margin = CHART_CONFIG.margin;
    const { width, height } = getChartDimensions(container);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear().domain([-1, 0.6]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 300]).range([height, 0]);

    // Quadrant layout:
    // X-axis: left = negative sentiment, right = positive sentiment
    // Y-axis: bottom = low volume, top = high volume
    //
    // Top-left: Critical (high volume, negative sentiment)
    // Top-right: Strength (high volume, positive sentiment)
    // Bottom-left: Watch (low volume, negative sentiment)
    // Bottom-right: Noise (low volume, positive sentiment)

    const correctedQuadrants = [
      // Top-left: Critical (negative sentiment, high volume)
      {
        x: 0,
        y: 0,
        w: x(0),
        h: y(150),
        label: 'Critical',
        color: THEME.quadrant.critical.bg,
        textColor: THEME.quadrant.critical.fill,
        quad: 'critical',
      },
      // Top-right: Strength (positive sentiment, high volume)
      {
        x: x(0),
        y: 0,
        w: width - x(0),
        h: y(150),
        label: 'Strength',
        color: THEME.quadrant.strength.bg,
        textColor: THEME.quadrant.strength.fill,
        quad: 'strength',
      },
      // Bottom-left: Watch (negative sentiment, low volume)
      {
        x: 0,
        y: y(150),
        w: x(0),
        h: height - y(150),
        label: 'Watch',
        color: THEME.quadrant.watch.bg,
        textColor: THEME.quadrant.watch.fill,
        quad: 'watch',
      },
      // Bottom-right: Noise (positive sentiment, low volume)
      {
        x: x(0),
        y: y(150),
        w: width - x(0),
        h: height - y(150),
        label: 'Noise',
        color: THEME.quadrant.noise.bg,
        textColor: THEME.quadrant.noise.fill,
        quad: 'noise',
      },
    ];

    // Draw quadrant backgrounds
    correctedQuadrants.forEach((q) => {
      svg
        .append('rect')
        .attr('x', q.x)
        .attr('y', q.y)
        .attr('width', q.w)
        .attr('height', q.h)
        .attr('fill', q.color)
        .attr('opacity', 0.5)
        .style('cursor', 'pointer')
        .on('click', () => this.onQuadrantClick(q.quad));

      svg
        .append('text')
        .attr('x', q.x + q.w / 2)
        .attr('y', q.y + 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', q.textColor)
        .text(q.label)
        .style('cursor', 'pointer')
        .on('click', () => this.onQuadrantClick(q.quad));
    });

    // Zero lines
    svg
      .append('line')
      .attr('x1', x(0))
      .attr('x2', x(0))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', THEME.chart.grid)
      .attr('stroke-width', 1);

    svg
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(150))
      .attr('y2', y(150))
      .attr('stroke', THEME.chart.grid)
      .attr('stroke-width', 1);

    // Data points with enter animation
    const points = svg
      .selectAll('.point')
      .data(items)
      .enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', (d) => x(d.sentiment))
      .attr('cy', (d) => y(d.volume))
      .attr('r', 0) // Start at 0 for animation
      .attr('fill', (d) => getQuadrantColor(d.quadrant))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('opacity', 0) // Start invisible
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .on('click', (_, d) => this.onItemClick(d));

    // Animate points in with stagger
    points
      .transition()
      .duration(400)
      .delay((_, i) => 200 + i * 80) // Stagger after quadrants load
      .attr('r', 8)
      .attr('opacity', 0.9);

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((d) => d3.format('+.1f')(d as number)),
      )
      .selectAll('text')
      .attr('fill', THEME.chart.axis);

    svg
      .append('g')
      .call(d3.axisLeft(y).ticks(4))
      .selectAll('text')
      .attr('fill', THEME.chart.axis);

    // Labels
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', THEME.chart.axis)
      .text('← Negative    Net Promoter Score    Positive →');

    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -38)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', THEME.chart.axis)
      .text('Volume');
  }

  private showTooltip(event: MouseEvent, item: QuadrantItem) {
    const quadrantFillColor = getQuadrantColor(item.quadrant);
    d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '8px')
      .style('padding', '10px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .html(
        `
        <strong>${item.label}</strong><br/>
        <span style="color: ${quadrantFillColor}">●</span> ${item.quadrant.toUpperCase()}<br/>
        <div style="margin-top: 6px;">
          <strong style="font-size: 14px; color:${quadrantFillColor}">NPS: ${item.npsScore > 0 ? '+' : ''}${item.npsScore}</strong>
        </div>
        <div style="margin-top: 4px; font-size: 11px;">
          <span style="color: ${THEME.sentiment.positive};">Promoters: ${item.promoterPct}%</span> |
          <span style="color: ${THEME.sentiment.mixed};">Passives: ${item.passivePct}%</span> |
          <span style="color: ${THEME.sentiment.negative};">Detractors: ${item.detractorPct}%</span>
        </div>
        <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
          Volume: <strong>${item.volume}</strong> surveys
        </div>
      `,
      )
      .style('left', event.pageX + 12 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }

  private hideTooltip() {
    d3.selectAll('.d3-tooltip').remove();
  }

  private onQuadrantClick(quadrant: string) {
    const quadrantItems = this.items().filter((i) => i.quadrant === quadrant);
    this.stateService.selectQuadrant(quadrant, quadrantItems);
  }

  private onItemClick(item: QuadrantItem) {
    this.stateService.setContext({
      signal: `Issue: ${item.label}`,
      product: item.product,
      quadrant: item.quadrant,
    });
    this.stateService.setHighlightedIds([item.id]);
  }
}

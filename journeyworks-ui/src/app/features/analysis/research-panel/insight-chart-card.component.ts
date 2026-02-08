import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

import { InsightChart, InsightChartDataPoint } from '../../../core/models/analysis.model';
import { THEME, CATEGORICAL_COLORS } from '../../../core/config/chart.config';

/**
 * Insight Chart Card Component
 *
 * Renders bar, pie, or time-series charts using D3.js for research panel insights.
 * Uses shared theme configuration for consistent styling.
 */
@Component({
  selector: 'app-insight-chart-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-card">
      <h4 class="chart-title">{{ chart.title }}</h4>
      <div #chartContainer class="chart-container"></div>
    </div>
  `,
  styles: [
    `
      .chart-card {
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--border-color, #d7d8d6);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }

      .chart-title {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #333333);
      }

      .chart-container {
        width: 100%;
        min-height: 140px;
      }
    `,
  ],
})
export class InsightChartCardComponent implements AfterViewInit, OnChanges {
  @Input() chart!: InsightChart;
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chart'] && !changes['chart'].firstChange) {
      this.renderChart();
    }
  }

  private renderChart(): void {
    if (!this.chartContainer?.nativeElement || !this.chart?.data?.length) {
      return;
    }

    const container = this.chartContainer.nativeElement;
    d3.select(container).selectAll('*').remove();

    switch (this.chart.type) {
      case 'bar':
        this.renderBarChart(container);
        break;
      case 'pie':
        this.renderPieChart(container);
        break;
      case 'time-series':
        this.renderTimeSeriesChart(container);
        break;
    }
  }

  private renderBarChart(container: HTMLElement): void {
    const data = this.chart.data;
    const margin = { top: 10, right: 20, bottom: 30, left: 80 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = 120;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 0])
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, height])
      .padding(0.3);

    // Bars with animation
    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.label) || 0)
      .attr('width', 0) // Start at 0 for animation
      .attr('height', y.bandwidth())
      .attr(
        'fill',
        (d, i) => d.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
      )
      .attr('rx', 3)
      .transition()
      .duration(400)
      .delay((_, i) => i * 80)
      .attr('width', (d) => x(d.value));

    // Value labels
    svg
      .selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', (d) => x(d.value) + 4)
      .attr('y', (d) => (y(d.label) || 0) + y.bandwidth() / 2 + 4)
      .attr('font-size', '11px')
      .attr('fill', THEME.text.secondary)
      .text((d) => d.value);

    // Y axis (labels)
    svg
      .append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', THEME.text.primary);

    svg.selectAll('.domain').remove();
  }

  private renderPieChart(container: HTMLElement): void {
    const data = this.chart.data;
    const width = container.offsetWidth;
    const height = 140;
    const radius = Math.min(width, height) / 2 - 10;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 3},${height / 2})`);

    // Pie generator
    const pie = d3
      .pie<InsightChartDataPoint>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<InsightChartDataPoint>>()
      .innerRadius(radius * 0.5) // Donut style
      .outerRadius(radius);

    // Draw slices with animation
    svg
      .selectAll('.slice')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr(
        'fill',
        (d, i) =>
          d.data.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
      )
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .transition()
      .duration(600)
      .attrTween('d', function (d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return (t) => arc(interpolate(t)) || '';
      });

    // Legend
    const legend = d3
      .select(container)
      .select('svg')
      .append('g')
      .attr('transform', `translate(${(width * 2) / 3 - 20}, 20)`);

    data.forEach((d, i) => {
      const legendRow = legend
        .append('g')
        .attr('transform', `translate(0, ${i * 22})`);

      legendRow
        .append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('fill', d.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]);

      legendRow
        .append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('font-size', '11px')
        .attr('fill', THEME.text.primary)
        .text(`${d.label}: ${d.value}%`);
    });
  }

  private renderTimeSeriesChart(container: HTMLElement): void {
    const data = this.chart.data;
    const margin = { top: 10, right: 20, bottom: 30, left: 40 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = 120;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates and prepare data
    const parseDate = d3.timeParse('%Y-%m-%d');
    const chartData = data.map((d) => ({
      ...d,
      parsedDate: d.date ? parseDate(d.date.toString().split('T')[0]) : new Date(d.label),
    }));

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(chartData, (d) => d.parsedDate) as [Date, Date])
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(chartData, (d) => d.value) || 0])
      .nice()
      .range([height, 0]);

    // Line generator
    const line = d3
      .line<typeof chartData[0]>()
      .x((d) => x(d.parsedDate!))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    // Draw line with animation
    const path = svg
      .append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', CATEGORICAL_COLORS[0])
      .attr('stroke-width', 2)
      .attr('d', line);

    const totalLength = path.node()?.getTotalLength() || 0;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(800)
      .attr('stroke-dashoffset', 0);

    // Data points
    svg
      .selectAll('.dot')
      .data(chartData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => x(d.parsedDate!))
      .attr('cy', (d) => y(d.value))
      .attr('r', 4)
      .attr('fill', CATEGORICAL_COLORS[0])
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .transition()
      .delay(800)
      .duration(200)
      .attr('opacity', 1);

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d') as any))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', THEME.chart.axis);

    svg
      .append('g')
      .call(d3.axisLeft(y).ticks(4))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', THEME.chart.axis);
  }
}

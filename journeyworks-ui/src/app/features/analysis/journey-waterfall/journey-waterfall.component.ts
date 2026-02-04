import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  computed,
  effect,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';

import { AnalysisStateService } from '../../../core/services/analysis-state.service';
import { AnalysisDataService } from '../../../core/services/analysis-data.service';
import {
  JourneyStage,
  AnalysisContext,
} from '../../../core/models/analysis.model';
import {
  CHART_CONFIG,
  getChartDimensions,
} from '../../../core/config/chart.config';

@Component({
  selector: 'app-journey-waterfall',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="waterfall-container">
      <div class="chart-header">
        <div class="chart-title">
          <mat-icon>waterfall_chart</mat-icon>
          <h3>Sentiment Journey</h3>
        </div>
        <span class="chart-subtitle">{{ contextDescription() }}</span>
      </div>
      <div #chartContainer class="chart-area"></div>
    </div>
  `,
  styles: [
    `
      .waterfall-container {
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
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
      }

      .chart-subtitle {
        font-size: 11px;
        color: #999;
      }

      .chart-area {
        flex: 1;
        min-height: 180px;
      }
    `,
  ],
})
export class JourneyWaterfallComponent implements OnInit, AfterViewInit {
  private stateService = inject(AnalysisStateService);
  private dataService = inject(AnalysisDataService);

  @ViewChild('chartContainer') chartContainer!: ElementRef;

  stages = signal<JourneyStage[]>([]);

  // Computed context description for subtitle
  contextDescription = computed(() => {
    const ctx = this.stateService.context();
    if (
      !ctx ||
      (!ctx.event &&
        !ctx.timeWindow &&
        !ctx.quadrant &&
        !ctx.product &&
        !ctx.signal)
    ) {
      return 'Average across all complaints';
    }
    if (ctx.event) {
      return ctx.event.label;
    }
    if (ctx.signal) {
      return ctx.signal;
    }
    if (ctx.timeWindow) {
      const start = ctx.timeWindow.start.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      const end = ctx.timeWindow.end.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      return `${start} – ${end}`;
    }
    if (ctx.quadrant) {
      return `${ctx.quadrant.charAt(0).toUpperCase() + ctx.quadrant.slice(1)} Issues`;
    }
    if (ctx.product) {
      return ctx.product.charAt(0).toUpperCase() + ctx.product.slice(1);
    }
    return 'Click to explore';
  });

  constructor() {
    // React to context and filter changes
    effect(() => {
      const ctx = this.stateService.context();
      const filters = this.stateService.filters();
      this.loadJourneyData(ctx, filters);
    });
  }

  private loadJourneyData(context: AnalysisContext, filters?: any) {
    this.dataService.getJourneyStages(context, filters).subscribe((data) => {
      this.stages.set(data);
      // Re-render with animation after data loads
      if (this.chartContainer) {
        setTimeout(() => this.renderChart(), 50);
      }
    });
  }

  ngOnInit() {
    // Initial load handled by effect
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderChart(), 600);
  }

  private renderChart() {
    const container = this.chartContainer.nativeElement;
    const stages = this.stages();

    if (!container || stages.length === 0) return;

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

    // Calculate net outcome using NPS
    const firstNPS = stages[0].npsScore;
    const lastNPS = stages[stages.length - 1].npsScore;
    const netNPSChange = lastNPS - firstNPS;

    // X-axis domain includes "Net Outcome"
    const xLabels = [...stages.map((s) => s.label), 'Net Outcome'];
    const x = d3.scaleBand().domain(xLabels).range([0, width]).padding(0.3);

    // Y-axis uses full NPS scale (-100 to +100)
    const y = d3.scaleLinear().domain([-100, 100]).range([height, 0]);

    // Zero line
    svg
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4,4');

    // Connecting lines between bars (using NPS)
    for (let i = 0; i < stages.length - 1; i++) {
      const currX = (x(stages[i].label) as number) + x.bandwidth();
      const nextX = x(stages[i + 1].label) as number;
      const currY = y(stages[i].npsScore);

      svg
        .append('line')
        .attr('x1', currX)
        .attr('x2', nextX)
        .attr('y1', currY)
        .attr('y2', currY)
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    }

    // Bars with animation
    const bars = svg
      .selectAll('.bar')
      .data(stages)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.label) as number)
      .attr('y', y(0)) // Start from zero line
      .attr('width', x.bandwidth())
      .attr('height', 0) // Start with no height
      .attr('fill', (d) => (d.change >= 0 ? '#66bb6a' : '#ef5350'))
      .attr('rx', 4)
      .attr('opacity', 0.85)
      .style('cursor', 'pointer')
      .on('click', (_, d) => this.onStageClick(d))
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('opacity', 1);
        this.showTooltip(event, d);
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('opacity', 0.85);
        this.hideTooltip();
      });

    // Animate bars (using NPS values)
    bars
      .transition()
      .duration(600)
      .delay((_, i) => i * 100)
      .attr('y', (d, i) => {
        // Calculate previous NPS (first stage starts from 0, others from previous stage NPS)
        const prevNPS = i === 0 ? 0 : stages[i - 1].npsScore;
        const npsChange = d.npsScore - prevNPS;
        if (npsChange >= 0) return y(d.npsScore);
        return y(prevNPS);
      })
      .attr('height', (d, i) => {
        const prevNPS = i === 0 ? 0 : stages[i - 1].npsScore;
        return Math.abs(y(prevNPS) - y(d.npsScore));
      });

    // Value labels showing NPS change (fade in after bars)
    svg
      .selectAll('.label')
      .data(stages)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => (x(d.label) as number) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.npsScore) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', (d, i) => {
        const prevNPS = i === 0 ? 0 : stages[i - 1].npsScore;
        return d.npsScore - prevNPS >= 0 ? '#2e7d32' : '#c62828';
      })
      .attr('opacity', 0)
      .text((d, i) => {
        const prevNPS = i === 0 ? 0 : stages[i - 1].npsScore;
        const change = d.npsScore - prevNPS;
        return (change >= 0 ? '+' : '') + change;
      })
      .transition()
      .duration(400)
      .delay((_, i) => 600 + i * 100)
      .attr('opacity', 1);

    // NET OUTCOME BAR (using NPS)
    const netOutcomeX = x('Net Outcome') as number;
    const netBarY = netNPSChange >= 0 ? y(lastNPS) : y(firstNPS);
    const netBarHeight = Math.abs(y(firstNPS) - y(lastNPS));

    // Net outcome bar with animation and tooltip
    const netOutcomeBar = svg
      .append('rect')
      .attr('class', 'net-outcome-bar')
      .attr('x', netOutcomeX)
      .attr('y', y(0))
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('fill', netNPSChange >= 0 ? '#5c6bc0' : '#7b1fa2')
      .attr('rx', 4)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mouseover', (event) => {
        d3.select(event.currentTarget).attr('opacity', 1);
        this.showNetOutcomeTooltip(event, stages, netNPSChange);
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('opacity', 0.9);
        this.hideTooltip();
      });

    // Animate net outcome bar
    netOutcomeBar
      .transition()
      .duration(600)
      .delay(stages.length * 100 + 200)
      .attr('y', netBarY)
      .attr('height', netBarHeight);

    // Net outcome label showing NPS change
    svg
      .append('text')
      .attr('class', 'net-label')
      .attr('x', netOutcomeX + x.bandwidth() / 2)
      .attr('y', netNPSChange >= 0 ? y(lastNPS) - 6 : y(firstNPS) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', netNPSChange >= 0 ? '#303f9f' : '#6a1b9a')
      .attr('opacity', 0)
      .text((netNPSChange >= 0 ? '+' : '') + netNPSChange)
      .transition()
      .duration(400)
      .delay(stages.length * 100 + 800)
      .attr('opacity', 1);

    // X-axis
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('fill', (d) => (d === 'Net Outcome' ? '#5c6bc0' : '#666'))
      .attr('font-size', '10px')
      .attr('font-weight', (d) => (d === 'Net Outcome' ? '600' : '400'))
      .attr('transform', 'rotate(-15)')
      .attr('text-anchor', 'end');

    // Y-axis with NPS-appropriate ticks
    svg
      .append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => ((d as number) >= 0 ? '+' + d : '' + d)),
      )
      .selectAll('text')
      .attr('fill', '#666');

    // Y-axis label
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

  private onStageClick(stage: JourneyStage) {
    this.stateService.selectJourneyStage(stage);
  }

  private showTooltip(event: MouseEvent, stage: JourneyStage) {
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
        <strong>${stage.label}</strong><br/>
        <div style="margin-top: 6px;">
          <strong style="font-size: 14px; color:${stage.npsScore >= 0 ? '#66bb6a' : '#ef5350'}">NPS: ${stage.npsScore > 0 ? '+' : ''}${stage.npsScore}</strong>
          <span style="margin-left: 8px; color: ${stage.change >= 0 ? '#2e7d32' : '#c62828'};">(${stage.change >= 0 ? '+' : ''}${(stage.change * 100).toFixed(0)} pts)</span>
        </div>
        <div style="margin-top: 4px; font-size: 11px;">
          <span style="color: #66bb6a;">Promoters: ${stage.promoterPct}%</span> |
          <span style="color: #ffb74d;">Passives: ${stage.passivePct}%</span> |
          <span style="color: #ef5350;">Detractors: ${stage.detractorPct}%</span>
        </div>
        <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
          <strong>${stage.communications}</strong> survey responses
        </div>
      `,
      )
      .style('left', event.pageX + 12 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }

  private hideTooltip() {
    d3.selectAll('.d3-tooltip').remove();
  }

  private showNetOutcomeTooltip(
    event: MouseEvent,
    stages: JourneyStage[],
    netNPSChange: number,
  ) {
    const lastStage = stages[stages.length - 1];
    const firstStage = stages[0];

    d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', '1px solid #5c6bc0')
      .style('border-radius', '8px')
      .style('padding', '10px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .html(
        `
        <strong style="color: #5c6bc0;">Net Outcome</strong><br/>
        <div style="margin-top: 6px;">
          <strong style="font-size: 14px; color:${netNPSChange >= 0 ? '#5c6bc0' : '#7b1fa2'}">
            NPS Change: ${netNPSChange >= 0 ? '+' : ''}${netNPSChange} points
          </strong>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee;">
          <div style="margin-bottom: 4px;"><strong>Journey Start:</strong> NPS ${firstStage.npsScore > 0 ? '+' : ''}${firstStage.npsScore}</div>
          <div><strong>Journey End:</strong> NPS ${lastStage.npsScore > 0 ? '+' : ''}${lastStage.npsScore}</div>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; font-size: 11px;">
          <div style="color: #666;">Post-Resolution Breakdown:</div>
          <span style="color: #66bb6a;">Promoters: ${lastStage.promoterPct}%</span> |
          <span style="color: #ffb74d;">Passives: ${lastStage.passivePct}%</span> |
          <span style="color: #ef5350;">Detractors: ${lastStage.detractorPct}%</span>
        </div>
      `,
      )
      .style('left', event.pageX + 12 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }
}

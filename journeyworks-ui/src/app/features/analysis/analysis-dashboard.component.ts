import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { AnalysisStateService } from '../../core/services/analysis-state.service';
import { EventTimelineComponent } from './event-timeline/event-timeline.component';
import { QuadrantChartComponent } from './quadrant-chart/quadrant-chart.component';
import { JourneyWaterfallComponent } from './journey-waterfall/journey-waterfall.component';
import { ResearchPanelComponent } from './research-panel/research-panel.component';

@Component({
  selector: 'app-analysis-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    EventTimelineComponent,
    QuadrantChartComponent,
    JourneyWaterfallComponent,
    ResearchPanelComponent,
  ],
  template: `
    <div class="dashboard-container">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <mat-form-field appearance="outline" class="date-range-field">
            <mat-label>Date Range</mat-label>
            <mat-select
              [value]="stateService.filters().dateRange"
              (selectionChange)="onDateRangeChange($event.value)"
            >
              <mat-option value="7d">Last 7 Days</mat-option>
              <mat-option value="30d">Last 30 Days</mat-option>
              <mat-option value="90d">Last 90 Days</mat-option>
              <mat-option value="ytd">Year to Date</mat-option>
              <mat-option value="all">All Time</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="channel-field">
            <mat-label>Channel</mat-label>
            <mat-select
              [value]="stateService.filters().channel"
              (selectionChange)="onChannelChange($event.value)"
            >
              <mat-option value="all">All Channels</mat-option>
              <mat-option value="email">Email</mat-option>
              <mat-option value="phone">Phone</mat-option>
              <mat-option value="chat">Chat</mat-option>
              <mat-option value="social">Social Media</mat-option>
              <mat-option value="letter">Letter</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="product-field">
            <mat-label>Product</mat-label>
            <mat-select
              [value]="stateService.filters().product"
              (selectionChange)="onProductChange($event.value)"
            >
              <mat-option value="all">All Products</mat-option>
              <mat-option value="cards">Cards</mat-option>
              <mat-option value="savings">Savings</mat-option>
              <mat-option value="current-account">Current Account</mat-option>
              <mat-option value="loans">Loans</mat-option>
              <mat-option value="mortgage">Mortgage</mat-option>
              <mat-option value="insurance">Insurance</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="filter-actions">
          <mat-slide-toggle
            [checked]="stateService.filters().showEvents"
            (change)="onToggleEvents($event.checked)"
            matTooltip="Show/hide bank events on timeline"
          >
            Events
          </mat-slide-toggle>

          <mat-slide-toggle
            [checked]="stateService.filters().surveysOnly"
            (change)="onToggleSurveysOnly($event.checked)"
            matTooltip="Highlight bubbles with survey data"
          >
            Surveys Only
          </mat-slide-toggle>

          <button
            mat-icon-button
            matTooltip="More filters"
            [matMenuTriggerFor]="moreFiltersMenu"
          >
            <mat-icon>tune</mat-icon>
          </button>

          <mat-menu #moreFiltersMenu="matMenu">
            <button mat-menu-item>
              <mat-icon>sentiment_very_satisfied</mat-icon>
              <span>Promoters Only</span>
            </button>
            <button mat-menu-item>
              <mat-icon>sentiment_very_dissatisfied</mat-icon>
              <span>Detractors Only</span>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item>
              <mat-icon>business</mat-icon>
              <span>By Region</span>
            </button>
            <button mat-menu-item>
              <mat-icon>people</mat-icon>
              <span>By Segment</span>
            </button>
          </mat-menu>

          @if (stateService.selectedTimeWindow()) {
            <mat-chip class="time-window-chip" (removed)="clearTimeWindow()">
              {{ formatTimeWindow() }}
              <mat-icon matChipRemove>cancel</mat-icon>
            </mat-chip>
          }

          <button
            mat-stroked-button
            (click)="resetFilters()"
            matTooltip="Reset all filters"
          >
            <mat-icon>refresh</mat-icon>
            Reset
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Analysis Canvas (65%) -->
        <div class="analysis-canvas">
          <!-- Event Timeline (full width, top) -->
          <div class="timeline-section">
            <app-event-timeline></app-event-timeline>
          </div>

          <!-- Bottom Charts (side by side) -->
          <div class="bottom-charts">
            <div class="quadrant-section">
              <app-quadrant-chart></app-quadrant-chart>
            </div>
            <div class="waterfall-section">
              <app-journey-waterfall></app-journey-waterfall>
            </div>
          </div>
        </div>

        <!-- Research Panel (35%) -->
        <div class="research-section">
          <app-research-panel></app-research-panel>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #f5f5f5;
      }

      // Filter Bar
      .filter-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: white;
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        gap: 16px;
        flex-wrap: wrap;
      }

      .filter-group {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .filter-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .date-range-field,
      .channel-field,
      .product-field {
        width: 150px;

        ::ng-deep {
          .mat-mdc-form-field-subscript-wrapper {
            display: none;
          }

          .mdc-text-field--outlined {
            --mdc-outlined-text-field-container-shape: 8px;
          }

          .mat-mdc-form-field-infix {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            min-height: 40px;
          }
        }
      }

      .time-window-chip {
        --mdc-chip-container-height: 32px;
        background: #e3f2fd !important;
        color: #1565c0 !important;
      }

      // Main Content
      .main-content {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .analysis-canvas {
        flex: 0 0 65%;
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
        overflow-y: auto;
      }

      .timeline-section {
        flex: 0 0 60%;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }

      .bottom-charts {
        flex: 0 0 40%;
        display: flex;
        gap: 16px;
        min-height: 280px;
      }

      .quadrant-section,
      .waterfall-section {
        flex: 1;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }

      .research-section {
        flex: 0 0 35%;
        overflow: hidden;
        height: 100%;
        box-sizing: border-box;
        padding: 16px;
        padding-left: 0;
      }

      // Responsive
      @media (max-width: 1200px) {
        .analysis-canvas {
          flex: 0 0 60%;
        }

        .research-section {
          flex: 0 0 40%;
        }
      }

      @media (max-width: 900px) {
        .main-content {
          flex-direction: column;
        }

        .analysis-canvas,
        .research-section {
          flex: none;
        }

        .analysis-canvas {
          height: 60vh;
        }

        .research-section {
          height: 40vh;
        }

        .bottom-charts {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class AnalysisDashboardComponent {
  stateService = inject(AnalysisStateService);

  onDateRangeChange(value: string) {
    const dateRangeObj = this.computeDateRange(value);
    this.stateService.updateFilters({ dateRange: value, dateRangeObj });
  }

  private computeDateRange(value: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (value) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case 'ytd':
        start.setMonth(0, 1);
        break;
      case 'all':
        start.setFullYear(2024, 0, 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }

  onChannelChange(value: string) {
    this.stateService.updateFilters({ channel: value });
  }

  onProductChange(value: string) {
    this.stateService.updateFilters({ product: value });
  }

  onToggleEvents(checked: boolean) {
    this.stateService.updateFilters({ showEvents: checked });
  }

  onToggleSurveysOnly(checked: boolean) {
    this.stateService.updateFilters({ surveysOnly: checked });
  }

  clearTimeWindow() {
    this.stateService.clearSelection();
  }

  resetFilters() {
    const dateRangeObj = this.computeDateRange('30d');
    this.stateService.updateFilters({
      dateRange: '30d',
      dateRangeObj,
      channel: 'all',
      product: 'all',
      showEvents: true,
      surveysOnly: false,
    });
    this.stateService.clearSelection();
  }

  formatTimeWindow(): string {
    const window = this.stateService.selectedTimeWindow();
    if (!window) return '';
    const start = window.start.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    const end = window.end.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    return `${start} - ${end}`;
  }
}

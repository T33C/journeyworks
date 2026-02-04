import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  AnalysisService,
  DashboardSummary,
} from '../../core/services/analysis.service';
import { CommunicationsService } from '../../core/services/communications.service';
import { Communication } from '../../core/models/communication.model';
import {
  getChannelIcon,
  getStatusClass,
  getSentimentClass,
} from '../../shared/utils/ui.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly analysisService = inject(AnalysisService);
  private readonly communicationsService = inject(CommunicationsService);

  summary = signal<DashboardSummary | null>(null);
  recentCommunications = signal<Communication[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  displayedColumns = [
    'customer',
    'subject',
    'channel',
    'sentiment',
    'status',
    'timestamp',
  ];

  // Expose shared utility functions to template
  getChannelIcon = getChannelIcon;
  getStatusClass = getStatusClass;
  getSentimentClass = getSentimentClass;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load dashboard summary
    this.analysisService.getDashboardSummary().subscribe({
      next: (data) => this.summary.set(data),
      error: (err) => {
        console.error('Failed to load dashboard summary', err);
        // Set mock data for demo
        this.summary.set(this.getMockSummary());
      },
    });

    // Load recent communications
    this.communicationsService.getRecent(10).subscribe({
      next: (data) => {
        this.recentCommunications.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load recent communications', err);
        this.recentCommunications.set(this.getMockCommunications());
        this.loading.set(false);
      },
    });
  }

  getChangeIcon(change: number): string {
    if (change > 0) return 'trending_up';
    if (change < 0) return 'trending_down';
    return 'trending_flat';
  }

  getChangeClass(change: number, inverse = false): string {
    if (change === 0) return '';
    const positive = inverse ? change < 0 : change > 0;
    return positive ? 'positive-change' : 'negative-change';
  }

  private getMockSummary(): DashboardSummary {
    return {
      kpis: {
        totalCommunications: 2847,
        totalCommunicationsChange: 12.5,
        openCases: 156,
        openCasesChange: -8.3,
        avgSentiment: 0.72,
        avgSentimentChange: 5.2,
        avgResponseTime: 2.4,
        avgResponseTimeChange: -15.0,
        atRiskCustomers: 12,
        atRiskCustomersChange: 2,
      },
      recentActivity: [
        {
          type: 'escalation',
          description: 'Case #1234 escalated to management',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'resolution',
          description: '15 cases resolved today',
          timestamp: new Date().toISOString(),
        },
      ],
      alerts: [
        {
          severity: 'warning',
          message: 'Increased complaint volume from Enterprise tier',
          timestamp: new Date().toISOString(),
        },
        {
          severity: 'critical',
          message: '3 customers showing rapid sentiment decline',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  private getMockCommunications(): Communication[] {
    return [
      {
        id: '1',
        customerId: 'CUST-10234',
        customerName: 'James Morrison',
        channel: 'email',
        direction: 'inbound',
        subject: 'Mobile app login issue',
        content: 'Unable to log into mobile banking app since the update...',
        timestamp: new Date().toISOString(),
        status: 'open',
        priority: 'high',
        sentiment: { score: -0.6, label: 'negative', confidence: 0.92 },
        topics: ['mobile app', 'login'],
      },
      {
        id: '2',
        customerId: 'CUST-10567',
        customerName: 'Emma Richardson',
        channel: 'phone',
        direction: 'inbound',
        subject: 'Credit card fee query',
        content: 'Question about annual fee charge...',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'in_progress',
        priority: 'medium',
        sentiment: { score: 0.3, label: 'neutral', confidence: 0.85 },
        topics: ['fees', 'credit card'],
      },
      {
        id: '3',
        customerId: 'CUST-10892',
        customerName: 'Robert Williams',
        channel: 'chat',
        direction: 'inbound',
        subject: 'Direct debit confirmation',
        content: 'Confirming direct debit was set up correctly...',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        status: 'resolved',
        priority: 'low',
        sentiment: { score: 0.7, label: 'positive', confidence: 0.88 },
        topics: ['direct debit', 'setup'],
      },
    ];
  }
}

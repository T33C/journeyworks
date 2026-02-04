import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';

import {
  AnalysisService,
  SentimentTrend,
  TopicDistribution,
  RiskAssessment,
} from '../../core/services/analysis.service';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
  ],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.scss',
})
export class AnalysisComponent implements OnInit {
  private readonly analysisService = inject(AnalysisService);

  // Filters
  selectedTimeRange = '30d';
  timeRanges = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  // Data
  sentimentTrends = signal<SentimentTrend[]>([]);
  topicDistribution = signal<TopicDistribution | null>(null);
  riskAssessments = signal<RiskAssessment[]>([]);
  loading = signal(true);

  riskColumns = [
    'customer',
    'riskScore',
    'riskLevel',
    'trend',
    'factors',
    'actions',
  ];

  ngOnInit(): void {
    this.loadAnalysisData();
  }

  loadAnalysisData(): void {
    this.loading.set(true);

    const dateFrom = this.getDateFrom();
    const params = { dateFrom, dateTo: new Date().toISOString() };

    // Load sentiment trends
    this.analysisService.getSentimentTrends(params).subscribe({
      next: (data) => this.sentimentTrends.set(data),
      error: () => this.sentimentTrends.set(this.getMockSentimentTrends()),
    });

    // Load topic distribution
    this.analysisService.getTopicDistribution(params).subscribe({
      next: (data) => this.topicDistribution.set(data),
      error: () => this.topicDistribution.set(this.getMockTopicDistribution()),
    });

    // Load risk assessments
    this.analysisService.getRiskAssessment().subscribe({
      next: (data) => {
        this.riskAssessments.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.riskAssessments.set(this.getMockRiskAssessments());
        this.loading.set(false);
      },
    });
  }

  onTimeRangeChange(): void {
    this.loadAnalysisData();
  }

  getRiskLevelClass(level: string): string {
    return `risk-${level}`;
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving':
        return 'trending_up';
      case 'worsening':
        return 'trending_down';
      default:
        return 'trending_flat';
    }
  }

  getTrendClass(trend: string): string {
    switch (trend) {
      case 'improving':
        return 'trend-improving';
      case 'worsening':
        return 'trend-worsening';
      default:
        return 'trend-stable';
    }
  }

  private getDateFrom(): string {
    const now = new Date();
    switch (this.selectedTimeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case '1y':
        return new Date(
          now.getTime() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  private getMockSentimentTrends(): SentimentTrend[] {
    const trends: SentimentTrend[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split('T')[0],
        positive: 40 + Math.random() * 20,
        neutral: 20 + Math.random() * 15,
        negative: 15 + Math.random() * 10,
        average: 0.6 + Math.random() * 0.2,
      });
    }
    return trends;
  }

  private getMockTopicDistribution(): TopicDistribution {
    return {
      topics: [
        { name: 'Mobile App Issues', count: 342, percentage: 23 },
        { name: 'Card Payments', count: 267, percentage: 18 },
        { name: 'Fees & Charges', count: 223, percentage: 15 },
        { name: 'Online Banking', count: 178, percentage: 12 },
        { name: 'Customer Service', count: 156, percentage: 10 },
        { name: 'Direct Debits', count: 134, percentage: 9 },
        { name: 'Mortgages', count: 89, percentage: 6 },
        { name: 'Other', count: 111, percentage: 7 },
      ],
      trending: [
        { name: 'App Login', change: 45 },
        { name: 'Overdraft Fees', change: 32 },
        { name: 'Card Fraud', change: 28 },
      ],
      emerging: ['Open Banking', 'Biometric Login', 'Savings Rates'],
    };
  }

  private getMockRiskAssessments(): RiskAssessment[] {
    return [
      {
        customerId: 'CUST-10234',
        customerName: 'James Morrison',
        riskScore: 78,
        riskLevel: 'high',
        factors: [
          {
            name: 'Declining Sentiment',
            severity: 0.8,
            description: '3 consecutive negative interactions',
          },
          {
            name: 'Unresolved Complaint',
            severity: 0.9,
            description: 'Open complaint for 5 days',
          },
        ],
        trend: 'worsening',
        recommendations: [
          'Proactive call from account team',
          'Expedite complaint resolution',
        ],
      },
      {
        customerId: 'CUST-10567',
        customerName: 'Emma Richardson',
        riskScore: 65,
        riskLevel: 'medium',
        factors: [
          {
            name: 'Reduced App Usage',
            severity: 0.6,
            description: '40% decrease in mobile app logins',
          },
        ],
        trend: 'stable',
        recommendations: ['Proactive outreach recommended'],
      },
      {
        customerId: 'CUST-10892',
        customerName: 'Robert Williams',
        riskScore: 82,
        riskLevel: 'critical',
        factors: [
          {
            name: 'Competitor Mention',
            severity: 0.9,
            description: 'Mentioned switching banks',
          },
          {
            name: 'Multiple Complaints',
            severity: 0.7,
            description: '4 complaints in past 2 weeks',
          },
        ],
        trend: 'worsening',
        recommendations: [
          'Immediate personal call',
          'Consider retention offer',
        ],
      },
      {
        customerId: 'CUST-11023',
        customerName: 'Sarah Thompson',
        riskScore: 35,
        riskLevel: 'low',
        factors: [],
        trend: 'improving',
        recommendations: ['Continue standard service'],
      },
    ];
  }
}

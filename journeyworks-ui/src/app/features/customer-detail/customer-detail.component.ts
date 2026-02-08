import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  CommunicationsService,
  CustomerHealthReport,
} from '../../core/services/communications.service';
import { Communication, Customer } from '../../core/models/communication.model';
import {
  getChannelIcon,
  getStatusClass,
  getSentimentClass,
} from '../../shared/utils/ui.utils';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly communicationsService = inject(CommunicationsService);

  customer = signal<Customer | null>(null);
  communications = signal<Communication[]>([]);
  healthReport = signal<CustomerHealthReport | null>(null);
  loading = signal(true);

  displayedColumns = ['subject', 'channel', 'sentiment', 'status', 'timestamp'];

  // Expose shared utility functions to template
  getChannelIcon = getChannelIcon;
  getStatusClass = getStatusClass;
  getSentimentClass = getSentimentClass;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCustomerData(id);
    }
  }

  private loadCustomerData(id: string): void {
    this.loading.set(true);

    // Load customer
    this.communicationsService.getCustomer(id).subscribe({
      next: (data) => this.customer.set(data),
      error: () => this.customer.set(this.getMockCustomer(id)),
    });

    // Load communications
    this.communicationsService.getByCustomer(id, 20).subscribe({
      next: (data) => this.communications.set(data),
      error: () => this.communications.set(this.getMockCommunications()),
    });

    // Load health report
    this.communicationsService.getCustomerHealth(id).subscribe({
      next: (data) => {
        this.healthReport.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.healthReport.set(this.getMockHealthReport(id));
        this.loading.set(false);
      },
    });
  }

  getHealthScoreClass(score: number): string {
    if (score >= 80) return 'health-excellent';
    if (score >= 60) return 'health-good';
    if (score >= 40) return 'health-warning';
    return 'health-critical';
  }

  getTierClass(tier: string): string {
    return `tier-${tier}`;
  }

  getRiskClass(level?: string): string {
    return level ? `risk-${level}` : '';
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving':
        return 'trending_up';
      case 'declining':
        return 'trending_down';
      default:
        return 'trending_flat';
    }
  }

  getTrendClass(trend: string): string {
    switch (trend) {
      case 'improving':
        return 'trend-improving';
      case 'declining':
        return 'trend-declining';
      default:
        return 'trend-stable';
    }
  }

  getSentimentPercent(
    breakdown: { positive: number; neutral: number; negative: number },
    key: 'positive' | 'neutral' | 'negative',
  ): number {
    const total = breakdown.positive + breakdown.neutral + breakdown.negative;
    return total > 0 ? Math.round((breakdown[key] / total) * 100) : 0;
  }

  private getMockCustomer(id: string): Customer {
    return {
      id,
      name: 'James Morrison',
      email: 'james.morrison@email.com',
      company: '',
      tier: 'premium',
      accountManager: 'Sarah Johnson',
      healthScore: 72,
      riskLevel: 'medium',
      totalCommunications: 24,
      openCases: 3,
      lastContactDate: new Date().toISOString(),
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
      },
      {
        id: '2',
        customerId: 'CUST-10234',
        customerName: 'James Morrison',
        channel: 'phone',
        direction: 'outbound',
        subject: 'Follow-up call regarding app issue',
        content: 'Called to discuss app login resolution...',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        status: 'resolved',
        priority: 'medium',
        sentiment: { score: 0.3, label: 'neutral', confidence: 0.85 },
      },
      {
        id: '3',
        customerId: 'CUST-10234',
        customerName: 'James Morrison',
        channel: 'chat',
        direction: 'inbound',
        subject: 'Question about overdraft fees',
        content: 'Query about monthly overdraft charges...',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        status: 'resolved',
        priority: 'low',
        sentiment: { score: 0.7, label: 'positive', confidence: 0.88 },
      },
    ];
  }

  private getMockHealthReport(customerId: string): CustomerHealthReport {
    return {
      customerId,
      customerName: 'James Morrison',
      healthScore: 72,
      trend: 'stable',
      riskFactors: [
        'Open complaint pending',
        'Sentiment declined 15% this month',
      ],
      recentSentimentTrend: [0.6, 0.5, 0.4, 0.5, 0.55, 0.5, 0.48],
      recommendations: [
        'Proactive call within 2 weeks',
        'Address open complaint promptly',
        'Consider goodwill gesture for service issues',
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}

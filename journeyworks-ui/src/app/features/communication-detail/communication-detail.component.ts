import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';

import { CommunicationsService } from '../../core/services/communications.service';
import { Communication } from '../../core/models/communication.model';
import {
  getChannelIcon,
  getStatusClass,
  getSentimentClass,
} from '../../shared/utils/ui.utils';

@Component({
  selector: 'app-communication-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './communication-detail.component.html',
  styleUrl: './communication-detail.component.scss',
})
export class CommunicationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly communicationsService = inject(CommunicationsService);

  communication = signal<Communication | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Expose shared utility functions to template
  getChannelIcon = getChannelIcon;
  getStatusClass = getStatusClass;
  getSentimentClass = getSentimentClass;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCommunication(id);
    }
  }

  private loadCommunication(id: string): void {
    this.loading.set(true);
    this.communicationsService.getById(id).subscribe({
      next: (data) => {
        this.communication.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load communication', err);
        // Mock data for demo
        this.communication.set(this.getMockCommunication(id));
        this.loading.set(false);
      },
    });
  }

  updateStatus(newStatus: string): void {
    const comm = this.communication();
    if (comm) {
      this.communicationsService.updateStatus(comm.id, newStatus).subscribe({
        next: (updated) => this.communication.set(updated),
        error: (err) => console.error('Failed to update status', err),
      });
    }
  }

  private getMockCommunication(id: string): Communication {
    return {
      id,
      customerId: 'CUST-10234',
      customerName: 'James Morrison',
      channel: 'email',
      direction: 'inbound',
      subject: 'Mobile app login issue - Urgent help needed',
      content: `Dear Support Team,

I am writing to report a critical issue with accessing my mobile banking app. Since the update last week, I have been completely unable to log in.

I have tried the following:
- Clearing browser cache and cookies
- Reinstalling the app
- Resetting my password
- Trying on both WiFi and mobile data

None of these steps have resolved the issue. The error message I receive is "Authentication failed - please try again later."

This is causing significant inconvenience as I rely on the app for daily banking and need to make an urgent payment today.

Please treat this as urgent and provide immediate assistance.

Best regards,
James Morrison`,
      timestamp: new Date().toISOString(),
      status: 'open',
      priority: 'high',
      sentiment: { score: -0.7, label: 'negative', confidence: 0.94 },
      topics: ['mobile app', 'login issue', 'authentication', 'urgent'],
      caseId: 'CASE-2024-001234',
      assignedTo: 'Sarah Johnson',
      aiClassification: {
        category: 'technical-issue',
        confidence: 0.92,
        product: 'mobile-app',
        issueType: 'Authentication Failure',
        urgency: 'high',
        rootCause:
          'Recent app update (v3.2.1) introduced authentication token expiry bug affecting customers with biometric login enabled.',
        suggestedAction:
          'Advise customer to disable biometric login temporarily and use password authentication. Escalate to engineering team for hotfix.',
        regulatoryFlags: [],
      },
      messages: [
        {
          id: 'msg-001',
          timestamp: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          sender: 'customer',
          channel: 'email',
          content:
            'I am writing to report a critical issue with accessing my mobile banking app...',
          sentiment: -0.7,
        },
        {
          id: 'msg-002',
          timestamp: new Date(
            Date.now() - 1.5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          sender: 'system',
          channel: 'email',
          content:
            'Case CASE-2024-001234 created and assigned to Sarah Johnson.',
        },
        {
          id: 'msg-003',
          timestamp: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          sender: 'agent',
          channel: 'email',
          content:
            'Dear James, Thank you for contacting us. I understand how frustrating this must be. We have identified the issue and are working on a fix. In the meantime, please try logging in with your password instead of biometrics.',
          sentiment: 0.4,
        },
      ],
    };
  }
}

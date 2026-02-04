import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { CommunicationsService } from '../../core/services/communications.service';
import {
  Communication,
  CommunicationSearchParams,
} from '../../core/models/communication.model';
import {
  CHANNELS,
  STATUSES,
  PRIORITIES,
  SENTIMENTS,
} from '../../shared/constants/app.constants';
import {
  getChannelIcon,
  getStatusClass,
  getPriorityClass,
  getSentimentClass,
} from '../../shared/utils/ui.utils';

@Component({
  selector: 'app-communications',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './communications.component.html',
  styleUrl: './communications.component.scss',
})
export class CommunicationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly communicationsService = inject(CommunicationsService);

  communications = signal<Communication[]>([]);
  totalCount = signal(0);
  loading = signal(true);
  currentPage = signal(0);
  pageSize = signal(25);

  filterForm: FormGroup;
  displayedColumns = [
    'customer',
    'subject',
    'channel',
    'sentiment',
    'priority',
    'status',
    'timestamp',
    'actions',
  ];

  // Use shared constants
  channels = [...CHANNELS];
  statuses = [...STATUSES];
  priorities = [...PRIORITIES];
  sentiments = [...SENTIMENTS];

  // Expose shared utility functions to template
  getChannelIcon = getChannelIcon;
  getStatusClass = getStatusClass;
  getPriorityClass = getPriorityClass;
  getSentimentClass = getSentimentClass;

  constructor() {
    this.filterForm = this.fb.group({
      query: [''],
      channel: [''],
      status: [''],
      priority: [''],
      sentiment: [''],
    });
  }

  ngOnInit(): void {
    // Watch for filter changes with debounce
    this.filterForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(0);
        this.loadCommunications();
      });

    this.loadCommunications();
  }

  loadCommunications(): void {
    this.loading.set(true);

    const filters = this.filterForm.value;
    const params: CommunicationSearchParams = {
      query: filters.query || undefined,
      channel: filters.channel || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      sentiment: filters.sentiment || undefined,
      page: this.currentPage() + 1,
      limit: this.pageSize(),
    };

    this.communicationsService.search(params).subscribe({
      next: (response) => {
        this.communications.set(response.data);
        this.totalCount.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load communications', err);
        // Set mock data for demo
        this.communications.set(this.getMockCommunications());
        this.totalCount.set(150);
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadCommunications();
  }

  clearFilters(): void {
    this.filterForm.reset({
      query: '',
      channel: '',
      status: '',
      priority: '',
      sentiment: '',
    });
  }

  updateStatus(communication: Communication, newStatus: string): void {
    this.communicationsService
      .updateStatus(communication.id, newStatus)
      .subscribe({
        next: (updated) => {
          const current = this.communications();
          const index = current.findIndex((c) => c.id === updated.id);
          if (index !== -1) {
            current[index] = updated;
            this.communications.set([...current]);
          }
        },
        error: (err) => console.error('Failed to update status', err),
      });
  }

  private getMockCommunications(): Communication[] {
    const mockData: Communication[] = [];
    // Retail customer names (individuals, not institutions)
    const customers = [
      { name: 'James Morrison', id: 'CUST-10234' },
      { name: 'Emma Richardson', id: 'CUST-10567' },
      { name: 'Robert Williams', id: 'CUST-10892' },
      { name: 'Sarah Thompson', id: 'CUST-11023' },
      { name: 'David Chen', id: 'CUST-11156' },
      { name: 'Lisa Patel', id: 'CUST-11289' },
      { name: "Michael O'Brien", id: 'CUST-11422' },
      { name: 'Rachel Green', id: 'CUST-11555' },
      { name: 'Thomas Wilson', id: 'CUST-11688' },
      { name: 'Sophie Brown', id: 'CUST-11821' },
    ];
    // Retail banking subjects
    const subjects = [
      'Mobile app login issue',
      'Card payment declined',
      'Direct debit query',
      'Overdraft fee dispute',
      'Mortgage rate question',
      'Savings account interest',
      'Lost/stolen card report',
      'Online banking password reset',
      'Standing order setup',
      'Statement request',
      'Account switch enquiry',
      'Credit card limit increase',
      'Fraud alert notification',
      'Branch appointment booking',
      'ISA transfer request',
    ];

    for (let i = 0; i < 25; i++) {
      const customer = customers[i % customers.length];
      mockData.push({
        id: `comm-${i}`,
        customerId: customer.id,
        customerName: customer.name,
        channel: this.channels[i % 5] as any,
        direction: i % 2 === 0 ? 'inbound' : 'outbound',
        subject: subjects[i % subjects.length],
        content: 'Sample communication content...',
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        status: this.statuses[i % 4] as any,
        priority: this.priorities[i % 4] as any,
        sentiment: {
          score: Math.random() * 2 - 1,
          label: this.sentiments[i % 4] as any,
          confidence: 0.8 + Math.random() * 0.2,
        },
        topics: ['topic1', 'topic2'],
      });
    }
    return mockData;
  }
}

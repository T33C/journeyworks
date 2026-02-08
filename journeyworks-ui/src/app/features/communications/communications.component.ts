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
      channels: filters.channel ? [filters.channel] : undefined,
      statuses: filters.status ? [filters.status] : undefined,
      priorities: filters.priority ? [filters.priority] : undefined,
      sentiments: filters.sentiment ? [filters.sentiment] : undefined,
      from: this.currentPage() * this.pageSize(),
      size: this.pageSize(),
    };

    this.communicationsService.search(params).subscribe({
      next: (response) => {
        this.communications.set(response.items);
        this.totalCount.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load communications', err);
        this.communications.set([]);
        this.totalCount.set(0);
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
}

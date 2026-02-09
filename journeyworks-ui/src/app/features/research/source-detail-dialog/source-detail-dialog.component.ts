import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CommunicationsService } from '../../../core/services/communications.service';
import { Communication } from '../../../core/models/communication.model';
import { ResearchSource } from '../../../core/services/research.service';
import {
  getChannelIcon,
  getSentimentClass,
} from '../../../shared/utils/ui.utils';

export interface SourceDetailDialogData {
  source: ResearchSource;
}

@Component({
  selector: 'app-source-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './source-detail-dialog.component.html',
  styleUrl: './source-detail-dialog.component.scss',
})
export class SourceDetailDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<SourceDetailDialogComponent>,
  );
  private readonly data = inject<SourceDetailDialogData>(MAT_DIALOG_DATA);
  private readonly communicationsService = inject(CommunicationsService);

  readonly source = this.data.source;
  communication = signal<Communication | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  getChannelIcon = getChannelIcon;
  getSentimentClass = getSentimentClass;

  ngOnInit(): void {
    if (this.source.type === 'communication' && this.source.id) {
      this.loadCommunication(this.source.id);
    } else {
      // Non-communication source - just show what we have
      this.loading.set(false);
    }
  }

  private loadCommunication(id: string): void {
    this.loading.set(true);
    this.communicationsService.getById(id).subscribe({
      next: (comm) => {
        this.communication.set(comm);
        this.loading.set(false);
      },
      error: () => {
        // Fall back to showing excerpt from source
        this.error.set('Could not load the full communication.');
        this.loading.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  openFullPage(): void {
    this.dialogRef.close({ navigateTo: this.source.id });
  }

  getSentimentLabel(score: number): string {
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  }
}

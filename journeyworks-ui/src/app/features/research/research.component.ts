import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import {
  ResearchService,
  ResearchSource,
  LiveReasoningStep,
} from '../../core/services/research.service';
import { SourceDetailDialogComponent } from './source-detail-dialog/source-detail-dialog.component';
import { InsightChartCardComponent } from '../analysis/research-panel/insight-chart-card.component';

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MarkdownPipe,
    InsightChartCardComponent,
  ],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent implements OnInit, OnDestroy, AfterViewChecked {
  // Inject the shared research service
  readonly researchService = inject(ResearchService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('queryInput') queryInput!: ElementRef;

  // Use shared state from service - these are readonly signals
  readonly messages = this.researchService.messages;
  readonly isLoading = this.researchService.isLoading;
  readonly sessionId = this.researchService.sessionId;
  readonly suggestions = this.researchService.suggestions;
  readonly lastReasoningSteps = this.researchService.lastReasoningSteps;
  readonly lastSources = this.researchService.lastSources;
  readonly isApiAvailable = this.researchService.isApiAvailable;
  readonly hasConversation = this.researchService.hasConversation;
  readonly currentContext = this.researchService.currentContext;

  // Live streaming state
  readonly liveReasoningSteps = this.researchService.liveReasoningSteps;
  readonly currentToolCall = this.researchService.currentToolCall;
  readonly currentThinkingState = this.researchService.currentThinkingState;
  readonly isStreaming = this.researchService.isStreaming;
  readonly streamStatus = this.researchService.streamStatus;
  readonly wsConnected = this.researchService.wsConnected;

  // Local component state
  currentQuery = '';
  showReasoning = false;
  currentThinking = '';

  private shouldScroll = false;

  constructor() {
    // Auto-scroll when new live reasoning steps arrive
    effect(() => {
      this.liveReasoningSteps();
      this.shouldScroll = true;
    });
  }

  ngOnInit(): void {
    // Load suggestions if no conversation exists
    if (!this.hasConversation()) {
      this.loadInitialSuggestions();
    }
    // Connect WebSocket eagerly for faster first interaction
    this.researchService.connectWebSocket();
  }

  ngOnDestroy(): void {
    // Don't disconnect - service is root-scoped and shared with dashboard
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  sendQuery(): void {
    if (!this.currentQuery.trim() || this.isLoading()) return;

    const query = this.currentQuery.trim();
    this.currentQuery = '';

    // Add user message to shared state
    this.researchService.addUserMessage(query);
    this.shouldScroll = true;

    // Use WebSocket streaming if reasoning is visible, otherwise HTTP
    if (this.showReasoning && this.wsConnected()) {
      this.currentThinking = 'Starting research...';
      this.researchService.sendMessageStreaming(query);
    } else {
      // Fall back to HTTP for non-streaming use
      this.currentThinking = 'Analyzing your question...';
      this.researchService.sendMessage(query).subscribe({
        next: (response) => {
          this.researchService.addAssistantMessage(
            response.answer,
            response.sources,
            response.charts,
          );
          this.currentThinking = '';
          this.shouldScroll = true;
        },
        error: (err) => {
          console.error('Research query failed', err);
          this.researchService.addAssistantMessage(this.getErrorMessage(err));
          this.currentThinking = '';
          this.shouldScroll = true;

          this.snackBar.open(
            'Research service unavailable. Please ensure the API is running.',
            'Dismiss',
            { duration: 5000 },
          );
        },
      });
    }
  }

  cancelResearch(): void {
    this.researchService.cancelStreaming();
    this.currentThinking = '';
  }

  useSuggestion(suggestion: string): void {
    this.currentQuery = suggestion;
    this.sendQuery();
  }

  openSourceDetail(source: ResearchSource): void {
    const dialogRef = this.dialog.open(SourceDetailDialogComponent, {
      data: { source },
      width: '700px',
      maxHeight: '85vh',
      panelClass: 'source-detail-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.navigateTo) {
        this.router.navigate(['/communications', result.navigateTo]);
      }
    });
  }

  clearConversation(): void {
    this.researchService.clearConversation();
  }

  toggleReasoning(): void {
    this.showReasoning = !this.showReasoning;
    // Connect WebSocket when reasoning is toggled on
    if (this.showReasoning && !this.wsConnected()) {
      this.researchService.connectWebSocket();
    }
  }

  getStepIcon(step: LiveReasoningStep): string {
    switch (step.status) {
      case 'thinking':
        return 'psychology';
      case 'tool-running':
        return 'build';
      case 'complete':
        return step.toolSuccess === false ? 'error' : 'check_circle';
      case 'error':
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  getStepStatusClass(step: LiveReasoningStep): string {
    return `step-${step.status}`;
  }

  private loadInitialSuggestions(): void {
    // Try to get suggestions from API
    this.researchService.getSuggestions(this.sessionId()).subscribe({
      next: (suggestions) => {
        if (suggestions?.length) {
          this.researchService.setSuggestions(suggestions);
        } else {
          this.researchService.loadDefaultSuggestions();
        }
      },
      error: () => {
        this.researchService.loadDefaultSuggestions();
      },
    });
  }

  private getErrorMessage(err: unknown): string {
    const error = err as { status?: number; message?: string };

    if (error.status === 0) {
      return `**Unable to connect to the research service.**

The API server may not be running. Please ensure:
1. The backend API is started (\`./scripts/start.sh --dev\`)
2. The service is accessible at the configured endpoint

Once the service is available, try your question again.`;
    }

    if (error.status === 503 || error.status === 502) {
      return `**The research service is temporarily unavailable.**

This may be because:
- The LLM service is initializing
- The analysis service is not running

Please wait a moment and try again.`;
    }

    if (
      error.status === 504 ||
      /timed? ?out|timeout/i.test(error.message || '')
    ) {
      return `**The analysis took too long to complete.**

The LLM provider didn't respond within the time limit. This can happen with complex queries or when the service is under heavy load.

Suggestions:
- Try a simpler or more specific question
- Break your question into smaller parts
- Wait a moment and try again`;
    }

    return `**Something went wrong while processing your request.**

Error: ${error.message || 'Unknown error'}

Please try again or rephrase your question.`;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  getSourceIcon(type: string): string {
    const icons: Record<string, string> = {
      communication: 'email',
      case: 'folder',
      customer: 'person',
      social: 'public',
      analysis: 'analytics',
    };
    return icons[type] || 'description';
  }
}

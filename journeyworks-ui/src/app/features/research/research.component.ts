import {
  Component,
  OnInit,
  inject,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import {
  ResearchService,
  ResearchSource,
} from '../../core/services/research.service';

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
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
    MatSnackBarModule,
    MarkdownPipe,
  ],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent implements OnInit, AfterViewChecked {
  // Inject the shared research service
  readonly researchService = inject(ResearchService);
  private readonly snackBar = inject(MatSnackBar);

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

  // Local component state
  currentQuery = '';
  showReasoning = false;
  currentThinking = '';

  private shouldScroll = false;

  ngOnInit(): void {
    // Load suggestions if no conversation exists
    if (!this.hasConversation()) {
      this.loadInitialSuggestions();
    }
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

    // Send to API using shared service
    this.currentThinking = 'Analyzing your question...';

    this.researchService.sendMessage(query).subscribe({
      next: (response) => {
        // Add assistant message to shared state
        this.researchService.addAssistantMessage(
          response.answer,
          response.sources,
        );
        this.currentThinking = '';
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('Research query failed', err);

        // Add error message to conversation
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

  useSuggestion(suggestion: string): void {
    this.currentQuery = suggestion;
    this.sendQuery();
  }

  clearConversation(): void {
    this.researchService.clearConversation();
  }

  toggleReasoning(): void {
    this.showReasoning = !this.showReasoning;
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

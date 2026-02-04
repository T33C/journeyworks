import {
  Component,
  OnInit,
  inject,
  signal,
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

import {
  ResearchService,
  ConversationMessage,
  ResearchSource,
  ReasoningStep,
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
  ],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent implements OnInit, AfterViewChecked {
  private readonly researchService = inject(ResearchService);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('queryInput') queryInput!: ElementRef;

  messages = signal<ConversationMessage[]>([]);
  currentQuery = '';
  isLoading = signal(false);
  sessionId = signal<string>(this.generateSessionId());
  suggestions = signal<string[]>([]);
  currentThinking = signal<string>('');
  showReasoning = signal(false);
  lastReasoningSteps = signal<ReasoningStep[]>([]);
  lastSources = signal<ResearchSource[]>([]);

  private shouldScroll = false;

  ngOnInit(): void {
    this.loadSuggestions();
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

    // Add user message
    const userMessage: ConversationMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    this.messages.update((msgs) => [...msgs, userMessage]);
    this.shouldScroll = true;

    // Send to API
    this.isLoading.set(true);
    this.currentThinking.set('Analyzing your question...');

    this.researchService
      .query({
        query,
        sessionId: this.sessionId(),
      })
      .subscribe({
        next: (response) => {
          // Add assistant message
          const assistantMessage: ConversationMessage = {
            id: this.generateMessageId(),
            role: 'assistant',
            content: response.answer,
            timestamp: new Date().toISOString(),
            sources: response.sources,
          };
          this.messages.update((msgs) => [...msgs, assistantMessage]);
          this.lastReasoningSteps.set(response.reasoning);
          this.lastSources.set(response.sources);
          this.suggestions.set(response.suggestedFollowUps);
          this.isLoading.set(false);
          this.currentThinking.set('');
          this.shouldScroll = true;
        },
        error: (err) => {
          console.error('Research query failed', err);
          // Add mock response for demo
          const mockResponse = this.getMockResponse(query);
          const assistantMessage: ConversationMessage = {
            id: this.generateMessageId(),
            role: 'assistant',
            content: mockResponse.answer,
            timestamp: new Date().toISOString(),
            sources: mockResponse.sources,
          };
          this.messages.update((msgs) => [...msgs, assistantMessage]);
          this.lastReasoningSteps.set(mockResponse.reasoning);
          this.lastSources.set(mockResponse.sources);
          this.suggestions.set(mockResponse.suggestions);
          this.isLoading.set(false);
          this.currentThinking.set('');
          this.shouldScroll = true;
        },
      });
  }

  useSuggestion(suggestion: string): void {
    this.currentQuery = suggestion;
    this.sendQuery();
  }

  clearConversation(): void {
    this.messages.set([]);
    this.sessionId.set(this.generateSessionId());
    this.lastReasoningSteps.set([]);
    this.lastSources.set([]);
    this.loadSuggestions();
  }

  toggleReasoning(): void {
    this.showReasoning.update((v) => !v);
  }

  private loadSuggestions(): void {
    this.suggestions.set([
      'What are the main customer pain points this month?',
      'Show me sentiment trends for enterprise customers',
      'Which customers are at risk of churning?',
      'Summarize escalated cases from last week',
      'What topics are trending in customer communications?',
    ]);
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

  private getMockResponse(query: string): {
    answer: string;
    sources: ResearchSource[];
    reasoning: ReasoningStep[];
    suggestions: string[];
  } {
    return {
      answer: `Based on my analysis of customer communications data, here's what I found regarding "${query}":\n\n**Key Findings:**\n\n1. **Sentiment Analysis**: Overall customer sentiment has improved by 12% over the past month, with enterprise clients showing the most positive trend.\n\n2. **Common Topics**: The most frequently discussed topics include account access (23%), portfolio performance (18%), and fee structures (15%).\n\n3. **Risk Indicators**: 8 customers are currently flagged as at-risk based on declining sentiment scores and increased complaint frequency.\n\n**Recommendations:**\n- Proactively reach out to at-risk customers\n- Address the recurring account access issues\n- Consider fee structure transparency improvements`,
      sources: [
        {
          type: 'communication',
          id: 'comm-1',
          title: 'Enterprise Client Feedback',
          snippet: 'Recent communications show positive sentiment...',
          relevanceScore: 0.92,
        },
        {
          type: 'analysis',
          id: 'analysis-1',
          title: 'Monthly Sentiment Report',
          snippet: 'Sentiment trends for March 2024...',
          relevanceScore: 0.88,
        },
        {
          type: 'case',
          id: 'case-1',
          title: 'Escalation Report',
          snippet: 'Summary of escalated cases...',
          relevanceScore: 0.75,
        },
      ],
      reasoning: [
        {
          step: 1,
          thought:
            'I need to understand what information the user is looking for',
          action: 'parse_query',
          observation: 'User wants insights about customer data',
        },
        {
          step: 2,
          thought:
            'I should search the knowledge base for relevant communications',
          action: 'search_knowledge_base',
          observation: 'Found 47 relevant documents',
        },
        {
          step: 3,
          thought: 'Let me analyze sentiment trends',
          action: 'analyze_sentiment_trends',
          observation: 'Sentiment improved 12% month-over-month',
        },
        {
          step: 4,
          thought: 'I should identify at-risk customers',
          action: 'analyze_customer_health',
          observation: '8 customers flagged as at-risk',
        },
      ],
      suggestions: [
        'Tell me more about the at-risk customers',
        'What are the specific account access issues?',
        'Compare sentiment between customer tiers',
        'Show me the top escalated cases',
      ],
    };
  }
}

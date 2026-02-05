import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ResearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/research`;

  // ============================================================================
  // SHARED CONVERSATION STATE
  // This state persists across route changes, allowing the dashboard panel
  // and research page to share the same conversation
  // ============================================================================

  /** Current session ID for the conversation */
  private _sessionId = signal<string>(this.generateSessionId());
  readonly sessionId = this._sessionId.asReadonly();

  /** All messages in the current conversation */
  private _messages = signal<ConversationMessage[]>([]);
  readonly messages = this._messages.asReadonly();

  /** Current suggested follow-up questions */
  private _suggestions = signal<string[]>([]);
  readonly suggestions = this._suggestions.asReadonly();

  /** Last reasoning steps from the agent */
  private _lastReasoningSteps = signal<ReasoningStep[]>([]);
  readonly lastReasoningSteps = this._lastReasoningSteps.asReadonly();

  /** Last sources returned */
  private _lastSources = signal<ResearchSource[]>([]);
  readonly lastSources = this._lastSources.asReadonly();

  /** Whether a query is currently in progress */
  private _isLoading = signal(false);
  readonly isLoading = this._isLoading.asReadonly();

  /** Whether the API is available */
  private _isApiAvailable = signal(true);
  readonly isApiAvailable = this._isApiAvailable.asReadonly();

  /** Current context (from dashboard selection) */
  private _currentContext = signal<ResearchContext | null>(null);
  readonly currentContext = this._currentContext.asReadonly();

  /** Whether there's an active conversation */
  readonly hasConversation = computed(() => this._messages().length > 0);

  /** Message count */
  readonly messageCount = computed(() => this._messages().length);

  // ============================================================================
  // STATE MANAGEMENT METHODS
  // ============================================================================

  /** Generate a unique session ID */
  private generateSessionId(): string {
    return `research_${crypto.randomUUID()}`;
  }

  /** Generate a unique message ID */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /** Add a user message to the conversation */
  addUserMessage(content: string): ConversationMessage {
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    this._messages.update((msgs) => [...msgs, message]);
    return message;
  }

  /** Add an assistant message to the conversation */
  addAssistantMessage(
    content: string,
    sources?: ResearchSource[],
  ): ConversationMessage {
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      sources,
    };
    this._messages.update((msgs) => [...msgs, message]);
    return message;
  }

  /** Update suggestions */
  setSuggestions(suggestions: string[]): void {
    this._suggestions.set(suggestions);
  }

  /** Set context from dashboard */
  setContext(context: ResearchContext | null): void {
    this._currentContext.set(context);
  }

  /** Set loading state */
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  /** Set API availability */
  setApiAvailable(available: boolean): void {
    this._isApiAvailable.set(available);
  }

  /** Clear the conversation and start fresh */
  clearConversation(): void {
    const currentSessionId = this._sessionId();

    // Clear server-side history
    this.clearHistory(currentSessionId).subscribe({
      error: (err) => console.warn('Failed to clear server history:', err),
    });

    // Reset local state
    this._messages.set([]);
    this._sessionId.set(this.generateSessionId());
    this._lastReasoningSteps.set([]);
    this._lastSources.set([]);
    this._currentContext.set(null);
    this.loadDefaultSuggestions();
  }

  /** Load default suggestions */
  loadDefaultSuggestions(): void {
    this._suggestions.set([
      'What are the main customer pain points this month?',
      'Show me sentiment trends for enterprise customers',
      'Which customers are at risk of churning?',
      'Summarize escalated cases from last week',
      'What topics are trending in customer communications?',
    ]);
  }

  // ============================================================================
  // API METHODS
  // ============================================================================

  /**
   * Send a research query using the conversation endpoint (ReAct agent)
   * This is the same endpoint used by the dashboard research panel
   */
  query(request: ResearchRequest): Observable<ResearchResponse> {
    // Use the conversation endpoint for full agent capabilities
    const sessionId = request.sessionId || this._sessionId();

    return this.http
      .post<AgentResponse>(`${this.baseUrl}/conversation/${sessionId}`, {
        query: request.query,
        context: request.context,
      })
      .pipe(
        map((response) => this.transformAgentResponse(response, sessionId)),
        catchError((err) => {
          console.error('Research query failed:', err);
          return throwError(() => err);
        }),
      );
  }

  /**
   * Start a new conversation and get the session ID
   */
  startConversation(): Observable<{ conversationId: string }> {
    return this.http.post<{ conversationId: string }>(
      `${this.baseUrl}/conversation`,
      {},
    );
  }

  /**
   * Continue an existing conversation - updates shared state
   */
  sendMessage(
    query: string,
    context?: ResearchContext,
  ): Observable<ResearchResponse> {
    this._isLoading.set(true);

    return this.http
      .post<AgentResponse>(
        `${this.baseUrl}/conversation/${this._sessionId()}`,
        {
          query,
          context: context || this._currentContext(),
        },
      )
      .pipe(
        map((response) => {
          const result = this.transformAgentResponse(
            response,
            this._sessionId(),
          );

          // Update shared state
          this._lastReasoningSteps.set(result.reasoning || []);
          this._lastSources.set(result.sources || []);
          if (result.suggestedFollowUps?.length) {
            this._suggestions.set(result.suggestedFollowUps);
          }
          this._isApiAvailable.set(true);
          this._isLoading.set(false);

          return result;
        }),
        catchError((err) => {
          console.error('Send message failed:', err);
          this._isApiAvailable.set(false);
          this._isLoading.set(false);
          return throwError(() => err);
        }),
      );
  }

  /**
   * Continue an existing conversation (legacy method for compatibility)
   */
  continueConversation(
    sessionId: string,
    query: string,
    context?: ResearchContext,
  ): Observable<ResearchResponse> {
    return this.http
      .post<AgentResponse>(`${this.baseUrl}/conversation/${sessionId}`, {
        query,
        context,
      })
      .pipe(
        map((response) => this.transformAgentResponse(response, sessionId)),
        catchError((err) => {
          console.error('Continue conversation failed:', err);
          return throwError(() => err);
        }),
      );
  }

  /**
   * Ask a quick question (single-turn, no conversation history)
   */
  quickQuestion(
    question: string,
    customerId?: string,
  ): Observable<{
    answer: string;
    confidence: number;
    processingTime: number;
  }> {
    return this.http.post<{
      answer: string;
      confidence: number;
      processingTime: number;
    }>(`${this.baseUrl}/quick`, { question, customerId });
  }

  /**
   * Stream research response for real-time updates
   */
  streamQuery(request: ResearchRequest): Observable<ResearchStreamEvent> {
    const subject = new Subject<ResearchStreamEvent>();

    // Use EventSource for SSE streaming
    const eventSource = new EventSource(
      `${this.baseUrl}/stream?query=${encodeURIComponent(request.query)}&sessionId=${request.sessionId || ''}`,
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as ResearchStreamEvent;
      subject.next(data);

      if (data.type === 'complete' || data.type === 'error') {
        eventSource.close();
        subject.complete();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      subject.error(new Error('Stream connection lost'));
    };

    return subject.asObservable();
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId: string): Observable<ConversationMessage[]> {
    return this.http
      .get<{
        history: ConversationTurn[];
      }>(`${this.baseUrl}/conversation/${sessionId}`)
      .pipe(
        map((response) =>
          response.history.map((turn, index) => ({
            id: `msg-${index}`,
            role: turn.role === 'user' ? 'user' : ('assistant' as const),
            content: turn.content,
            timestamp: new Date().toISOString(),
          })),
        ),
      );
  }

  /**
   * Clear conversation history
   */
  clearHistory(sessionId: string): Observable<void> {
    return this.http
      .delete<{ cleared: boolean }>(`${this.baseUrl}/conversation/${sessionId}`)
      .pipe(map(() => undefined));
  }

  /**
   * Get suggested follow-up questions based on last response
   */
  getSuggestions(sessionId: string): Observable<string[]> {
    // Suggestions come with the response, but we can also fetch examples
    return this.http
      .get<{ examples: string[] }>(`${this.baseUrl}/examples`)
      .pipe(map((response) => response.examples));
  }

  /**
   * Get available research tools
   */
  getAvailableTools(): Observable<
    Array<{ name: string; description: string }>
  > {
    return this.http
      .get<{
        tools: Array<{ name: string; description: string }>;
      }>(`${this.baseUrl}/tools`)
      .pipe(map((response) => response.tools));
  }

  /**
   * Transform the agent response to the expected ResearchResponse format
   */
  private transformAgentResponse(
    response: AgentResponse,
    sessionId: string,
  ): ResearchResponse {
    return {
      sessionId,
      answer: response.answer,
      sources: response.sources || [],
      reasoning: response.reasoning || [],
      suggestedFollowUps: response.suggestedFollowUps || [],
      processingTime: response.processingTime || 0,
    };
  }
}

// Agent response from the conversation endpoint
interface AgentResponse {
  answer: string;
  sources?: ResearchSource[];
  reasoning?: ReasoningStep[];
  suggestedFollowUps?: string[];
  processingTime?: number;
  confidence?: number;
}

// Conversation turn from history
interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Context that can be passed to research queries
export interface ResearchContext {
  customerId?: string;
  communicationId?: string;
  dateRange?: { from: string; to: string };
  // Dashboard context fields
  event?: {
    id: string;
    type: string;
    label: string;
  };
  timeWindow?: {
    start: string;
    end: string;
  };
  product?: string;
  channel?: string;
  journeyStage?: string;
  quadrant?: string;
  selectedBubble?: {
    id: string;
    date: string;
    themes?: string[];
    sentiment?: number;
  };
}

export interface ResearchRequest {
  query: string;
  sessionId?: string;
  context?: {
    customerId?: string;
    communicationId?: string;
    dateRange?: { from: string; to: string };
  };
}

export interface ResearchResponse {
  sessionId: string;
  answer: string;
  sources: ResearchSource[];
  reasoning: ReasoningStep[];
  suggestedFollowUps: string[];
  processingTime: number;
}

export interface ResearchSource {
  type: 'communication' | 'case' | 'customer' | 'social' | 'analysis';
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  url?: string;
}

export interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  observation?: string;
}

export interface ResearchStreamEvent {
  type:
    | 'thinking'
    | 'action'
    | 'observation'
    | 'answer'
    | 'source'
    | 'complete'
    | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: ResearchSource[];
}

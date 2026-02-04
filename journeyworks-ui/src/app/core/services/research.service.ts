import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ResearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/research`;

  /**
   * Send a research query to the ReAct agent
   */
  query(request: ResearchRequest): Observable<ResearchResponse> {
    return this.http.post<ResearchResponse>(`${this.baseUrl}/query`, request);
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
    return this.http.get<ConversationMessage[]>(
      `${this.baseUrl}/history/${sessionId}`,
    );
  }

  /**
   * Clear conversation history
   */
  clearHistory(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/history/${sessionId}`);
  }

  /**
   * Get suggested follow-up questions
   */
  getSuggestions(sessionId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/suggestions/${sessionId}`);
  }
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

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Communication,
  CommunicationSearchParams,
  PaginatedResponse,
  Customer,
} from '../models/communication.model';

@Injectable({
  providedIn: 'root',
})
export class CommunicationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/communications`;

  search(
    params: CommunicationSearchParams,
  ): Observable<PaginatedResponse<Communication>> {
    let httpParams = new HttpParams();

    // Simple string params
    if (params.query) {
      httpParams = httpParams.set('query', params.query);
    }
    if (params.direction) {
      httpParams = httpParams.set('direction', params.direction);
    }
    if (params.customerId) {
      httpParams = httpParams.set('customerId', params.customerId);
    }
    if (params.startDate) {
      httpParams = httpParams.set('startDate', params.startDate);
    }
    if (params.endDate) {
      httpParams = httpParams.set('endDate', params.endDate);
    }
    if (params.product) {
      httpParams = httpParams.set('product', params.product);
    }
    if (params.sortField) {
      httpParams = httpParams.set('sortField', params.sortField);
    }
    if (params.sortOrder) {
      httpParams = httpParams.set('sortOrder', params.sortOrder);
    }

    // Array params — use bracket notation so NestJS parses them as arrays
    if (params.channels?.length) {
      params.channels.forEach(
        (c) => (httpParams = httpParams.append('channels[]', c)),
      );
    }
    if (params.statuses?.length) {
      params.statuses.forEach(
        (s) => (httpParams = httpParams.append('statuses[]', s)),
      );
    }
    if (params.priorities?.length) {
      params.priorities.forEach(
        (p) => (httpParams = httpParams.append('priorities[]', p)),
      );
    }
    if (params.sentiments?.length) {
      params.sentiments.forEach(
        (s) => (httpParams = httpParams.append('sentiments[]', s)),
      );
    }
    if (params.tags?.length) {
      params.tags.forEach((t) => (httpParams = httpParams.append('tags[]', t)));
    }

    // Pagination (offset-based)
    if (params.from !== undefined) {
      httpParams = httpParams.set('from', String(params.from));
    }
    if (params.size !== undefined) {
      httpParams = httpParams.set('size', String(params.size));
    }

    return this.http.get<PaginatedResponse<Communication>>(
      `${this.baseUrl}/search`,
      { params: httpParams },
    );
  }

  getById(id: string): Observable<Communication> {
    return this.http.get<Communication>(`${this.baseUrl}/${id}`);
  }

  getByCustomer(customerId: string, size = 10): Observable<Communication[]> {
    return this.http
      .get<PaginatedResponse<Communication>>(
        `${this.baseUrl}/customer/${customerId}`,
        {
          params: { size: String(size) },
        },
      )
      .pipe(map((res) => res.items));
  }

  getRecent(limit = 10): Observable<Communication[]> {
    return this.http
      .get<PaginatedResponse<Communication>>(`${this.baseUrl}/recent`, {
        params: { limit: String(limit) },
      })
      .pipe(map((res) => res.items));
  }

  getStats(): Observable<CommunicationStats> {
    return this.http.get<CommunicationStats>(`${this.baseUrl}/stats`);
  }

  updateStatus(id: string, status: string): Observable<Communication> {
    return this.http.patch<Communication>(`${this.baseUrl}/${id}/status`, {
      status,
    });
  }

  assignTo(id: string, userId: string): Observable<Communication> {
    return this.http.patch<Communication>(`${this.baseUrl}/${id}/assign`, {
      userId,
    });
  }

  // Customer operations
  getCustomer(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${environment.apiUrl}/customers/${id}`);
  }

  getCustomerHealth(customerId: string): Observable<CustomerHealthReport> {
    return this.http.get<CustomerHealthReport>(
      `${environment.apiUrl}/customers/${customerId}/health`,
    );
  }
}

export interface CommunicationStats {
  total: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  bySentiment: Record<string, number>;
  averageResponseTime: number;
  resolvedToday: number;
  escalatedToday: number;
}

export interface CustomerHealthReport {
  customerId: string;
  customerName?: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining';
  sentimentBreakdown?: { positive: number; neutral: number; negative: number };
  riskFactors: string[];
  recentSentimentTrend?: number[];
  recommendations: string[];
  lastUpdated?: string;
}

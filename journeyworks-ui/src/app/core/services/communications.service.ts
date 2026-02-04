import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<Communication>>(
      `${this.baseUrl}/search`,
      { params: httpParams },
    );
  }

  getById(id: string): Observable<Communication> {
    return this.http.get<Communication>(`${this.baseUrl}/${id}`);
  }

  getByCustomer(customerId: string, limit = 10): Observable<Communication[]> {
    return this.http.get<Communication[]>(
      `${this.baseUrl}/customer/${customerId}`,
      {
        params: { limit: String(limit) },
      },
    );
  }

  getRecent(limit = 10): Observable<Communication[]> {
    return this.http.get<Communication[]>(`${this.baseUrl}/recent`, {
      params: { limit: String(limit) },
    });
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
      `${environment.apiUrl}/analysis/customer/${customerId}/health`,
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
  customerName: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining';
  riskFactors: string[];
  recentSentimentTrend: number[];
  recommendations: string[];
  lastUpdated: string;
}

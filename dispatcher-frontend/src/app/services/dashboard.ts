import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DispatcherStats {
  total_deliveries: number;
  active_deliveries: number;
  total_agents: number;
  active_agents: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getDispatcherStats(): Observable<DispatcherStats> {
    return this.http.get<DispatcherStats>(`${this.apiUrl}/api/dashboard/dispatcher-stats`);
  }
}

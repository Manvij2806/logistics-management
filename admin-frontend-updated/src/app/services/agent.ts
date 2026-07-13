import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Agent {
  id: number;
  fullname: string;
  username: string;
  email: string;
  phone_number: string | null;
  status: string;
  active_deliveries?: number;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/users`;

  /** All users with the Agent role, regardless of status. */
  getAgents(): Observable<Agent[]> {
    return this.http.get<Agent[]>(`${this.apiUrl}/agents`);
  }

  /** Only Agent-role users whose status is Active — the assignable pool for new deliveries. */
  getActiveAgents(): Observable<Agent[]> {
    return this.http.get<Agent[]>(`${this.apiUrl}/agents/active`);
  }
}

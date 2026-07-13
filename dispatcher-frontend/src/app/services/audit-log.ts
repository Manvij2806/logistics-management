import { Injectable, signal } from '@angular/core';

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  category: 'Assignment' | 'Status' | 'User Action' | 'Security';
  details: string;
}

const AUDIT_LOGS_KEY = 'audit_logs_data';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  logs = signal<AuditLog[]>([]);

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    const cached = localStorage.getItem(AUDIT_LOGS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AuditLog[];
        this.logs.set(parsed);
        return;
      } catch {
        // Fallback
      }
    }
    this.seedLogs();
  }

  private seedLogs(): void {
    const initial: AuditLog[] = [
      {
        id: 'LOG-001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: 'system',
        action: 'System Init',
        category: 'Security',
        details: 'Dispatcher workspace initialized'
      }
    ];
    this.save(initial);
  }

  private save(list: AuditLog[]): void {
    this.logs.set(list);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(list));
  }

  addLog(action: string, category: AuditLog['category'], details: string, username = 'dispatcher'): void {
    const list = this.logs();
    const newLog: AuditLog = {
      id: `LOG-00${list.length + 1}`,
      timestamp: new Date().toISOString(),
      user: username,
      action,
      category,
      details
    };
    this.save([newLog, ...list]);
  }
}

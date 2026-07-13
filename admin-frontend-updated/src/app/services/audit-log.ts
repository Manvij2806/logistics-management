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
    const today = new Date();
    const setTime = (hoursOffset: number, minsOffset: number) => {
      const d = new Date(today);
      d.setMinutes(d.getMinutes() - minsOffset);
      d.setHours(d.getHours() - hoursOffset);
      return d.toISOString();
    };

    const initial: AuditLog[] = [
      {
        id: 'LOG-001',
        timestamp: setTime(0, 5),
        user: 'admin',
        action: 'Delivery Status Updated',
        category: 'Status',
        details: 'Changed status of delivery DEL-209 to "Delivered"'
      },
      {
        id: 'LOG-002',
        timestamp: setTime(0, 10),
        user: 'admin',
        action: 'Delivery Agent Assigned',
        category: 'Assignment',
        details: 'Assigned agent "R. Kumar" to delivery DEL-210'
      },
      {
        id: 'LOG-003',
        timestamp: setTime(0, 25),
        user: 'admin',
        action: 'User Profile Created',
        category: 'User Action',
        details: 'Created new user account: "John Doe" with role "Customer"'
      },
      {
        id: 'LOG-004',
        timestamp: setTime(0, 40),
        user: 'admin',
        action: 'User Password Reset',
        category: 'User Action',
        details: 'Successfully reset password for user john.doe@email.com'
      },
      {
        id: 'LOG-005',
        timestamp: setTime(0, 55),
        user: 'system',
        action: 'Agent Status Change',
        category: 'Status',
        details: 'Agent V. Yadav updated status to Offline / went off duty'
      },
      {
        id: 'LOG-006',
        timestamp: setTime(2, 15),
        user: 'admin',
        action: 'User Logged In',
        category: 'Security',
        details: 'System Administrator logged in successfully from IP 192.168.1.12'
      }
    ];

    this.save(initial);
  }

  private save(list: AuditLog[]): void {
    this.logs.set(list);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(list));
  }

  addLog(action: string, category: AuditLog['category'], details: string, username = 'admin'): void {
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

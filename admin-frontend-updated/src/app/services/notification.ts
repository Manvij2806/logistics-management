import { Injectable, signal } from '@angular/core';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'success' | 'info' | 'user' | 'warning' | 'error';
  read: boolean;
}

const NOTIFICATIONS_KEY = 'notifications_data';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<NotificationItem[]>([]);
  unreadCount = signal<number>(0);

  constructor() {
    this.loadNotifications();
  }

  private loadNotifications(): void {
    const cached = localStorage.getItem(NOTIFICATIONS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NotificationItem[];
        this.notifications.set(parsed);
        this.unreadCount.set(parsed.filter(n => !n.read).length);
        return;
      } catch {
        // Fallback to seeding
      }
    }
    this.seedNotifications();
  }

  private seedNotifications(): void {
    const today = new Date();
    
    // Seed notifications from mockup with relative today stamps
    const setTime = (hours: number, minutes: number) => {
      const d = new Date(today);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    // Try to get real project data from localStorage to populate notifications dynamically
    let deliveredDeliveryId = 'DEL-004';
    let deliveredAgent = 'John Driver';
    let assignedDeliveryId = 'DEL-002';
    let assignedAgent = 'John Driver';
    let registeredUser = 'Vivank tyagi (Dispatcher)';
    let resetUserEmail = 'admin@logisticspro.com';
    let offDutyAgent = 'Rahul Transport';

    try {
      const deliveriesVal = localStorage.getItem('deliveries_data');
      if (deliveriesVal) {
        const deliveries = JSON.parse(deliveriesVal);
        if (Array.isArray(deliveries)) {
          const delivered = deliveries.find(d => d.status === 'Delivered');
          if (delivered) {
            deliveredDeliveryId = delivered.delivery_id;
            deliveredAgent = delivered.agent || 'Agent';
          }
          const assigned = deliveries.find(d => d.status === 'Assigned' || d.status === 'In Transit');
          if (assigned) {
            assignedDeliveryId = assigned.delivery_id;
            assignedAgent = assigned.agent || 'Agent';
          }
        }
      }

      const usersVal = localStorage.getItem('mock_users');
      if (usersVal) {
        const users = JSON.parse(usersVal);
        if (Array.isArray(users)) {
          const dispatcher = users.find(u => u.role === 'Dispatcher' && u.username !== 'admin');
          if (dispatcher) {
            registeredUser = `${dispatcher.full_name} (${dispatcher.role})`;
          }
          const adminUser = users.find(u => u.role === 'Admin');
          if (adminUser) {
            resetUserEmail = adminUser.email;
          }
          const agent = users.find(u => u.role === 'Agent');
          if (agent) {
            offDutyAgent = agent.full_name;
          }
        }
      }
    } catch (e) {
      // Fallback to defaults
    }

    const initial: NotificationItem[] = [
      {
        id: 'NOT-001',
        title: `Delivery ${deliveredDeliveryId} completed`,
        message: `by Agent ${deliveredAgent}`,
        timestamp: setTime(9, 5),
        type: 'success',
        read: false
      },
      {
        id: 'NOT-002',
        title: `New delivery ${assignedDeliveryId} assigned`,
        message: `to Agent ${assignedAgent}`,
        timestamp: setTime(9, 0),
        type: 'info',
        read: false
      },
      {
        id: 'NOT-003',
        title: 'New user registered',
        message: registeredUser,
        timestamp: setTime(8, 45),
        type: 'user',
        read: false
      },
      {
        id: 'NOT-004',
        title: 'Password reset successful',
        message: `for user ${resetUserEmail}`,
        timestamp: setTime(8, 30),
        type: 'warning',
        read: false
      },
      {
        id: 'NOT-005',
        title: `Agent ${offDutyAgent} went off duty`,
        message: '',
        timestamp: setTime(8, 15),
        type: 'error',
        read: false
      }
    ];

    this.save(initial);
  }

  private save(list: NotificationItem[]): void {
    this.notifications.set(list);
    this.unreadCount.set(list.filter(n => !n.read).length);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
  }

  addNotification(title: string, message: string, type: NotificationItem['type']): void {
    const list = this.notifications();
    const maxId = list.reduce((max, n) => {
      const num = parseInt(n.id.replace('NOT-', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextId = `NOT-${String(maxId + 1).padStart(3, '0')}`;

    const newItem: NotificationItem = {
      id: nextId,
      title,
      message,
      timestamp: new Date().toISOString(),
      type,
      read: false
    };
    this.save([newItem, ...list]);
  }

  markAllAsRead(): void {
    const list = this.notifications().map(n => ({ ...n, read: true }));
    this.save(list);
  }

  markAsRead(id: string): void {
    const list = this.notifications().map(n => n.id === id ? { ...n, read: true } : n);
    this.save(list);
  }
}

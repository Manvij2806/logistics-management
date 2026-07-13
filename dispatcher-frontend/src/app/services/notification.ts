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
        // Fallback
      }
    }
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
}

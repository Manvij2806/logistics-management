import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'success' | 'info' | 'warning' | 'error';
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<NotificationItem[]>([]);
  notifications$: Observable<NotificationItem[]> = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const cached = localStorage.getItem('agent_notifications');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as any[];
        const items: NotificationItem[] = parsed.map(p => ({
          ...p,
          timestamp: new Date(p.timestamp)
        }));
        this.notificationsSubject.next(items);
        this.updateUnreadCount(items);
      } catch {
        // Fallback
      }
    }
  }

  private saveToStorage(items: NotificationItem[]): void {
    this.notificationsSubject.next(items);
    this.updateUnreadCount(items);
    localStorage.setItem('agent_notifications', JSON.stringify(items));
  }

  private updateUnreadCount(items: NotificationItem[]): void {
    const count = items.filter(n => !n.read).length;
    this.unreadCountSubject.next(count);
  }

  addNotification(title: string, message: string, type: NotificationItem['type']): void {
    const items = this.notificationsSubject.value;
    const newItem: NotificationItem = {
      id: 'NOT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      title,
      message,
      timestamp: new Date(),
      type,
      read: false
    };
    this.saveToStorage([newItem, ...items]);
  }

  markAllAsRead(): void {
    const items = this.notificationsSubject.value.map((n: NotificationItem) => ({ ...n, read: true }));
    this.saveToStorage(items);
  }

  clearAll(): void {
    this.saveToStorage([]);
  }
}

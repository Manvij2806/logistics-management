import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { SearchService } from '../services/search.service';
import { AuthService } from '../services/auth.service';
import { NotificationService, NotificationItem } from '../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy, OnChanges {
  @Input() currentView: string = 'dashboard';

  searchQuery: string = '';
  private searchSub: Subscription | undefined;
  private unreadSub: Subscription | undefined;
  private notifSub: Subscription | undefined;

  unreadCount = 0;
  notificationsList: NotificationItem[] = [];
  showNotificationsDropdown = false;

  constructor(
    private searchService: SearchService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  get userName(): string {
    const user = this.authService.currentUser();
    return user ? user.full_name : 'Agent';
  }

  get userInitials(): string {
    const name = this.userName;
    if (!name) return 'A';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  get showSearch(): boolean {
    return this.currentView !== 'settings';
  }

  ngOnInit(): void {
    this.searchSub = this.searchService.searchQuery$.subscribe(query => {
      this.searchQuery = query;
    });

    this.unreadSub = this.notificationService.unreadCount$.subscribe((count: number) => {
      this.unreadCount = count;
    });

    this.notifSub = this.notificationService.notifications$.subscribe((list: NotificationItem[]) => {
      this.notificationsList = list.slice(0, 5); // show last 5 notifications
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentView'] && this.currentView === 'settings') {
      this.clearSearch();
    }
  }

  onSearchInput(): void {
    this.searchService.setQuery(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchService.setQuery('');
  }

  toggleNotificationsDropdown(): void {
    this.showNotificationsDropdown = !this.showNotificationsDropdown;
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
    this.showNotificationsDropdown = false;
  }

  clearAllNotifications(): void {
    this.notificationService.clearAll();
    this.showNotificationsDropdown = false;
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.unreadSub) {
      this.unreadSub.unsubscribe();
    }
    if (this.notifSub) {
      this.notifSub.unsubscribe();
    }
  }
}

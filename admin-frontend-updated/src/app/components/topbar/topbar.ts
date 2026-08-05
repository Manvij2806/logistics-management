import { Component, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { NotificationService, NotificationItem } from '../../services/notification';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  deliveries: 'Delivery Management',
  users: 'User Management',
  'audit-logs': 'Audit Logs',
  'logistics-ai': 'Logistics AI'
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class Topbar implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  notificationService = inject(NotificationService);

  pageTitle = signal('Dashboard');
  currentUser = this.authService.currentUser;
  
  showNotifications = signal(false);

  private sub?: Subscription;

  ngOnInit(): void {
    this.updateTitle();
    this.sub = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.getDeepestChild(this.route))
      )
      .subscribe(() => this.updateTitle());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  getUserInitials(): string {
    const name = this.currentUser()?.full_name?.trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications.update(val => !val);
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead();
  }

  viewAll(): void {
    this.closeNotifications();
    this.router.navigate(['/audit-logs']);
  }

  openAiChat(): void {
    this.closeNotifications();
    this.router.navigate(['/logistics-ai']);
  }

  formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showNotifications() && !target.closest('.notification-container')) {
      this.closeNotifications();
    }
  }

  private updateTitle(): void {
    const child = this.getDeepestChild(this.route);
    const segment = child.snapshot.url[0]?.path ?? 'dashboard';
    this.pageTitle.set(PAGE_TITLES[segment] ?? 'LogisticsPro');
  }

  private getDeepestChild(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }
}

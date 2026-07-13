import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { AuthService } from './services/auth.service';
import { DeliveryService } from './services/delivery.service';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('delivery-agent-dashboard');
  currentView = 'dashboard';
  isLoggedIn = false;
  sidebarCollapsed = false;
  private authSub: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.isLoggedIn$.subscribe(status => {
      this.isLoggedIn = status;
      if (status) {
        this.deliveryService.startPolling();
      } else {
        this.deliveryService.stopPolling();
      }
    });

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      this.authService.setTokenFromBridge(token);
      window.history.replaceState({}, document.title, '/');
      this.authService.loadCurrentUser().subscribe({
        next: (user) => {
          if (user.role !== 'Agent') {
            this.authService.clearSessionSilently();
            this.deliveryService.stopPolling();
            window.location.href = `${environment.adminAppUrl}/login`;
          } else {
            this.deliveryService.startPolling();
          }
        },
        error: () => {
          this.deliveryService.stopPolling();
          this.authService.logout();
        }
      });
    } else if (this.authService.isLoggedIn()) {
      this.authService.loadCurrentUser().subscribe({
        next: (user) => {
          if (user.role !== 'Agent') {
            this.authService.clearSessionSilently();
            this.deliveryService.stopPolling();
            window.location.href = `${environment.adminAppUrl}/login`;
          } else {
            this.deliveryService.startPolling();
          }
        },
        error: () => {
          this.deliveryService.stopPolling();
          this.authService.logout();
        }
      });
    } else {
      this.deliveryService.stopPolling();
      this.authService.logout();
    }
  }

  onViewChanged(view: string): void {
    this.currentView = view;
  }

  onCollapseChanged(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
  }

  ngOnDestroy(): void {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    this.deliveryService.stopPolling();
  }
}

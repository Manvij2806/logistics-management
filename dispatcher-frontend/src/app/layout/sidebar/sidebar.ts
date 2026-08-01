import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DeliveryService } from '../../services/delivery.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  public router = inject(Router);
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  private routerSub!: Subscription;

  isCollapsed = false;
  isDeliveriesExpanded = true;
  isAssignAgentExpanded = true;
  currentDeliveryId: number | null = null;

  ngOnInit() {
    const savedId = sessionStorage.getItem('lastActiveDeliveryId');
    const targetId = savedId && !isNaN(Number(savedId)) ? Number(savedId) : null;

    this.deliveryService.getDeliveries().subscribe({
      next: (deliveries) => {
        if (deliveries && deliveries.length > 0) {
          const exists = deliveries.some(d => d.id === targetId);
          if (exists && targetId !== null) {
            this.currentDeliveryId = targetId;
          } else {
            this.currentDeliveryId = deliveries[0].id;
            sessionStorage.setItem('lastActiveDeliveryId', this.currentDeliveryId.toString());
          }
        } else {
          this.currentDeliveryId = null;
          sessionStorage.removeItem('lastActiveDeliveryId');
        }
      },
      error: () => {
        this.currentDeliveryId = null;
      }
    });

    // Subscribe to route changes to capture active delivery IDs
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.extractDeliveryId(event.urlAfterRedirects);
    });

    // Run once initially
    this.extractDeliveryId(this.router.url);
  }

  ngOnDestroy() {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private extractDeliveryId(url: string) {
    const match = url.match(/\/deliveries\/(\d+)/);
    if (match) {
      const id = Number(match[1]);
      this.currentDeliveryId = id;
      sessionStorage.setItem('lastActiveDeliveryId', id.toString());
    } else if (url === '/deliveries') {
      this.currentDeliveryId = null;
      sessionStorage.removeItem('lastActiveDeliveryId');
    }
  }

  isDeliveriesActive(): boolean {
    const url = this.router.url;
    return url.startsWith('/deliveries') && !url.includes('/create');
  }

  isAssignAgentActive(): boolean {
    const url = this.router.url;
    return (
      url.includes('/details') ||
      url.includes('/select-agent')
    ) && url.includes('/deliveries/');
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleDeliveries() {
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.isDeliveriesExpanded = true;
      return;
    }
    this.isDeliveriesExpanded = !this.isDeliveriesExpanded;
  }

  toggleAssignAgent(event: Event) {
    event.stopPropagation();
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.isAssignAgentExpanded = true;
      return;
    }
    this.isAssignAgentExpanded = !this.isAssignAgentExpanded;
  }

  logout() {
    this.authService.logout();
  }
}

import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DashboardService, DispatcherStats } from '../../services/dashboard';
import { DeliveryService, DeliveryResponse } from '../../services/delivery.service';
import { NotificationService } from '../../services/notification';
import { Subscription, interval } from 'rxjs';
import { startWith } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private deliveryService = inject(DeliveryService);
  private notificationService = inject(NotificationService);
  public router = inject(Router);

  stats = signal<DispatcherStats | null>(null);
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  private previousDeliveries: DeliveryResponse[] = [];
  private pollSub?: Subscription;

  ngOnInit(): void {
    this.loadStats();
    
    // Poll deliveries every 5 seconds to track payment transitions
    this.pollSub = interval(5000)
      .pipe(startWith(0))
      .subscribe(() => {
        this.checkPayments();
      });
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.dashboardService.getDispatcherStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load dashboard stats.');
        this.isLoading.set(false);
      },
    });
  }

  checkPayments(): void {
    this.deliveryService.getDeliveries().subscribe({
      next: (deliveries) => {
        if (this.previousDeliveries.length > 0) {
          deliveries.forEach(newD => {
            const oldD = this.previousDeliveries.find(o => o.id === newD.id);
            if (oldD && oldD.payment_status !== 'Paid' && newD.payment_status === 'Paid') {
              this.notificationService.addNotification(
                'Payment Received',
                `Payment of ₹2,000 received for delivery ${newD.delivery_id}!`,
                'success'
              );
            }
          });
        }
        this.previousDeliveries = deliveries;
      }
    });
  }

  refreshStats(): void {
    this.loadStats();
  }

  ngOnDestroy(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }
}

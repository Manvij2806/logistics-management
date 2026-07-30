import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { DeliveryService } from '../../services/delivery.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-stats-cards',
  standalone: false,
  templateUrl: './stats-cards.component.html',
  styleUrl: './stats-cards.component.scss',
})
export class StatsCardsComponent implements OnInit, OnDestroy {
  stats = [
    { label: 'Agent Name', value: 'Loading...', icon: 'person', iconBg: '#4169e1' },
    { label: 'Total Earnings', value: 'Rs. 0', icon: 'account_balance_wallet', iconBg: '#12b76a' },
    { label: 'Total Distance', value: '0 km', icon: 'straighten', iconBg: '#f79009' },
  ];

  private deliveriesSub: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.deliveriesSub = this.deliveryService.deliveries$.subscribe((deliveries) => {
      const user = this.authService.currentUser();
      const agentName = user ? user.full_name : 'Agent';

      let totalDistance = 0;
      let totalEarnings = 0;

      deliveries.forEach((d) => {
        if (d.status === 'Delivered') {
          const pCoords = this.deliveryService.getCoords(d.pickup_address);
          const dCoords = this.deliveryService.getCoords(d.drop_address);
          const dist = this.deliveryService.calculateDistance(
            pCoords[0],
            pCoords[1],
            dCoords[0],
            dCoords[1],
          );
          const earnVal = 2000;

          totalDistance += dist;
          totalEarnings += earnVal;
        }
      });

      this.stats = [
        { label: 'Agent Name', value: agentName, icon: 'person', iconBg: '#4169e1' },
        {
          label: 'Total Earnings',
          value: `Rs. ${totalEarnings.toLocaleString('en-IN')}`,
          icon: 'account_balance_wallet',
          iconBg: '#12b76a',
        },
        {
          label: 'Total Distance',
          value: `${totalDistance.toLocaleString()} km`,
          icon: 'straighten',
          iconBg: '#f79009',
        },
      ];
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.deliveriesSub) {
      this.deliveriesSub.unsubscribe();
    }
  }
}

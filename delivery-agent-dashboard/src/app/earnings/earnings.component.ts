import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DeliveryService } from '../services/delivery.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-earnings-report',
  standalone: false,
  templateUrl: './earnings.component.html',
  styleUrl: './earnings.component.scss'
})
export class EarningsReportComponent implements OnInit, OnDestroy {
  earningsSummary = {
    today: '₹ 0',
    weekly: '₹ 0',
    avgPerTrip: '₹ 0'
  };

  dailyEarnings = [
    { day: 'Mon', amount: 0, height: '10%' },
    { day: 'Tue', amount: 0, height: '10%' },
    { day: 'Wed', amount: 0, height: '10%' },
    { day: 'Thu', amount: 0, height: '10%' },
    { day: 'Fri', amount: 0, height: '10%' },
    { day: 'Sat', amount: 0, height: '10%' },
    { day: 'Sun', amount: 0, height: '10%' }
  ];

  transactions: any[] = [];
  private deliveriesSub: Subscription | undefined;

  constructor(
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.deliveriesSub = this.deliveryService.deliveries$.subscribe(deliveries => {
      const delivered = deliveries.filter(d => d.status === 'Delivered');

      let todaySum = 0;
      let weeklySum = 0;
      let totalSum = 0;

      const now = new Date();
      const todayStr = now.toDateString();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      const weekEarningsMap: { [key: string]: number } = {
        'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
      };

      this.transactions = delivered.map(d => {
        const pCoords = this.deliveryService.getCoords(d.pickup_address);
        const dCoords = this.deliveryService.getCoords(d.drop_address);
        const dist = this.deliveryService.calculateDistance(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
        const earnVal = this.deliveryService.getEarnings(dist);

        const dDate = new Date(d.created_at);

        if (dDate.toDateString() === todayStr) {
          todaySum += earnVal;
        }

        if (dDate >= sevenDaysAgo) {
          weeklySum += earnVal;
        }

        totalSum += earnVal;

        const dayName = dDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (dayName in weekEarningsMap) {
          weekEarningsMap[dayName] += earnVal;
        }

        return {
          id: `TXN-${String(d.id).padStart(3, '0')}`,
          date: d.created_at.split('T')[0],
          orderId: d.delivery_id,
          amount: `₹ ${earnVal.toLocaleString('en-IN')}`,
          status: 'Completed'
        };
      });

      const avg = delivered.length > 0 ? Math.round(totalSum / delivered.length) : 0;

      this.earningsSummary = {
        today: `₹ ${todaySum.toLocaleString('en-IN')}`,
        weekly: `₹ ${weeklySum.toLocaleString('en-IN')}`,
        avgPerTrip: `₹ ${avg.toLocaleString('en-IN')}`
      };

      const maxDayAmt = Math.max(...Object.values(weekEarningsMap), 1000);
      this.dailyEarnings = Object.keys(weekEarningsMap).map(day => {
        const amt = weekEarningsMap[day];
        const heightPercent = Math.max(10, Math.min(100, Math.round((amt / maxDayAmt) * 100)));
        return {
          day,
          amount: amt,
          height: `${heightPercent}%`
        };
      });
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.deliveriesSub) {
      this.deliveriesSub.unsubscribe();
    }
  }
}

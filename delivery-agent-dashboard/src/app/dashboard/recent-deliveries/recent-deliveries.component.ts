import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SearchService } from '../../services/search.service';
import { DeliveryService } from '../../services/delivery.service';
import { Subscription } from 'rxjs';

export interface PastDelivery {
  date: string;
  deliveryId: string;
  trackingNumber: string;
  deliveryIdAlt: string;
  currentDistance: string;
  earnings: string;
  status: string;
}

@Component({
  selector: 'app-recent-deliveries',
  standalone: false,
  templateUrl: './recent-deliveries.component.html',
  styleUrl: './recent-deliveries.component.scss',
})
export class RecentDeliveriesComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'date',
    'deliveryId',
    'trackingNumber',
    'deliveryIdAlt',
    'currentDistance',
    'earnings',
    'status',
  ];

  activeFilter = 'all';
  searchText = '';
  selectedDate = '';
  private searchSub: Subscription | undefined;
  private deliveriesSub: Subscription | undefined;

  filters = [
    { label: 'All', value: 'all', color: '#4361e8' },
    { label: 'Delivered', value: 'delivered', color: '#4caf50' },
    { label: 'Cancelled', value: 'cancelled', color: '#f44336' },
  ];

  allData: PastDelivery[] = [];
  dataSource = [...this.allData];

  constructor(
    private searchService: SearchService,
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.deliveryService.loadAgentDeliveries();

    this.deliveriesSub = this.deliveryService.deliveries$.subscribe((deliveries) => {
      this.allData = deliveries.map((d) => {
        const pCoords = this.deliveryService.getCoords(d.pickup_address);
        const dCoords = this.deliveryService.getCoords(d.drop_address);
        const dist = this.deliveryService.calculateDistance(
          pCoords[0],
          pCoords[1],
          dCoords[0],
          dCoords[1]
        );
        const earnVal = this.deliveryService.getEarnings(dist);

        let formattedDate = 'N/A';
        if (d.created_at) {
          try {
            const dateObj = new Date(d.created_at);
            if (!isNaN(dateObj.getTime())) {
              formattedDate = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            }
          } catch (e) {
            // fallback
          }
        }

        return {
          date: formattedDate,
          deliveryId: d.delivery_id,
          trackingNumber: d.tracking_number || '',
          deliveryIdAlt: '',
          currentDistance: `${dist} km`,
          earnings: `Rs. ${earnVal.toLocaleString('en-IN')}`,
          status: d.status,
        };
      });
      this.applyFilters();
      this.cdr.detectChanges();
    });

    this.searchSub = this.searchService.searchQuery$.subscribe((query) => {
      this.searchText = query;
      this.applyFilters();
    });
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  clearDateFilter(): void {
    this.selectedDate = '';
    this.applyFilters();
  }

  onLocalSearchChange(): void {
    this.searchService.setQuery(this.searchText);
  }

  clearSearch(): void {
    this.searchText = '';
    this.searchService.setQuery('');
  }

  clearAllFilters(): void {
    this.activeFilter = 'all';
    this.selectedDate = '';
    this.clearSearch();
  }

  formatDateToISO(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const month = '' + (d.getMonth() + 1);
      const day = '' + d.getDate();
      const year = d.getFullYear();
      return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    } catch (e) {
      return '';
    }
  }

  applyFilters(): void {
    let data = [...this.allData];

    if (this.activeFilter !== 'all') {
      data = data.filter((d) => d.status.toLowerCase() === this.activeFilter);
    }

    if (this.searchText.trim()) {
      const term = this.searchText.toLowerCase().trim();
      data = data.filter(
        (d) =>
          d.date.toLowerCase().includes(term) ||
          d.deliveryId.toLowerCase().includes(term) ||
          d.trackingNumber.toLowerCase().includes(term) ||
          d.status.toLowerCase().includes(term) ||
          d.earnings.toLowerCase().includes(term) ||
          d.currentDistance.toLowerCase().includes(term),
      );
    }

    if (this.selectedDate) {
      data = data.filter((d) => this.formatDateToISO(d.date) === this.selectedDate);
    }

    this.dataSource = data;
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.deliveriesSub) {
      this.deliveriesSub.unsubscribe();
    }
  }
}

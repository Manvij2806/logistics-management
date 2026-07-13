import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeliveryService, Delivery } from '../../services/delivery';

export interface CustomerGroup {
  name: string;
  phone: string;
  totalDeliveries: number;
  activeDeliveries: number;
  deliveries: Delivery[];
  lastDeliveryDate: string;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css'
})
export class Customers implements OnInit {
  private deliveryService = inject(DeliveryService);

  deliveries = signal<Delivery[]>([]);
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  searchQuery = signal('');

  selectedCustomer = signal<CustomerGroup | null>(null);
  showCustomerDetails = signal(false);

  ngOnInit(): void {
    this.fetchDeliveries();
  }

  fetchDeliveries(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.deliveryService.getDeliveries({ page_size: 100 }).subscribe({
      next: (res) => {
        this.deliveries.set(res.deliveries);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load customers and deliveries.');
        this.isLoading.set(false);
      }
    });
  }

  // Aggregates and groups deliveries by unique customer name and phone combination
  customerGroups = computed(() => {
    const list = this.deliveries();
    const groupsMap = new Map<string, CustomerGroup>();

    list.forEach(d => {
      // Create a unique key for each customer grouping
      const key = `${d.customer_name.trim().toLowerCase()}|||${d.customer_phone.trim()}`;
      const isActive = ['Pending', 'Assigned', 'Picked Up', 'In Transit'].includes(d.status);

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          name: d.customer_name,
          phone: d.customer_phone,
          totalDeliveries: 1,
          activeDeliveries: isActive ? 1 : 0,
          deliveries: [d],
          lastDeliveryDate: d.created_at
        });
      } else {
        const group = groupsMap.get(key)!;
        group.totalDeliveries += 1;
        if (isActive) {
          group.activeDeliveries += 1;
        }
        group.deliveries.push(d);
        // Track the latest created_at date
        if (new Date(d.created_at) > new Date(group.lastDeliveryDate)) {
          group.lastDeliveryDate = d.created_at;
        }
      }
    });

    return Array.from(groupsMap.values());
  });

  filteredCustomers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const groups = this.customerGroups();
    if (!query) return groups;

    return groups.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query)
    );
  });

  viewCustomerDetails(customer: CustomerGroup): void {
    this.selectedCustomer.set(customer);
    this.showCustomerDetails.set(true);
  }

  getCustomerBilling(customer: CustomerGroup): number {
    const completedCount = customer.deliveries.filter(d => d.status === 'Delivered').length;
    return completedCount * 2000;
  }

  closeDetails(): void {
    this.selectedCustomer.set(null);
    this.showCustomerDetails.set(false);
  }

  getDeliveryStatusClass(status: string): string {
    const map: Record<string, string> = {
      Delivered: 'status-delivered',
      'In Transit': 'status-in-transit',
      'Picked Up': 'status-picked-up',
      Assigned: 'status-assigned',
      Pending: 'status-pending',
      Cancelled: 'status-cancelled',
      Unassigned: 'status-unassigned',
    };
    return map[status] ?? 'status-pending';
  }
}

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DeliveryService, DeliveryCreate } from '../../../services/delivery.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-select-agent',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, TagModule, InputTextModule, SelectModule],
  templateUrl: './select-agent.html',
  styleUrl: './select-agent.scss'
})
export class SelectAgent implements OnInit {
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private deliveryService = inject(DeliveryService);

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  delivery: any = null;
  selectedAgent: any = null;
  searchTerm = '';
  loading = true;
  saving = false;

  // Filter selections
  selectedZone = 'All Zones';
  selectedStatus = 'All Status';
  selectedVehicleType = 'All Vehicle Type';

  // Filter dropdown lists
  zones = ['All Zones', 'Agra City', 'Electronic City', 'Sanjay Place', 'Tajganj'];
  statuses = ['All Status', 'Available', 'Busy'];
  vehicleTypes = ['All Vehicle Type', 'Bike', 'Scooter'];

  // Pagination state
  currentPage = 1;
  pageSize = 6;

  agents: any[] = [];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.deliveryService.getDelivery(Number(id)).subscribe({
        next: (res) => {
          this.delivery = res;
          this.loadAgents();
        },
        error: (err) => {
          console.error('Error fetching delivery details:', err);
          this.loading = false;
          alert('Delivery not found. Redirecting to deliveries list.');
          this.router.navigate(['/deliveries']);
        }
      });
    } else {
      this.loadAgents();
    }
  }

  loadAgents() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/users/agents/active`).subscribe({
      next: (res) => {
        try {
          const styleColors = [
            { color: '#f97316', boxColor: '#ef4444', boxStripeColor: '#b91c1c' },
            { color: '#3b82f6', boxColor: '#10b981', boxStripeColor: '#047857' },
            { color: '#10b981', boxColor: '#f59e0b', boxStripeColor: '#b45309' },
            { color: '#8b5cf6', boxColor: '#ec4899', boxStripeColor: '#be185d' }
          ];
          
          this.agents = (res || []).map((a, i) => {
            const style = styleColors[i % styleColors.length];
            return {
              id: a.id,
              name: a.fullname || '',
              phone: a.phone_number || '+91 99887 76655',
              startArea: i % 2 === 0 ? 'Agra City' : 'Electronic City',
              vehicleType: i % 2 === 0 ? 'Bike' : 'Scooter',
              status: a.status || 'Available',
              activeDeliveries: a.active_deliveries || 0,
              maxDeliveries: 10,
              performed: 90 + (a.id % 10),
              distance: parseFloat((2.0 + (a.id % 5) * 0.7).toFixed(1)),
              ...style
            };
          });
        } catch (e) {
          console.error('Error during active agents mapping:', e);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error loading active agents', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredAgents() {
    return this.agents.filter(a => {
      const term = this.searchTerm.toLowerCase();
      const matchesSearch = !term ||
        a.name.toLowerCase().includes(term) ||
        a.phone.replace(/\s+/g, '').includes(term.replace(/\s+/g, ''));

      const matchesZone = this.selectedZone === 'All Zones' || a.startArea === this.selectedZone;
      const matchesStatus = this.selectedStatus === 'All Status' || a.status === this.selectedStatus;
      const matchesVehicle = this.selectedVehicleType === 'All Vehicle Type' || a.vehicleType === this.selectedVehicleType;

      return matchesSearch && matchesZone && matchesStatus && matchesVehicle;
    });
  }

  get paginatedAgents() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAgents.slice(start, start + this.pageSize);
  }

  get startIndex() {
    if (this.filteredAgents.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex() {
    const end = this.currentPage * this.pageSize;
    const count = this.filteredAgents.length;
    return end > count ? count : end;
  }

  get totalPages() {
    return Math.ceil(this.filteredAgents.length / this.pageSize) || 1;
  }

  get pagesArray() {
    const arr = [];
    for (let i = 1; i <= this.totalPages; i++) {
      arr.push(i);
    }
    return arr;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  setPage(page: number) {
    this.currentPage = page;
  }

  onFilterChange() {
    this.currentPage = 1;
  }

  selectAgent(agent: any) {
    this.selectedAgent = agent;
  }

  refreshAgents() {
    this.loading = true;
    this.loadAgents();
  }

  getStatusSeverity(status: string): any {
    const map: any = { 'Available': 'success', 'Busy': 'warn', 'Overloaded': 'danger' };
    return map[status];
  }

  assignAgent() {
    if (!this.selectedAgent || !this.delivery) return;
    this.saving = true;

    const payload: DeliveryCreate = {
      pickup_address: this.delivery.pickup_address,
      drop_address: this.delivery.drop_address,
      customer_name: this.delivery.customer_name,
      customer_phone: this.delivery.customer_phone,
      status: 'Assigned',
      agent: this.selectedAgent.name,
      agent_id: this.selectedAgent.id,
      accepted: 'Pending',
      notes: this.delivery.notes
    };

    this.deliveryService.updateDelivery(this.delivery.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/deliveries', this.delivery.id, 'details']);
      },
      error: (err) => {
        console.error('Error assigning agent', err);
        this.saving = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/deliveries', this.delivery?.id, 'details']);
  }

  getStrokeDashArray(): string {
    if (!this.selectedAgent) return '0, 100';
    const pct = this.getUtilizationPercent();
    return `${pct}, ${100 - pct}`;
  }

  getUtilizationPercent(): number {
    if (!this.selectedAgent) return 0;
    return Math.round((this.selectedAgent.activeDeliveries / this.selectedAgent.maxDeliveries) * 100);
  }

  getEstimatedPickupTime(): string {
    return '11:30 AM';
  }
}

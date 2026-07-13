import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DeliveryService } from '../../../services/delivery.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-agent-workload',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, TagModule, InputTextModule, SelectModule],
  templateUrl: './agent-workload.html',
  styleUrl: './agent-workload.scss'
})
export class AgentWorkload implements OnInit {
  public router = inject(Router);
  private deliveryService = inject(DeliveryService);

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  searchTerm = '';
  selectedZone = 'All Zones';
  selectedStatus = 'All Status';

  // Dropdown options
  zones = ['All Zones', 'Agra City', 'Electronic City', 'Sanjay Place', 'Tajganj'];
  statuses = ['All Status', 'Available', 'Busy', 'Overloaded'];

  // Pagination state
  currentPage = 1;
  pageSize = 5;

  // Global counts & KPIs
  totalAgents = 0;
  availableAgents = 0;
  busyAgents = 0;
  overloadedAgents = 0;
  avgWorkload = 0;

  agents: any[] = [];

  ngOnInit() {
    this.loadAgents();
  }

  loadAgents() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/users/agents`).subscribe({
      next: (res) => {
        try {
          const styleColors = [
            { color: '#f97316', boxColor: '#ef4444', boxStripeColor: '#b91c1c' },
            { color: '#3b82f6', boxColor: '#10b981', boxStripeColor: '#047857' },
            { color: '#10b981', boxColor: '#f59e0b', boxStripeColor: '#b45309' },
            { color: '#8b5cf6', boxColor: '#ec4899', boxStripeColor: '#be185d' },
            { color: '#ec4899', boxColor: '#f59e0b', boxStripeColor: '#b45309' },
            { color: '#ef4444', boxColor: '#3b82f6', strokeStripeColor: '#1d4ed8' },
            { color: '#06b6d4', boxColor: '#10b981', boxStripeColor: '#047857' }
          ];

          this.agents = (res || []).map((a, i) => {
            const style = styleColors[i % styleColors.length];
            const active = a.active_deliveries || 0;
            const capacity = 5;
            let status = 'Available';
            if (active > capacity) {
              status = 'Overloaded';
            } else if (active > 2) {
              status = 'Busy';
            }
            
            return {
              id: a.id,
              name: a.fullname || '',
              phone: a.phone_number || '+91 99887 76655',
              zone: i % 3 === 0 ? 'Agra City' : i % 3 === 1 ? 'Electronic City' : 'Tajganj',
              active: active,
              capacity: capacity,
              status: status,
              nextAvailable: active > 0 ? 'Today, 05:00 PM' : 'Immediate',
              ...style
            };
          });
          
          this.recalculateKPIs();
        } catch (e) {
          console.error('Error during agents mapping:', e);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error loading workload agents', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  recalculateKPIs() {
    // Dynamic recalculation representing current state
    this.totalAgents = this.agents.length;
    this.availableAgents = this.agents.filter(a => a.status === 'Available').length;
    this.busyAgents = this.agents.filter(a => a.status === 'Busy').length;
    this.overloadedAgents = this.agents.filter(a => a.status === 'Overloaded').length;

    const totalActive = this.agents.reduce((sum, a) => sum + a.active, 0);
    const totalCapacity = this.agents.reduce((sum, a) => sum + a.capacity, 0);
    this.avgWorkload = totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0;
  }

  get availablePercent(): number {
    return this.totalAgents > 0 ? Math.round((this.availableAgents / this.totalAgents) * 100) : 0;
  }

  get busyPercent(): number {
    return this.totalAgents > 0 ? Math.round((this.busyAgents / this.totalAgents) * 100) : 0;
  }

  get overloadedPercent(): number {
    if (this.totalAgents === 0) return 0;
    return 100 - (this.availablePercent + this.busyPercent);
  }

  get availableDashArray(): string {
    return `${this.availablePercent} ${100 - this.availablePercent}`;
  }

  get busyDashArray(): string {
    return `${this.busyPercent} ${100 - this.busyPercent}`;
  }

  get overloadedDashArray(): string {
    return `${this.overloadedPercent} ${100 - this.overloadedPercent}`;
  }

  get busyDashOffset(): number {
    return -this.availablePercent;
  }

  get overloadedDashOffset(): number {
    return -(this.availablePercent + this.busyPercent);
  }

  get filteredAgents() {
    return this.agents.filter(a => {
      const term = this.searchTerm.toLowerCase();
      const matchesSearch = !term ||
        a.name.toLowerCase().includes(term) ||
        a.phone.replace(/\s+/g, '').includes(term.replace(/\s+/g, '')) ||
        a.zone.toLowerCase().includes(term);

      const matchesZone = this.selectedZone === 'All Zones' || a.zone === this.selectedZone;
      const matchesStatus = this.selectedStatus === 'All Status' || a.status === this.selectedStatus;

      return matchesSearch && matchesZone && matchesStatus;
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

  refreshWorkload() {
    this.loading = true;
    this.loadAgents();
  }

  getWorkloadPercentage(agent: any): number {
    if (!agent.capacity) return 0;
    return Math.round((agent.active / agent.capacity) * 100);
  }

  getDonutStrokeDashArray(percentage: number): string {
    return `${percentage}, ${100 - percentage}`;
  }

  reassignDeliveries(agent: any) {
    alert(`Initiating load reassignment for ${agent.name}...`);
  }
}

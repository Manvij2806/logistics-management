import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent } from '../../services/agent';
import { DeliveryService, Delivery } from '../../services/delivery';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agents.html',
  styleUrl: './agents.css'
})
export class Agents implements OnInit {
  private agentService = inject(AgentService);
  private deliveryService = inject(DeliveryService);

  agents = signal<Agent[]>([]);
  deliveries = signal<Delivery[]>([]);
  
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  searchQuery = signal('');

  selectedAgent = signal<Agent | null>(null);
  showAgentDeliveries = signal(false);

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    
    // Fetch agents and deliveries in parallel
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents.set(agents);
        
        this.deliveryService.getDeliveries({ page_size: 100 }).subscribe({
          next: (res) => {
            this.deliveries.set(res.deliveries);
            this.isLoading.set(false);
          },
          error: () => {
            this.loadError.set('Failed to load deliveries. Please try again.');
            this.isLoading.set(false);
          }
        });
      },
      error: () => {
        this.loadError.set('Failed to load agents. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  filteredAgents = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.agents();
    
    return this.agents().filter(a => 
      a.fullname.toLowerCase().includes(query) ||
      a.email.toLowerCase().includes(query) ||
      (a.phone_number && a.phone_number.includes(query))
    );
  });

  getAgentActiveDeliveries(agentName: string): Delivery[] {
    return this.deliveries().filter(d => 
      d.agent === agentName && 
      ['Assigned', 'Picked Up', 'In Transit'].includes(d.status)
    );
  }

  getAgentEarnings(agentName: string): number {
    const completedCount = this.deliveries().filter(d => 
      d.agent === agentName && d.status === 'Delivered'
    ).length;
    return completedCount * 2000;
  }

  viewAgentDetails(agent: Agent): void {
    this.selectedAgent.set(agent);
    this.showAgentDeliveries.set(true);
  }

  closeDetails(): void {
    this.selectedAgent.set(null);
    this.showAgentDeliveries.set(false);
  }

  getStatusClass(status: string): string {
    return status === 'Active' ? 'status-active' : 'status-inactive';
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

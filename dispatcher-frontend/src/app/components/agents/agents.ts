import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent } from '../../services/agent';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agents.html',
  styleUrl: './agents.css',
})
export class Agents implements OnInit {
  private agentService = inject(AgentService);

  agents = signal<Agent[]>([]);
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  searchQuery = signal('');

  filteredAgents = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.agents();
    return this.agents().filter(
      (a) =>
        a.fullname.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query) ||
        (a.phone_number ?? '').toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.fetchAgents();
  }

  fetchAgents(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents.set(agents);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load agents.');
        this.isLoading.set(false);
      },
    });
  }
}

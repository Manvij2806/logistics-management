import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DispatcherStats } from '../../services/dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard implements OnInit {
  private dashboardService = inject(DashboardService);

  stats = signal<DispatcherStats | null>(null);
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStats();
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
}

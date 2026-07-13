import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService, AuditLog } from '../../services/audit-log';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css'
})
export class AuditLogs {
  private auditLogService = inject(AuditLogService);

  searchQuery = signal<string>('');
  categoryFilter = signal<string>('');
  
  page = signal(1);
  pageSize = signal(10);

  readonly categories = ['Assignment', 'Status', 'User Action', 'Security'];

  filteredLogs = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.categoryFilter();
    let list = this.auditLogService.logs();

    if (cat) {
      list = list.filter(l => l.category === cat);
    }

    if (query) {
      list = list.filter(l => 
        l.action.toLowerCase().includes(query) ||
        l.details.toLowerCase().includes(query) ||
        l.user.toLowerCase().includes(query) ||
        l.id.toLowerCase().includes(query)
      );
    }

    return list;
  });

  totalPages = computed(() => {
    const total = this.filteredLogs().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  paginatedLogs = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return this.filteredLogs().slice(start, end);
  });

  totalLogsCount = computed(() => this.filteredLogs().length);

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.page.set(1);
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value);
    this.page.set(1);
  }

  goToPage(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > this.totalPages()) return;
    this.page.set(pageNumber);
  }

  getCategoryClass(category: AuditLog['category']): string {
    const map: Record<AuditLog['category'], string> = {
      Security: 'cat-security',
      Status: 'cat-status',
      Assignment: 'cat-assignment',
      'User Action': 'cat-user'
    };
    return map[category] ?? 'cat-status';
  }
}

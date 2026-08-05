import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  private authService = inject(AuthService);

  isExpanded = signal(true);
  searchQuery = signal('');

  private navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Deliveries', route: '/deliveries', icon: 'deliveries' },
    { label: 'Agents', route: '/agents', icon: 'agents' },
    { label: 'Logistics AI', route: '/logistics-ai', icon: 'assistant' },
  ];

  filteredNavItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.navItems.filter((item) => !query || item.label.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    const savedExpanded = localStorage.getItem('dispatcherSidebarExpanded');
    if (savedExpanded !== null) {
      this.isExpanded.set(savedExpanded === 'true');
    }
  }

  toggle(): void {
    const next = !this.isExpanded();
    this.isExpanded.set(next);
    localStorage.setItem('dispatcherSidebarExpanded', String(next));
  }

  logout(): void {
    this.authService.logout();
  }
}

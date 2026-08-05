import { Component, OnInit, inject, computed, signal } from '@angular/core';

import { CommonModule } from '@angular/common';

import { RouterLink, RouterLinkActive } from '@angular/router';

import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth';

interface NavItem {
  label: string;

  route: string;

  icon: string;

  /** If set, only users whose role is in this list see the nav item. Omit for "all logged-in roles". */
  roles?: string[];
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
    { label: 'Deliveries', route: '/deliveries', icon: 'deliveries', roles: ['Admin', 'Dispatcher'] },
    { label: 'Agents & Workloads', route: '/agents', icon: 'agents', roles: ['Admin'] },
    { label: 'Customers History', route: '/customers', icon: 'customers', roles: ['Admin'] },
    { label: 'User Management', route: '/users', icon: 'users', roles: ['Admin'] },
    { label: 'Audit Logs', route: '/audit-logs', icon: 'audit', roles: ['Admin'] },
    { label: 'Logistics AI', route: '/logistics-ai', icon: 'assistant' },
    { label: 'Profile', route: '/profile', icon: 'profile' },
  ];

  filteredNavItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    const role = this.authService.getUserRole();

    return this.navItems

      .filter((item) => !item.roles || (!!role && item.roles.includes(role)))

      .filter((item) => !query || item.label.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    const savedExpanded = localStorage.getItem('sidebarExpanded');

    if (savedExpanded !== null) {
      this.isExpanded.set(savedExpanded === 'true');
    }
  }

  toggle(): void {
    const next = !this.isExpanded();

    this.isExpanded.set(next);

    localStorage.setItem('sidebarExpanded', String(next));
  }

  logout(): void {
    this.authService.logout();
  }
}

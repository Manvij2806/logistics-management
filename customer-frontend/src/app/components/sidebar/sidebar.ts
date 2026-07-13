import { Component, Output, EventEmitter, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  @Input() activeView: string = 'dashboard';
  @Output() viewChange = new EventEmitter<string>();

  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;

  isExpanded = signal(true);
  searchQuery = signal('');

  private menuItemsList: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'track-delivery', label: 'Track Delivery', icon: 'track' },
    { id: 'profile', label: 'Profile', icon: 'profile' }
  ];

  filteredMenuItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.menuItemsList.filter(item => 
      !query || item.label.toLowerCase().includes(query)
    );
  });

  ngOnInit() {
    const savedExpanded = localStorage.getItem('customerSidebarExpanded');
    if (savedExpanded !== null) {
      this.isExpanded.set(savedExpanded === 'true');
    }
  }

  toggle(): void {
    const next = !this.isExpanded();
    this.isExpanded.set(next);
    localStorage.setItem('customerSidebarExpanded', String(next));
  }

  selectView(viewId: string) {
    if (viewId === 'logout') {
      this.viewChange.emit('logout');
      return;
    }
    this.viewChange.emit(viewId);
  }
}


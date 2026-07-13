import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() currentView: string = 'dashboard';
  @Input() isCollapsed: boolean = false;
  @Output() viewChanged = new EventEmitter<string>();
  @Output() collapseChanged = new EventEmitter<boolean>();

  constructor(private authService: AuthService) {}

  selectView(view: string): void {
    this.viewChanged.emit(view);
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapseChanged.emit(this.isCollapsed);
  }

  logout(): void {
    this.authService.logout();
  }
}

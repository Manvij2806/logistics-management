import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  deliveries: 'Delivery Management',
  agents: 'Agents',
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class Topbar implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  pageTitle = signal('Dashboard');
  currentUser = this.authService.currentUser;

  private sub?: Subscription;

  ngOnInit(): void {
    this.updateTitle();
    this.sub = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.getDeepestChild(this.route))
      )
      .subscribe(() => this.updateTitle());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  getUserInitials(): string {
    const name = this.currentUser()?.full_name?.trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private updateTitle(): void {
    const child = this.getDeepestChild(this.route);
    const segment = child.snapshot.url[0]?.path ?? 'dashboard';
    this.pageTitle.set(PAGE_TITLES[segment] ?? 'LogisticsPro');
  }

  private getDeepestChild(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }
}

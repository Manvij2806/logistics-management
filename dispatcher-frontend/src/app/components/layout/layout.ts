import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';
import { SidebarComponent } from '../../layout/sidebar/sidebar';
import { TopbarComponent } from '../../layout/topbar/topbar';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './layout.html'
})
export class Layout implements OnInit {
  private authService = inject(AuthService);

  ngOnInit(): void {
    if (this.authService.isLoggedIn() && !this.authService.currentUser()) {
      this.authService.loadCurrentUser().subscribe({
        next: (user) => {
          if (user.role !== 'Dispatcher') {
            this.authService.clearSessionSilently();
            window.location.href = `${environment.adminAppUrl}/login`;
          }
        },
        error: () => this.authService.logout()
      });
    }
  }
}


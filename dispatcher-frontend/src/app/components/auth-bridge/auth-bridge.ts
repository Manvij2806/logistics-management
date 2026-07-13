import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

/**
 * Landing point for the single-login-page flow: a user logs in on the admin
 * portal (:4200); if their role is Dispatcher, that app redirects the whole
 * browser here with the JWT as a query param. This component stores it,
 * verifies it actually belongs to a Dispatcher, and routes into the
 * dashboard. If anything is off, it sends them back to this app's own
 * login screen rather than failing silently.
 */
@Component({
  selector: 'app-auth-bridge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-bridge.html',
  styleUrls: ['./auth-bridge.css'],
})
export class AuthBridge implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      window.location.href = `${environment.adminAppUrl}/login`;
      return;
    }

    this.authService.setTokenFromBridge(token);

    this.authService.loadCurrentUser().subscribe({
      next: (user) => {
        if (user.role !== 'Dispatcher') {
          this.authService.clearSessionSilently();
          this.errorMessage.set('This portal is restricted to Dispatcher accounts.');
          setTimeout(() => {
            window.location.href = `${environment.adminAppUrl}/login`;
          }, 2000);
          return;
        }
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.authService.clearSessionSilently();
        this.errorMessage.set('Could not verify your session. Please log in again.');
        setTimeout(() => {
          window.location.href = `${environment.adminAppUrl}/login`;
        }, 2000);
      },
    });
  }
}


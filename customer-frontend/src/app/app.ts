import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from './components/sidebar/sidebar';
import { Dashboard } from './components/dashboard/dashboard';
import { TrackDelivery } from './components/track-delivery/track-delivery';
import { Profile } from './components/profile/profile';
import { BookShipment } from './components/book-shipment/book-shipment';
import { AuthService } from './services/auth.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Sidebar, Dashboard, TrackDelivery, Profile, BookShipment],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private authService = inject(AuthService);

  isLoggedIn = signal(false);
  activeView: string = 'dashboard';
  selectedTrackingId: string = '';

  ngOnInit() {
    console.log('OnInit starting...');
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    console.log('Parsed token from URL:', token);

    if (token) {
      this.authService.setToken(token);
      const cleanUrl = window.location.origin + '/';
      window.history.replaceState({}, document.title, cleanUrl);
      console.log('Token stored, URL cleaned to:', cleanUrl);
    }

    const isLoggedIn = this.authService.isLoggedIn();
    console.log('isLoggedIn check:', isLoggedIn);

    if (isLoggedIn) {
      console.log('Sending loadCurrentUser request...');
      this.authService.loadCurrentUser().subscribe({
        next: (user) => {
          console.log('User loaded successfully:', user);
          if (user.role === 'Customer') {
            this.isLoggedIn.set(true);
            console.log('isLoggedIn set to true, view should update');
          } else {
            console.warn('User is not a Customer, role is:', user.role);
            this.authService.clearSessionSilently();
            this.redirectToAdminLogin();
          }
        },
        error: (err) => {
          console.error('Error loading current user:', err);
          this.authService.clearSessionSilently();
          this.redirectToAdminLogin();
        }
      });
    } else {
      console.log('Not logged in, redirecting to Admin Login...');
      this.redirectToAdminLogin();
    }
  }

  redirectToAdminLogin() {
    window.location.href = `${environment.adminAppUrl}/login`;
  }

  onViewChange(view: string) {
    if (view === 'logout') {
      this.authService.logout();
      this.isLoggedIn.set(false);
      this.activeView = 'dashboard';
      this.selectedTrackingId = '';
      return;
    }
    this.activeView = view;
    if (view !== 'track-delivery') {
      this.selectedTrackingId = '';
    }
  }

  onTrackShipment(trackingId: string) {
    this.selectedTrackingId = trackingId;
    this.activeView = 'track-delivery';
  }
}

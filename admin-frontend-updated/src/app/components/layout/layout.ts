import { Component, OnInit, inject } from '@angular/core';

import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

import { Sidebar } from '../sidebar/sidebar';

import { Topbar } from '../topbar/topbar';



@Component({

  selector: 'app-layout',

  standalone: true,

  imports: [RouterOutlet, Sidebar, Topbar],

  templateUrl: './layout.html'

})

export class Layout implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);



  ngOnInit(): void {

    if (this.authService.isLoggedIn() && !this.authService.currentUser()) {

      this.authService.loadCurrentUser().subscribe({

        next: (user) => {
          if (user.role === 'Dispatcher') {
            const token = this.authService.getToken();
            this.authService.clearSessionSilently();
            window.location.href = `${environment.dispatcherAppUrl}/auth-bridge?token=${encodeURIComponent(token!)}`;
            return;
          }
          if (user.role !== 'Admin') {
            this.authService.clearSessionSilently();
            this.router.navigate(['/login']);
          }
        },

        error: () => this.authService.logout()

      });

    }

  }

}



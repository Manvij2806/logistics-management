import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  credentials = {
    email: 'agent@logisticspro.com',
    password: 'password'
  };

  errorMessage = '';

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (this.credentials.email.trim() && this.credentials.password.trim()) {
      this.authService.login(this.credentials.email, this.credentials.password).subscribe({
        next: () => {
          this.authService.loadCurrentUser().subscribe({
            next: (user) => {
              if (user.role !== 'Agent') {
                this.authService.clearSessionSilently();
                this.errorMessage = 'This portal is restricted to Agent accounts.';
              }
            },
            error: () => {
              this.errorMessage = 'Failed to load user profile.';
            }
          });
        },
        error: (err) => {
          this.errorMessage = err?.error?.detail || 'Invalid email or password.';
        }
      });
    } else {
      this.errorMessage = 'Please fill in all fields.';
    }
  }
}

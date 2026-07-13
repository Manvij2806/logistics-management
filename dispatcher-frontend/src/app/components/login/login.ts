import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isSubmitting = signal(false);
  loginError = signal<string | null>(null);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password } = this.loginForm.value;
    this.isSubmitting.set(true);
    this.loginError.set(null);

    this.authService.login(username!, password!).subscribe({
      next: () => {
        this.authService.loadCurrentUser().subscribe({
          next: (user) => {
            this.isSubmitting.set(false);
            if (user.role !== 'Dispatcher') {
              this.authService.clearSessionSilently();
              this.loginError.set('This portal is restricted to Dispatcher accounts.');
              return;
            }
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.loginError.set('Failed to load user profile.');
          }
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loginError.set(err?.error?.detail || 'Invalid username or password.');
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }
}

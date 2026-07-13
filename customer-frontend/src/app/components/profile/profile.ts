import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;

  isSubmitting = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  passwordForm = this.fb.group({
    oldPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  }, {
    validators: this.passwordMatchValidator
  });

  private passwordMatchValidator(g: any) {
    const newPass = g.get('newPassword')?.value;
    const confirmPass = g.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { mismatch: true };
  }

  get f() {
    return this.passwordForm.controls;
  }

  onSubmit() {
    if (this.passwordForm.invalid) {
      this.errorMessage.set('Please fill out the form correctly.');
      this.successMessage.set(null);
      return;
    }

    const { oldPassword, newPassword } = this.passwordForm.value;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.changePassword(oldPassword!, newPassword!).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.successMessage.set(res.message || 'Password updated successfully.');
        this.passwordForm.reset();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to change password. Please check your old password.');
      }
    });
  }

  onLogout() {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }
}

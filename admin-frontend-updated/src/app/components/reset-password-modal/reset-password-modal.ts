import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { User, UserService } from '../../services/user';
import { AuditLogService } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-reset-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password-modal.html',
  styleUrls: ['./reset-password-modal.css']
})
export class ResetPasswordModal {
  @Input({ required: true }) user!: User;
  @Output() closeEvent = new EventEmitter<void>();
  @Output() passwordResetEvent = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);
  submitSuccess = signal<boolean>(false);

  passwordForm: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  close(): void {
    this.closeEvent.emit();
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.passwordForm.value;
    if (password !== confirmPassword) {
      this.submitError.set('Passwords do not match.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(false);

    this.userService.resetPassword(this.user.id, password).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);

        // Log action and add notification
        const details = `Successfully reset password for user account: "${this.user.full_name}" (email: ${this.user.email})`;
        this.auditLogService.addLog('User Password Reset', 'User Action', details);
        this.notificationService.addNotification('Password reset successful', `for user ${this.user.email}`, 'warning');

        setTimeout(() => this.passwordResetEvent.emit(), 1200);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.submitError.set('An error occurred while resetting the password.');
      }
    });
  }

  get f() {
    return this.passwordForm.controls;
  }
}

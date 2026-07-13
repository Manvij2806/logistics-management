import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { AuditLogService } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-user-modal.html',
  styleUrls: ['./add-user-modal.css']
})
export class AddUserModal {
  @Output() closeEvent = new EventEmitter<void>();
  @Output() userAddedEvent = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);

  userForm: FormGroup = this.fb.group({
    full_name: ['', [
      Validators.required, 
      Validators.minLength(2), 
      Validators.maxLength(100),
      Validators.pattern(/^[A-Za-z\s]+$/)
    ]],
    username: ['', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
      Validators.pattern(/^\w+$/) // Alphanumeric and underscore
    ]],
    email: ['', [Validators.required, Validators.email]],
    phone_number: ['', [
      Validators.required,
      Validators.minLength(7),
      Validators.maxLength(20),
      Validators.pattern(/^[\d\s\-+()]{7,20}$/)
    ]],
    role: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  roles = ['Admin', 'Dispatcher', 'Agent', 'Customer'];

  close(): void {
    this.closeEvent.emit();
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword, ...userData } = this.userForm.value;
    if (password !== confirmPassword) {
      this.submitError.set('Passwords do not match.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.userService.createUser({ ...userData, password }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        
        // Log Audit Event and Notification
        const details = `Created new user account: "${userData.full_name}" with role "${userData.role}"`;
        this.auditLogService.addLog('User Profile Created', 'User Action', details);
        this.notificationService.addNotification('New user registered', `${userData.full_name} (${userData.role})`, 'user');

        this.userAddedEvent.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.submitError.set(err.error.detail || 'User already exists.');
        } else if (err.status === 422) {
          const detail = err.error?.detail;
          this.submitError.set(
            Array.isArray(detail)
              ? detail.map((e: { msg: string }) => e.msg).join(' ')
              : 'Please check the form fields and try again.'
          );
        } else {
          this.submitError.set('An error occurred while creating the user.');
        }
      }
    });
  }

  get f() {
    return this.userForm.controls;
  }
}

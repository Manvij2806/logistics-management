import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { User, UserService } from '../../services/user';
import { AuditLogService } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-user-modal.html',
  styleUrls: ['./edit-user-modal.css'],
})
export class EditUserModal implements OnChanges {
  @Input({ required: true }) user!: User;
  @Output() closeEvent = new EventEmitter<void>();
  @Output() userUpdatedEvent = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);

  userForm: FormGroup = this.fb.group({
    full_name: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(/^[A-Za-z\s]+$/),
      ],
    ],
    email: ['', [Validators.required, Validators.email]],
    phone_number: [
      '',
      [
        Validators.required,
        Validators.minLength(7),
        Validators.maxLength(20),
        Validators.pattern(/^[\d\s\-+()]{7,20}$/),
      ],
    ],
    role: ['', [Validators.required]],
    city: [''],
  });

  roles = ['Admin', 'Dispatcher', 'Agent', 'Customer'];
  cities = ['Agra', 'Mumbai', 'Delhi', 'Noida', 'Gwalior'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.userForm.patchValue({
        full_name: this.user.full_name,
        email: this.user.email,
        phone_number: this.user.phone_number ?? '',
        role: this.user.role,
        city: this.user.city ?? '',
      });
    }
  }

  close(): void {
    this.closeEvent.emit();
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const { full_name, email, phone_number, role, city } = this.userForm.value;

    this.userService.updateUser(this.user.id, { full_name, phone_number, role, email, city }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        
        // Log action and add notification
        const details = `Updated user account "${this.user.full_name}" (Changed fields: Name="${full_name}", Email="${email}", Phone="${phone_number}", Role="${role}")`;
        this.auditLogService.addLog('User Profile Updated', 'User Action', details);
        this.notificationService.addNotification('User Profile Updated', `Changed details for ${full_name}`, 'info');

        this.userUpdatedEvent.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.detail || 'An error occurred while updating the user.');
      },
    });
  }

  get f() {
    return this.userForm.controls;
  }
}

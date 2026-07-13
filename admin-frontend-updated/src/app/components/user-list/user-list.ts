import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User, UserListParams } from '../../services/user';
import { AuditLogService } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';
import { AddUserModal } from '../add-user-modal/add-user-modal';
import { EditUserModal } from '../edit-user-modal/edit-user-modal';
import { ResetPasswordModal } from '../reset-password-modal/reset-password-modal';

// Backend sort fields
type SortField = 'fullname' | 'email' | 'phone_number' | 'status' | 'created_at';
type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AddUserModal, EditUserModal, ResetPasswordModal],
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.css'],
})
export class UserList implements OnInit {
  private userService = inject(UserService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  users = signal<User[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(10);
  totalPages = signal(1);

  isModalOpen = signal<boolean>(false);
  isEditModalOpen = signal<boolean>(false);
  isResetPasswordModalOpen = signal<boolean>(false);
  selectedUser = signal<User | null>(null);
  isLoading = signal<boolean>(true);
  actionError = signal<string | null>(null);

  searchQuery = signal<string>('');
  sortBy = signal<SortField>('created_at');
  sortOrder = signal<SortOrder>('desc');

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.isLoading.set(true);
    this.userService
      .getUsers({
        page: this.page(),
        page_size: this.pageSize(),
        sort_by: this.sortBy(),
        sort_order: this.sortOrder(),
        search: this.searchQuery(),
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.users);
          this.total.set(res.total);
          this.totalPages.set(Math.max(1, Math.ceil(res.total / res.page_size)));
          this.isLoading.set(false);
        },
        error: () => {
          this.actionError.set('Failed to load users.');
          this.isLoading.set(false);
        },
      });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.fetchUsers();
    }, 300);
  }

  toggleSort(field: SortField): void {
    if (this.sortBy() === field) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortOrder.set('asc');
    }
    this.page.set(1);
    this.fetchUsers();
  }

  sortIndicator(field: SortField): string {
    if (this.sortBy() !== field) return '';
    return this.sortOrder() === 'asc' ? ' ↑' : ' ↓';
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.fetchUsers();
  }

  disableUser(user: User): void {
    if (!confirm(`Disable ${user.full_name}? They will no longer be able to access the system.`))
      return;
    this.setUserStatus(user.id, 'Inactive', 'Failed to disable user.');
  }

  enableUser(user: User): void {
    this.setUserStatus(user.id, 'Active', 'Failed to enable user.');
  }

  deleteUser(user: User): void {
    if (!confirm(`Delete ${user.full_name}? This action cannot be undone.`)) return;
    this.actionError.set(null);
    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.auditLogService.addLog('User Profile Deleted', 'User Action', `Deleted user account: "${user.full_name}"`);
        this.notificationService.addNotification('User Profile Deleted', `Deleted user account: "${user.full_name}"`, 'error');

        if (this.users().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.fetchUsers();
      },
      error: (err) => this.actionError.set(err.error?.detail || 'Failed to delete user.'),
    });
  }

  private setUserStatus(id: string, status: 'Active' | 'Inactive', errorMessage: string): void {
    const userObj = this.users().find(u => u.id === id);
    const name = userObj ? userObj.full_name : id;
    this.actionError.set(null);
    this.userService.updateUserStatus(id, status).subscribe({
      next: () => {
        this.fetchUsers();
        const action = status === 'Active' ? 'User Account Enabled' : 'User Account Disabled';
        const details = status === 'Active' 
          ? `Enabled user account: "${name}"`
          : `Disabled user account: "${name}"`;
        
        this.auditLogService.addLog(action, 'User Action', details);
        this.notificationService.addNotification(action, details, status === 'Active' ? 'success' : 'warning');
      },
      error: (err) => this.actionError.set(err.error?.detail || errorMessage),
    });
  }

  getStatusLabel(status: User['status']): string {
    return status === 'Active' ? 'Active' : 'Disabled';
  }

  openEditModal(user: User): void {
    this.selectedUser.set(user);
    this.isEditModalOpen.set(true);
  }
  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedUser.set(null);
  }
  openResetPasswordModal(user: User): void {
    this.selectedUser.set(user);
    this.isResetPasswordModalOpen.set(true);
  }
  closeResetPasswordModal(): void {
    this.isResetPasswordModalOpen.set(false);
    this.selectedUser.set(null);
  }
  onUserUpdated(): void {
    this.closeEditModal();
    this.fetchUsers();
  }
  onPasswordReset(): void {
    this.closeResetPasswordModal();
  }
  openModal(): void {
    this.isModalOpen.set(true);
  }
  closeModal(): void {
    this.isModalOpen.set(false);
  }
  onUserAdded(): void {
    this.closeModal();
    this.page.set(1);
    this.fetchUsers();
  }
}

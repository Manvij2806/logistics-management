import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  @Output() loginSuccess = new EventEmitter<void>();

  email: string = 'mj@email.com';
  password: string = 'manvi123';
  rememberMe: boolean = false;
  showPassword: boolean = false;
  errorMessage: string = '';

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }
    
    this.loginSuccess.emit();
  }
}

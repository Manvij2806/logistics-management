import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  if (authService.isLoggedIn()) {
    return true;
  }

  window.location.href = `${environment.adminAppUrl}/login`;
  return false;
};

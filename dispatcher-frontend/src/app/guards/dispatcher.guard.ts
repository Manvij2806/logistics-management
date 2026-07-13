import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';
import { environment } from '../../environments/environment';

/**
 * Restricts this portal to Dispatcher accounts only. Admin is NOT allowed
 * here — with the single-login-page flow, Admins always have their own full
 * dashboard on the admin app (:4200) and have no reason to be on :4201. If
 * an Admin (or anyone else) ends up here, send them back to the admin
 * portal's login page rather than letting them into the dispatcher UI.
 */
export const dispatcherGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  if (authService.hasAnyRole('Dispatcher')) {
    return true;
  }

  authService.clearSessionSilently();
  window.location.href = `${environment.adminAppUrl}/login`;
  return false;
};

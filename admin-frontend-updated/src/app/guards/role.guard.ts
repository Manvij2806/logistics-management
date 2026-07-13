import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Route guard factory — restricts a route to a specific set of roles.
 * Usage: canActivate: [roleGuard(['Admin', 'Dispatcher'])]
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasAnyRole(...allowedRoles)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const loginGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (route.queryParamMap.has('logout') || route.queryParamMap.has('force')) {
    authService.clearSessionSilently();
    return true;
  }

  if (!authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

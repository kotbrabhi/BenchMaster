import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppModeService } from './app-mode.service';
import { AuthService } from './auth.service';

export const modeAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const appModeService = inject(AppModeService);
  const authService = inject(AuthService);

  if (appModeService.isAuthenticatedMode() && !authService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};

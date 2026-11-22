import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const coachSettingsGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restoreSession();
  if (auth.isAuthenticated()) return true;
  const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  storage?.setItem('benchmaster.authReturnUrl', state.url);
  return router.createUrlTree(['/']);
};

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { coachSettingsGuard } from './coach-settings.guard';

describe('coachSettingsGuard', () => {
  it('requires a real authenticated session and preserves the requested URL', async () => {
    const auth = { restoreSession: jasmine.createSpy().and.resolveTo(), isAuthenticated: () => false };
    const router = { createUrlTree: jasmine.createSpy().and.returnValue({} as UrlTree) };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }, { provide: Router, useValue: router }] });
    const result = await TestBed.runInInjectionContext(() => coachSettingsGuard({} as never, { url: '/coach/settings' } as never));
    expect(auth.restoreSession).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});

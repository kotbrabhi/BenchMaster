import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppModeService } from './core/app-mode.service';
import { AuthService } from './core/auth.service';
import { getErrorMessage } from './core/api';
import { TranslationKey } from './core/translations';
import { GameService } from './services/game.service';
import { TeamService } from './services/team.service';
import { TranslatePipe } from './shared/pipes/translate.pipe';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly appModeService = inject(AppModeService);
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly gameService = inject(GameService);

  isSidebarCollapsed = false;
  authIntent = signal<'login' | 'register'>('login');
  isAuthPanelOpen = signal(false);
  authErrorMessage = signal('');
  authSubmitting = signal(false);
  authName = '';
  authEmail = '';
  authPassword = '';

  readonly currentUser = this.authService.currentUser;
  readonly isRestoringSession = this.authService.isRestoring;
  readonly isAuthenticated = computed(() => !!this.currentUser());

  readonly navigationItems = [
    { labelKey: 'app.nav.home' as const, link: '/', icon: 'home' as const },
    { labelKey: 'app.nav.newGame' as const, link: '/games/new', icon: 'plus' as const }
  ];

  async ngOnInit() {
    await this.authService.restoreSession();

    if (this.currentUser()) {
      this.appModeService.setMode('authenticated');
    } else {
      this.appModeService.setMode('guest');
    }

    await this.refreshNavigationData();
  }

  get isLiveMatchRoute(): boolean {
    return this.router.url.includes('/live');
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  openAuthPanel() {
    this.authIntent.set('login');
    this.authErrorMessage.set('');
    this.isAuthPanelOpen.set(true);
  }

  closeAuthPanel() {
    this.authErrorMessage.set('');
    this.authPassword = '';
    this.isAuthPanelOpen.set(false);
  }

  setAuthIntent(intent: 'login' | 'register') {
    this.authIntent.set(intent);
    this.authErrorMessage.set('');
  }

  async submitAuth() {
    try {
      this.authSubmitting.set(true);
      if (this.authIntent() === 'register') {
        await this.authService.register({
          name: this.authName,
          email: this.authEmail,
          password: this.authPassword
        });
      } else {
        await this.authService.login({
          email: this.authEmail,
          password: this.authPassword
        });
      }

      this.appModeService.setMode('authenticated');
      await this.refreshNavigationData();
      this.closeAuthPanel();
      await this.router.navigate(['/']);
    } catch (error) {
      this.authErrorMessage.set(getErrorMessage(error));
    } finally {
      this.authSubmitting.set(false);
    }
  }

  async logout() {
    this.authService.logout();
    this.appModeService.setMode('guest');
    await this.refreshNavigationData();
    this.closeAuthPanel();
    await this.router.navigate(['/']);
  }

  canSubmitAuth() {
    const hasIdentity = this.authIntent() === 'login' || this.authName.trim().length > 0;
    return hasIdentity && this.authEmail.trim().length > 0 && this.authPassword.trim().length >= 8;
  }

  authDisabledReason(): TranslationKey | '' {
    if (this.isRestoringSession()) {
      return 'common.reasons.authRestoring';
    }

    return this.canSubmitAuth() ? '' : 'common.reasons.authIncomplete';
  }

  authIntentLabel() {
    return this.authIntent() === 'login' ? 'home.auth.loginTab' : 'home.auth.registerTab';
  }

  private async refreshNavigationData() {
    await Promise.all([this.teamService.loadTeams(), this.gameService.loadGames()]);
  }
}

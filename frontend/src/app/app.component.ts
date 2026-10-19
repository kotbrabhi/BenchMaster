import { DOCUMENT, CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, TitleStrategy } from '@angular/router';
import { AppModeService } from './core/app-mode.service';
import { AuthService } from './core/auth.service';
import { getErrorMessage } from './core/api';
import { I18nService } from './core/i18n.service';
import { Locale, TranslationKey } from './core/translations';
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
  private readonly titleStrategy = inject(TitleStrategy);
  private readonly document = inject(DOCUMENT);
  private readonly appModeService = inject(AppModeService);
  private readonly authService = inject(AuthService);
  private readonly i18nService = inject(I18nService);
  private readonly teamService = inject(TeamService);
  private readonly gameService = inject(GameService);

  isSidebarCollapsed = false;
  readonly isDarkTheme = signal(false);
  authIntent = signal<'login' | 'register'>('login');
  isAuthPanelOpen = signal(false);
  authErrorMessage = signal('');
  authSubmitting = signal(false);
  authName = '';
  authEmail = '';
  authPassword = '';
  private authPanelElement: HTMLElement | null = null;
  private authTrigger: HTMLElement | null = null;

  @ViewChild('authPanel')
  set authPanelRef(element: ElementRef<HTMLElement> | undefined) {
    this.authPanelElement = element?.nativeElement ?? null;

    if (this.authPanelElement) {
      this.getAuthFocusableElements()[0]?.focus();
      return;
    }

    const trigger = this.authTrigger;
    this.authTrigger = null;
    if (trigger) {
      queueMicrotask(() => trigger.focus());
    }
  }

  readonly currentUser = this.authService.currentUser;
  readonly isRestoringSession = this.authService.isRestoring;
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly locale = this.i18nService.locale;

  readonly navigationItems = [
    { labelKey: 'app.nav.home' as const, link: '/', icon: 'home' as const },
    { labelKey: 'app.nav.newGame' as const, link: '/games/new', icon: 'plus' as const }
  ];

  constructor() {
    effect(() => {
      this.i18nService.locale();
      this.titleStrategy.updateTitle(this.router.routerState.snapshot);
    });
  }

  async ngOnInit() {
    this.initializeTheme();
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

  toggleTheme() {
    this.setTheme(this.isDarkTheme() ? 'light' : 'dark');
  }

  themeToggleLabel() {
    return this.i18nService.t(this.isDarkTheme() ? 'app.nav.themeToLight' : 'app.nav.themeToDark');
  }

  openAuthPanel(event: MouseEvent) {
    this.authTrigger = event.currentTarget as HTMLElement;
    this.authIntent.set('login');
    this.authErrorMessage.set('');
    this.isAuthPanelOpen.set(true);
  }

  closeAuthPanel() {
    this.authErrorMessage.set('');
    this.authPassword = '';
    this.isAuthPanelOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleAuthPanelKeydown(event: KeyboardEvent) {
    if (!this.isAuthPanelOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAuthPanel();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.getAuthFocusableElements();
    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      event.preventDefault();
      this.authPanelElement?.focus();
      return;
    }

    const activeElement = this.document.activeElement;
    const focusIsOutsidePanel = !this.authPanelElement?.contains(activeElement);

    if (event.shiftKey && (activeElement === first || focusIsOutsidePanel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (activeElement === last || focusIsOutsidePanel)) {
      event.preventDefault();
      first.focus();
    }
  }

  setAuthIntent(intent: 'login' | 'register') {
    this.authIntent.set(intent);
    this.authErrorMessage.set('');
  }

  async submitAuth() {
    this.authErrorMessage.set('');

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
      this.authErrorMessage.set(getErrorMessage(error, this.i18nService.t));
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

  toggleLocale() {
    this.i18nService.setLocale(this.locale() === 'fr' ? 'en' : 'fr');
  }

  nextLocaleLabel(): Locale {
    return this.locale() === 'fr' ? 'en' : 'fr';
  }

  private initializeTheme() {
    let theme: 'light' | 'dark' = 'light';

    try {
      if (this.document.defaultView?.localStorage.getItem('benchmaster.theme') === 'dark') {
        theme = 'dark';
      }
    } catch {
      // Keep the light theme when storage is unavailable.
    }

    this.setTheme(theme, false);
  }

  private setTheme(theme: 'light' | 'dark', persist = true) {
    this.isDarkTheme.set(theme === 'dark');
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document.documentElement.style.colorScheme = theme;

    if (!persist) {
      return;
    }

    try {
      this.document.defaultView?.localStorage.setItem('benchmaster.theme', theme);
    } catch {
      // Keep the selected theme for this session when storage is unavailable.
    }
  }

  private async refreshNavigationData() {
    await Promise.all([this.teamService.loadTeams(), this.gameService.loadGames()]);
  }

  private getAuthFocusableElements() {
    if (!this.authPanelElement) {
      return [];
    }

    return Array.from(
      this.authPanelElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getClientRects().length > 0);
  }
}

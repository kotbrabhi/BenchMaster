import { DOCUMENT, CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, TitleStrategy } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AppModeService } from './core/app-mode.service';
import { AuthService } from './core/auth.service';
import { getErrorMessage } from './core/api';
import { I18nService } from './core/i18n.service';
import { FriendlyNotification } from './core/models';
import { Locale, TranslationKey } from './core/translations';
import { FriendlyMatchService } from './services/friendly-match.service';
import { CoachSettingsService } from './services/coach-settings.service';
import { GameService } from './services/game.service';
import { TeamService } from './services/team.service';
import { TranslatePipe } from './shared/pipes/translate.pipe';
import { AppShellComponent } from './shell/app-shell.component';
import { AuthPanelComponent } from './shell/auth-panel.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, TranslatePipe, AppShellComponent, AuthPanelComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly titleStrategy = inject(TitleStrategy);
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly appModeService = inject(AppModeService);
  private readonly authService = inject(AuthService);
  private readonly i18nService = inject(I18nService);
  private readonly teamService = inject(TeamService);
  private readonly gameService = inject(GameService);
  private readonly friendlyMatchService = inject(FriendlyMatchService);
  private readonly coachSettingsService = inject(CoachSettingsService);

  readonly isDarkTheme = signal(false);
  private authTrigger: HTMLElement | null = null;
  isAuthPanelOpen = signal(false);
  authErrorMessage = signal('');
  authSubmitting = signal(false);
  private notificationsSubscription?: Subscription;
  private installPromptEvent: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }) | null = null;
  readonly installBannerVisible = signal(false);
  readonly installHelpVisible = signal(false);
  readonly installIsIos = signal(false);
  readonly isMobileExperience = signal(false);
  readonly isStandaloneExperience = signal(false);
  private readonly onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    this.installPromptEvent = event as typeof this.installPromptEvent;
    this.installBannerVisible.set(!this.isStandalone());
  };
  private readonly onAppInstalled = () => {
    this.installPromptEvent = null;
    this.installBannerVisible.set(false);
    this.installHelpVisible.set(false);
  };

  readonly currentUser = this.authService.currentUser;
  readonly isRestoringSession = this.authService.isRestoring;
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly locale = this.i18nService.locale;
  readonly notifications = signal<FriendlyNotification[]>([]);
  readonly pushNotificationStatus = signal<'checking' | 'enabled' | 'disabled' | 'unsupported' | 'blocked' | 'error'>('checking');
  readonly pushBannerDismissed = signal(false);
  readonly pushBannerVisible = computed(() => this.isAuthenticated()
    && this.isMobileExperience()
    && this.isStandaloneExperience()
    && this.pushNotificationStatus() !== 'checking'
    && this.pushNotificationStatus() !== 'enabled'
    && !this.pushBannerDismissed());
  readonly unreadNotificationCount = computed(() => this.notifications().filter((item) => !item.readAt).length);

  constructor() {
    effect(() => {
      this.i18nService.locale();
      this.titleStrategy.updateTitle(this.router.routerState.snapshot);
    });
  }

  async ngOnInit() {
    this.initializeInstallExperience();
    this.initializeTheme();
    await this.authService.restoreSession();

    if (this.currentUser()) {
      this.appModeService.setMode('authenticated');
      await this.coachSettingsService.load().catch(() => undefined);
      await this.refreshPushNotificationState();
    } else {
      this.appModeService.setMode('guest');
    }

    await this.refreshNavigationData();
    if (this.isAuthenticated()) {
      await this.refreshNotifications();
      this.notificationsSubscription = interval(20000).subscribe(() => void this.refreshNotifications());
    }
  }

  ngOnDestroy() {
    this.notificationsSubscription?.unsubscribe();
    this.window?.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    this.window?.removeEventListener('appinstalled', this.onAppInstalled);
  }

  async installApp() {
    if (this.installPromptEvent) {
      const promptEvent = this.installPromptEvent;
      this.installPromptEvent = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') this.installBannerVisible.set(false);
      } catch {
        this.installHelpVisible.set(true);
      }
      return;
    }

    this.installHelpVisible.update((visible) => !visible);
  }

  dismissInstallBanner() {
    this.installBannerVisible.set(false);
    this.installHelpVisible.set(false);
  }

  dismissPushBanner() {
    this.pushBannerDismissed.set(true);
  }

  get isLiveMatchRoute(): boolean {
    return this.router.url.includes('/live');
  }

  toggleTheme() {
    this.setTheme(this.isDarkTheme() ? 'light' : 'dark');
  }

  toggleNotifications() {
    void this.refreshNotifications();
  }

  async openNotification(notification: FriendlyNotification) {
    if (notification.readAt) return;
    try {
      await this.friendlyMatchService.markNotificationRead(notification.id);
      this.notifications.update((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch {
      // Opening the linked item should still work if marking it read fails.
    }
  }

  notificationLabel(notification: FriendlyNotification) {
    const team = notification.type === 'INTEREST_RECEIVED' || notification.type === 'TEAM_SUBMITTED'
      ? notification.application?.team.name ?? ''
      : notification.perspective === 'CANDIDATE'
        ? notification.proposal?.organizerTeam.name ?? ''
        : notification.application?.team.name ?? '';
    return this.i18nService.t(`friendlies.notification.${notification.type}` as TranslationKey, { team });
  }

  notificationLink(notification: FriendlyNotification) {
    if (notification.type === 'APPLICATION_REJECTED' && notification.applicationId) {
      return ['/friendlies/applications', notification.applicationId];
    }
    return notification.proposalId ? ['/friendlies', notification.proposalId] : ['/friendlies'];
  }

  async refreshNotifications() {
    if (!this.isAuthenticated()) return;
    try {
      this.notifications.set(await this.friendlyMatchService.listNotifications());
    } catch {
      // Keep the header quiet when notifications are temporarily unavailable.
    }
  }

  pushNotificationActionLabel(): TranslationKey {
    return this.pushNotificationStatus() === 'enabled' ? 'app.push.disable' : 'app.push.enable';
  }

  pushNotificationShortActionLabel(): TranslationKey {
    return this.pushNotificationStatus() === 'enabled' ? 'app.push.disableShort' : 'app.push.enableShort';
  }

  pushNotificationStatusLabel(): TranslationKey {
    switch (this.pushNotificationStatus()) {
      case 'blocked': return 'app.push.blocked';
      case 'unsupported': return 'app.push.unsupported';
      default: return 'app.push.error';
    }
  }

  pushBannerMessage(): string {
    const key = this.pushNotificationStatus() === 'error' ? this.pushNotificationStatusLabel() : 'app.push.bannerDescription';
    return this.i18nService.t(key);
  }

  async togglePushNotifications() {
    const browserWindow = this.window;
    if (!browserWindow || !('serviceWorker' in browserWindow.navigator) || !('PushManager' in browserWindow) || !('Notification' in browserWindow)) {
      this.pushNotificationStatus.set('unsupported');
      return;
    }

    try {
      let permission = browserWindow.Notification.permission;
      if (this.pushNotificationStatus() !== 'enabled' && permission === 'default') {
        // On iOS this permission request must happen directly in the button's user gesture.
        permission = await browserWindow.Notification.requestPermission();
      }
      if (permission !== 'granted') {
        this.pushNotificationStatus.set(permission === 'denied' ? 'blocked' : 'disabled');
        return;
      }

      const registration = await browserWindow.navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (this.pushNotificationStatus() === 'enabled' && existing) {
        await this.friendlyMatchService.removePushSubscription(existing.endpoint);
        await existing.unsubscribe();
        this.pushNotificationStatus.set('disabled');
        return;
      }

      let subscription = existing;
      if (!subscription) {
        const { publicKey } = await this.friendlyMatchService.getPushPublicKey();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.base64UrlToBytes(publicKey) as BufferSource
        });
      }
      await this.friendlyMatchService.savePushSubscription(subscription.toJSON());
      this.pushNotificationStatus.set('enabled');
    } catch {
      this.pushNotificationStatus.set('error');
    }
  }

  openAuthPanel(event?: MouseEvent) {
    this.authTrigger = event?.currentTarget as HTMLElement | null;
    this.authErrorMessage.set('');
    this.isAuthPanelOpen.set(true);
  }

  closeAuthPanel() {
    this.authErrorMessage.set('');
    const trigger = this.authTrigger;
    this.authTrigger = null;
    queueMicrotask(() => trigger?.focus());
    this.isAuthPanelOpen.set(false);
  }

  async submitAuth(credentials: { intent: 'login' | 'register'; name: string; email: string; password: string }) {
    this.authErrorMessage.set('');

    try {
      this.authSubmitting.set(true);
      if (credentials.intent === 'register') {
        await this.authService.register({
          name: credentials.name,
          email: credentials.email,
          password: credentials.password
        });
      } else {
        await this.authService.login({
          email: credentials.email,
          password: credentials.password
        });
      }

      this.appModeService.setMode('authenticated');
      void this.coachSettingsService.load().catch(() => undefined);
      await this.refreshPushNotificationState();
      await this.refreshNotifications();
      await this.refreshNavigationData();
      this.closeAuthPanel();
      const returnUrl = this.document.defaultView?.sessionStorage.getItem('benchmaster.authReturnUrl');
      this.document.defaultView?.sessionStorage.removeItem('benchmaster.authReturnUrl');
      await this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/');
    } catch (error) {
      this.authErrorMessage.set(getErrorMessage(error, this.i18nService.t));
    } finally {
      this.authSubmitting.set(false);
    }
  }

  async logout() {
    await this.detachCurrentPushSubscription();
    await this.authService.logout();
    this.coachSettingsService.settings.set({ defaultPeriodCount: 4, defaultPeriodDurationSeconds: 600, playingTimeDisplay: 'PERCENTAGE', visibleLiveStats: ['points', 'rebounds', 'assists', 'blocks', 'interceptions'], confirmSessionEnd: true, openSummaryAfterEnd: true });
    this.document.defaultView?.sessionStorage.removeItem('benchmaster.authReturnUrl');
    this.notifications.set([]);
    this.appModeService.setMode('guest');
    await this.refreshNavigationData();
    this.closeAuthPanel();
    await this.router.navigate(['/']);
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

  private initializeInstallExperience() {
    const browserWindow = this.window;
    if (!browserWindow) return;

    const isMobile = browserWindow.matchMedia('(max-width: 767px), (pointer: coarse)').matches
      || /Android|iPhone|iPad|iPod/i.test(browserWindow.navigator.userAgent);
    const isIos = /iPhone|iPad|iPod/i.test(browserWindow.navigator.userAgent)
      || (browserWindow.navigator.platform === 'MacIntel' && browserWindow.navigator.maxTouchPoints > 1);
    this.isMobileExperience.set(isMobile);
    this.isStandaloneExperience.set(this.isStandalone());
    this.installIsIos.set(isIos);
    this.installBannerVisible.set(isMobile && !this.isStandalone());

    if ('serviceWorker' in browserWindow.navigator && (browserWindow.location.protocol === 'https:' || browserWindow.location.hostname === 'localhost')) {
      void browserWindow.navigator.serviceWorker.register('/service-worker.js').catch(() => {
        // The application remains usable if offline support is unavailable.
      });
    }

    browserWindow.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    browserWindow.addEventListener('appinstalled', this.onAppInstalled);
  }

  private async refreshPushNotificationState() {
    const browserWindow = this.window;
    if (!browserWindow || !('serviceWorker' in browserWindow.navigator) || !('PushManager' in browserWindow) || !('Notification' in browserWindow)) {
      this.pushNotificationStatus.set('unsupported');
      return;
    }
    if (browserWindow.Notification.permission === 'denied') {
      this.pushNotificationStatus.set('blocked');
      return;
    }
    try {
      const registration = await browserWindow.navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && browserWindow.Notification.permission === 'granted') {
        await this.friendlyMatchService.savePushSubscription(subscription.toJSON());
        this.pushNotificationStatus.set('enabled');
      } else {
        this.pushNotificationStatus.set('disabled');
      }
    } catch {
      this.pushNotificationStatus.set('error');
    }
  }

  private async detachCurrentPushSubscription() {
    if (!this.isAuthenticated() || !this.window || !('serviceWorker' in this.window.navigator)) return;
    try {
      const registration = await this.window.navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await this.friendlyMatchService.removePushSubscription(subscription.endpoint);
    } catch {
      // A logout must continue even when the push endpoint cannot be reached.
    }
  }

  private base64UrlToBytes(value: string) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const decoded = this.window?.atob(padded) ?? '';
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  }

  private isStandalone() {
    return !!this.window && (this.window.matchMedia('(display-mode: standalone)').matches
      || (this.window.navigator as Navigator & { standalone?: boolean }).standalone === true);
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

}

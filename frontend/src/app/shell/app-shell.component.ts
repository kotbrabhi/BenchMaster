import { CommonModule, UpperCasePipe } from '@angular/common';
import { Component, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FriendlyNotification } from '../core/models';
import { Locale, TranslationKey } from '../core/translations';
import { I18nService } from '../core/i18n.service';
import { TranslatePipe } from '../shared/pipes/translate.pipe';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe, UpperCasePipe],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly isLiveMatchRoute = input(false);
  readonly isDarkTheme = input(false);
  readonly isAuthenticated = input(false);
  readonly currentUserName = input('');
  readonly isAuthPanelOpen = input(false);
  readonly notifications = input<FriendlyNotification[]>([]);
  readonly unreadNotificationCount = input(0);
  readonly mobileMenuOpen = signal(false);
  readonly pushNotificationStatus = input<'checking' | 'enabled' | 'disabled' | 'unsupported' | 'blocked' | 'error'>('checking');
  readonly loginRequested = output<MouseEvent>();
  readonly logoutRequested = output<void>();
  readonly themeToggleRequested = output<void>();
  readonly localeToggleRequested = output<void>();
  readonly notificationToggleRequested = output<void>();
  readonly notificationOpened = output<FriendlyNotification>();
  readonly pushToggleRequested = output<void>();
  readonly accountMenuOpen = signal(false);
  readonly notificationsOpen = signal(false);

  private readonly i18nService = inject(I18nService);
  private readonly notificationMenu = viewChild<ElementRef<HTMLElement>>('notificationMenu');
  private readonly accountMenu = viewChild<ElementRef<HTMLElement>>('accountMenu');
  private readonly mobileMenu = viewChild<ElementRef<HTMLElement>>('mobileMenu');

  readonly navigationItems = [
    { labelKey: 'app.nav.home' as const, link: '/', icon: 'home' as const },
    { labelKey: 'app.nav.newGame' as const, link: '/games/new', icon: 'plus' as const },
    { labelKey: 'training.newAction' as const, link: '/training/new', icon: 'training' as const },
    { labelKey: 'app.nav.friendlies' as const, link: '/friendlies', icon: 'calendar' as const }
  ];
  readonly isSidebarCollapsed = signal(false);
  readonly locale = input<Locale>('fr');
  nextLocaleLabel(): Locale { return this.locale() === 'fr' ? 'en' : 'fr'; }

  toggleSidebar(): void { this.isSidebarCollapsed.update((value) => !value); }
  toggleMobileMenu(): void { this.mobileMenuOpen.update((value) => !value); }
  closeMobileMenu(): void { this.mobileMenuOpen.set(false); }
  toggleAccountMenu(): void { this.accountMenuOpen.update((value) => !value); }
  closeAccountMenu(): void { this.accountMenuOpen.set(false); }
  toggleNotifications(): void { this.notificationsOpen.update((value) => !value); if (this.notificationsOpen()) this.notificationToggleRequested.emit(); }
  toggleTheme(): void { this.themeToggleRequested.emit(); }
  toggleLocale(): void { this.localeToggleRequested.emit(); }
  logout(): void { this.logoutRequested.emit(); }
  openAuthPanel(event: MouseEvent): void { this.loginRequested.emit(event); }
  openNotification(notification: FriendlyNotification): void { this.notificationOpened.emit(notification); }
  userInitials(): string {
    const name = this.currentUserName();
    return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toLocaleUpperCase()).join('') || '?';
  }
  themeToggleLabel(): string { return this.i18nService.t(this.isDarkTheme() ? 'app.nav.themeToLight' : 'app.nav.themeToDark'); }
  notificationLink(notification: FriendlyNotification): string[] {
    if (notification.type === 'APPLICATION_REJECTED' && notification.applicationId) return ['/friendlies/applications', String(notification.applicationId)];
    return notification.proposalId ? ['/friendlies', String(notification.proposalId)] : ['/friendlies'];
  }
  notificationLabel(notification: FriendlyNotification): string {
    const team = notification.type === 'INTEREST_RECEIVED' || notification.type === 'TEAM_SUBMITTED'
      ? notification.application?.team.name ?? ''
      : notification.perspective === 'CANDIDATE' ? notification.proposal?.organizerTeam.name ?? '' : notification.application?.team.name ?? '';
    return this.translateNotification(notification, team);
  }
  private translateNotification(notification: FriendlyNotification, team: string): string {
    const key = `friendlies.notification.${notification.type}` as TranslationKey;
    return this.i18nService.t(key, { team });
  }
  pushNotificationStatusLabel(): TranslationKey {
    const status = this.pushNotificationStatus();
    return status === 'blocked' ? 'app.push.blocked' : status === 'unsupported' ? 'app.push.unsupported' : 'app.push.error';
  }
  pushNotificationShortActionLabel(): TranslationKey { return this.pushNotificationStatus() === 'enabled' ? 'app.push.disableShort' : 'app.push.enableShort'; }
  notificationToggle(): void { this.pushToggleRequested.emit(); }

  @HostListener('document:click', ['$event'])
  closeMenusOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.mobileMenuOpen() && !this.mobileMenu()?.nativeElement.contains(target)) this.closeMobileMenu();
    if (this.notificationsOpen() && !this.notificationMenu()?.nativeElement.contains(target)) this.notificationsOpen.set(false);
    if (this.accountMenuOpen() && !this.accountMenu()?.nativeElement.contains(target)) this.closeAccountMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenusOnEscape(): void {
    if (this.mobileMenuOpen()) this.closeMobileMenu();
    if (this.notificationsOpen()) this.notificationsOpen.set(false);
    if (this.accountMenuOpen()) this.closeAccountMenu();
  }
}

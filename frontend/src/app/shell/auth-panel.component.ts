import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, input, output, viewChild } from '@angular/core';
import { TranslationKey } from '../core/translations';
import { TranslatePipe } from '../shared/pipes/translate.pipe';

export interface AuthCredentials {
  intent: 'login' | 'register';
  name: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './auth-panel.component.html'
})
export class AuthPanelComponent implements AfterViewInit {
  readonly isRestoringSession = input(false);
  readonly errorMessage = input('');
  readonly submitting = input(false);
  readonly closed = output<void>();
  readonly submitted = output<AuthCredentials>();
  readonly panel = viewChild<ElementRef<HTMLElement>>('authPanel');
  readonly authTrigger = input<HTMLElement | null>(null);
  authIntent: AuthCredentials['intent'] = 'login';
  authName = '';
  authEmail = '';
  authPassword = '';

  ngAfterViewInit(): void { queueMicrotask(() => this.getFocusableElements()[0]?.focus()); }
  close(): void { this.authPassword = ''; this.closed.emit(); }
  setAuthIntent(intent: AuthCredentials['intent']): void { this.authIntent = intent; }
  submit(): void { this.submitted.emit({ intent: this.authIntent, name: this.authName, email: this.authEmail, password: this.authPassword }); }
  canSubmitAuth(): boolean {
    return (this.authIntent === 'login' || !!this.authName.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.authEmail.trim()) && this.authPassword.length >= 8;
  }
  authIntentLabel(): TranslationKey { return this.authIntent === 'login' ? 'home.auth.loginTab' : 'home.auth.registerTab'; }
  authDisabledReason(): TranslationKey | '' {
    if (this.isRestoringSession()) return 'common.reasons.authRestoring';
    if (this.authIntent === 'register' && !this.authName.trim()) return 'common.reasons.authNameRequired';
    if (!this.authEmail.trim()) return 'error.authEmailRequired';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.authEmail.trim())) return 'error.authEmailInvalid';
    if (this.authPassword.length < 8) return 'error.authPasswordShort';
    return '';
  }
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const elements = this.getFocusableElements();
    const first = elements[0];
    const last = elements.at(-1);
    const active = this.panel()?.nativeElement.ownerDocument.activeElement;
    const outside = !active || !this.panel()?.nativeElement.contains(active);
    if (!first || !last) { event.preventDefault(); this.panel()?.nativeElement.focus(); }
    else if (event.shiftKey && (active === first || outside)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || outside)) { event.preventDefault(); first.focus(); }
  }
  private getFocusableElements(): HTMLElement[] {
    return Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => element.getClientRects().length > 0);
  }
}

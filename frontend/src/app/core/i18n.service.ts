import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, signal } from '@angular/core';
import { Locale, TranslationKey, translations } from './translations';

type TranslationParams = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'benchmaster.locale';
  private readonly localeSignal = signal<Locale>('fr');

  readonly locale = this.localeSignal.asReadonly();
  readonly defaultLocale: Locale = 'fr';

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.localeSignal.set(this.getInitialLocale());
    this.applyDocumentLanguage(this.localeSignal());
  }

  readonly t = (key: TranslationKey, params?: TranslationParams) => {
    const locale = this.localeSignal();
    const message =
      translations[locale]?.[key] ??
      translations[this.defaultLocale]?.[key] ??
      key;

    return this.interpolate(message, params);
  };

  setLocale(locale: Locale) {
    this.localeSignal.set(locale);
    this.applyDocumentLanguage(locale);

    this.writeStoredLocale(locale);
  }

  private getInitialLocale(): Locale {
    const storedLocale = this.readStoredLocale();

    if (this.isSupportedLocale(storedLocale)) {
      return storedLocale;
    }

    return this.defaultLocale;
  }

  private isSupportedLocale(locale: string | null): locale is Locale {
    return locale === 'fr' || locale === 'en';
  }

  private applyDocumentLanguage(locale: Locale) {
    this.document.documentElement.lang = locale;
  }

  private readStoredLocale() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(this.storageKey);
      }
    } catch {
      return null;
    }

    return null;
  }

  private writeStoredLocale(locale: Locale) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, locale);
      }
    } catch {
      // Ignore storage issues and keep the in-memory locale.
    }
  }

  private interpolate(message: string, params?: TranslationParams) {
    if (!params) {
      return message;
    }

    return Object.entries(params).reduce(
      (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
      message
    );
  }
}

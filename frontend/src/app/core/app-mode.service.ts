import { Injectable, signal } from '@angular/core';
import { AppMode } from './models';

const APP_MODE_STORAGE_KEY = 'benchmaster.app-mode';

@Injectable({ providedIn: 'root' })
export class AppModeService {
  readonly mode = signal<AppMode>(this.readMode());

  setMode(mode: AppMode) {
    localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
    this.mode.set(mode);
  }

  isGuestMode() {
    return this.mode() === 'guest';
  }

  isAuthenticatedMode() {
    return this.mode() === 'authenticated';
  }

  private readMode(): AppMode {
    const storedMode = localStorage.getItem(APP_MODE_STORAGE_KEY);
    return storedMode === 'authenticated' ? 'authenticated' : 'guest';
  }
}

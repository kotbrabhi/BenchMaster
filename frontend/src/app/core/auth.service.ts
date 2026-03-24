import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import { AuthSession, AuthUser } from './models';

interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

const AUTH_TOKEN_STORAGE_KEY = 'benchmaster.auth-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  readonly currentUser = signal<AuthUser | null>(null);
  readonly isRestoring = signal(false);
  readonly isAuthenticated = computed(() => !!this.token());

  private restorePromise: Promise<void> | null = null;

  async restoreSession() {
    if (!this.token()) {
      this.currentUser.set(null);
      return;
    }

    if (this.currentUser()) {
      return;
    }

    if (!this.restorePromise) {
      this.isRestoring.set(true);
      this.restorePromise = this.fetchCurrentUser()
        .then((user) => {
          this.currentUser.set(user);
        })
        .catch(() => {
          this.clearSession();
        })
        .finally(() => {
          this.isRestoring.set(false);
          this.restorePromise = null;
        });
    }

    await this.restorePromise;
  }

  async register(payload: AuthPayload) {
    const session = await firstValueFrom(this.http.post<AuthSession>(`${API_BASE_URL}/auth/register`, payload));
    this.applySession(session);
    return session.user;
  }

  async login(payload: AuthPayload) {
    const session = await firstValueFrom(this.http.post<AuthSession>(`${API_BASE_URL}/auth/login`, payload));
    this.applySession(session);
    return session.user;
  }

  logout() {
    this.clearSession();
  }

  private async fetchCurrentUser() {
    const response = await firstValueFrom(this.http.get<{ user: AuthUser }>(`${API_BASE_URL}/auth/me`));
    return response.user;
  }

  private applySession(session: AuthSession) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
    this.token.set(session.token);
    this.currentUser.set(session.user);
  }

  private clearSession() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }
}

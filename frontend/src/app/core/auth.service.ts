import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import { AuthUser } from './models';

interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isRestoring = signal(false);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  private restorePromise: Promise<void> | null = null;

  async restoreSession() {
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
    const response = await firstValueFrom(this.http.post<{ user: AuthUser }>(`${API_BASE_URL}/auth/register`, payload));
    this.currentUser.set(response.user);
    return response.user;
  }

  async login(payload: AuthPayload) {
    const response = await firstValueFrom(this.http.post<{ user: AuthUser }>(`${API_BASE_URL}/auth/login`, payload));
    this.currentUser.set(response.user);
    return response.user;
  }

  async logout() {
    try {
      await firstValueFrom(this.http.post<void>(`${API_BASE_URL}/auth/logout`, {}));
    } catch {
      // Clear local UI state even if the server cannot be reached.
    } finally {
      this.clearSession();
    }
  }

  private async fetchCurrentUser() {
    const response = await firstValueFrom(this.http.get<{ user: AuthUser }>(`${API_BASE_URL}/auth/me`));
    return response.user;
  }

  private clearSession() {
    this.currentUser.set(null);
  }
}

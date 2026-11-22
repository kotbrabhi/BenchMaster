import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { CoachSettings, DEFAULT_COACH_SETTINGS } from '../core/coach-settings';

@Injectable({ providedIn: 'root' })
export class CoachSettingsService {
  private readonly http = inject(HttpClient);
  readonly settings = signal<CoachSettings>(DEFAULT_COACH_SETTINGS);
  async load() {
    const settings = await firstValueFrom(this.http.get<CoachSettings>(`${API_BASE_URL}/coach/settings`));
    this.settings.set(settings); return settings;
  }
  async save(settings: CoachSettings) {
    const saved = await firstValueFrom(this.http.put<CoachSettings>(`${API_BASE_URL}/coach/settings`, settings));
    this.settings.set(saved); return saved;
  }
}

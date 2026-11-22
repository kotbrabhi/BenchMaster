import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { AppModeService } from '../core/app-mode.service';
import { GameDetail, GameListItem, GameShareInfo, GameSummary, GameSummaryExport } from '../core/models';
import { GuestStorageService } from './guest-storage.service';
import { CoachSettingsService } from './coach-settings.service';

export interface CreateGamePayload {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
  sessionType?: 'GAME' | 'TRAINING';
  periodCount?: number;
  periodDurationSeconds?: number;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly appModeService = inject(AppModeService);
  private readonly guestStorageService = inject(GuestStorageService);
  private readonly coachSettingsService = inject(CoachSettingsService);

  readonly games = signal<GameListItem[]>([]);

  async loadGames(teamId?: number) {
    const games = this.appModeService.isGuestMode()
      ? await this.guestStorageService.loadGames()
      : await firstValueFrom(
          this.http.get<GameListItem[]>(
            `${API_BASE_URL}/games`,
            { params: teamId ? new HttpParams().set('teamId', String(teamId)) : undefined }
          )
        );
    this.games.set(games);
    return games;
  }

  createGame(payload: CreateGamePayload) {
    const gamePayload = payload.sessionType === 'TRAINING' ? payload : {
      ...payload,
      periodCount: payload.periodCount ?? this.coachSettingsService.settings().defaultPeriodCount,
      periodDurationSeconds: payload.periodDurationSeconds ?? this.coachSettingsService.settings().defaultPeriodDurationSeconds
    };
    return this.appModeService.isGuestMode()
      ? this.guestStorageService.createGame(gamePayload)
      : firstValueFrom(this.http.post<GameDetail>(`${API_BASE_URL}/games`, gamePayload));
  }

  getGame(gameId: number) {
    return this.appModeService.isGuestMode()
      ? this.guestStorageService.getGame(gameId)
      : firstValueFrom(this.http.get<GameDetail>(`${API_BASE_URL}/games/${gameId}`));
  }

  getSummary(gameId: number) {
    return this.appModeService.isGuestMode()
      ? this.guestStorageService.getSummary(gameId)
      : firstValueFrom(this.http.get<GameSummary>(`${API_BASE_URL}/games/${gameId}/summary`));
  }

  createShare(gameId: number) {
    if (this.appModeService.isGuestMode()) {
      throw new Error('Le partage public est reserve au mode connecte.');
    }

    return firstValueFrom(this.http.post<GameShareInfo>(`${API_BASE_URL}/games/${gameId}/share`, {}));
  }

  createPublicShare(payload: GameSummaryExport) {
    return firstValueFrom(this.http.post<GameShareInfo>(`${API_BASE_URL}/public/game-shares`, payload));
  }
}

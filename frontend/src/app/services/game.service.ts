import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { AppModeService } from '../core/app-mode.service';
import { GameDetail, GameListItem, GameSummary } from '../core/models';
import { GuestStorageService } from './guest-storage.service';

export interface CreateGamePayload {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly appModeService = inject(AppModeService);
  private readonly guestStorageService = inject(GuestStorageService);

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
    return this.appModeService.isGuestMode()
      ? this.guestStorageService.createGame(payload)
      : firstValueFrom(this.http.post<GameDetail>(`${API_BASE_URL}/games`, payload));
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
}

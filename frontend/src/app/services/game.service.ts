import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { GameDetail, GameListItem, GameSummary } from '../core/models';

export interface CreateGamePayload {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);

  readonly games = signal<GameListItem[]>([]);

  async loadGames(teamId?: number) {
    const params = teamId ? new HttpParams().set('teamId', String(teamId)) : undefined;
    const games = await firstValueFrom(this.http.get<GameListItem[]>(`${API_BASE_URL}/games`, { params }));
    this.games.set(games);
    return games;
  }

  createGame(payload: CreateGamePayload) {
    return firstValueFrom(this.http.post<GameDetail>(`${API_BASE_URL}/games`, payload));
  }

  getGame(gameId: number) {
    return firstValueFrom(this.http.get<GameDetail>(`${API_BASE_URL}/games/${gameId}`));
  }

  getSummary(gameId: number) {
    return firstValueFrom(this.http.get<GameSummary>(`${API_BASE_URL}/games/${gameId}/summary`));
  }
}

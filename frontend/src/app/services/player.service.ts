import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { AppModeService } from '../core/app-mode.service';
import { Player } from '../core/models';
import { GuestStorageService } from './guest-storage.service';

export interface PlayerPayload {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly http = inject(HttpClient);
  private readonly appModeService = inject(AppModeService);
  private readonly guestStorageService = inject(GuestStorageService);

  readonly roster = signal<Player[]>([]);

  async loadPlayers(teamId: number) {
    const players = this.appModeService.isGuestMode()
      ? await this.guestStorageService.loadPlayers(teamId)
      : await firstValueFrom(this.http.get<Player[]>(`${API_BASE_URL}/teams/${teamId}/players`));
    this.roster.set(players);
    return players;
  }

  async createPlayer(teamId: number, payload: PlayerPayload) {
    if (this.appModeService.isGuestMode()) {
      await this.guestStorageService.createPlayer(teamId, payload);
    } else {
      await firstValueFrom(this.http.post<Player>(`${API_BASE_URL}/teams/${teamId}/players`, payload));
    }
    return this.loadPlayers(teamId);
  }

  async updatePlayer(teamId: number, playerId: number, payload: PlayerPayload) {
    if (this.appModeService.isGuestMode()) {
      await this.guestStorageService.updatePlayer(teamId, playerId, payload);
    } else {
      await firstValueFrom(this.http.put<Player>(`${API_BASE_URL}/players/${playerId}`, payload));
    }
    return this.loadPlayers(teamId);
  }

  async deletePlayer(teamId: number, playerId: number) {
    if (this.appModeService.isGuestMode()) {
      await this.guestStorageService.deletePlayer(teamId, playerId);
    } else {
      await firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/players/${playerId}`));
    }
    return this.loadPlayers(teamId);
  }
}

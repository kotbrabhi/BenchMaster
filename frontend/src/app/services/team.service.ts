import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { AppModeService } from '../core/app-mode.service';
import { Team } from '../core/models';
import { GuestStorageService } from './guest-storage.service';

export interface TeamSeedPlayerPayload {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

export interface TeamPayload {
  name: string;
  players?: TeamSeedPlayerPayload[];
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly appModeService = inject(AppModeService);
  private readonly guestStorageService = inject(GuestStorageService);

  readonly teams = signal<Team[]>([]);

  async loadTeams() {
    const teams = this.appModeService.isGuestMode()
      ? await this.guestStorageService.loadTeams()
      : await firstValueFrom(this.http.get<Team[]>(`${API_BASE_URL}/teams`));
    this.teams.set(teams);
    return teams;
  }

  async createTeam(payload: TeamPayload) {
    const team = this.appModeService.isGuestMode()
      ? await this.guestStorageService.createTeam(payload)
      : await firstValueFrom(this.http.post<Pick<Team, 'id' | 'name'>>(`${API_BASE_URL}/teams`, payload));
    await this.loadTeams();
    return team;
  }

  async updateTeam(teamId: number, payload: { name: string }) {
    if (this.appModeService.isGuestMode()) {
      await this.guestStorageService.updateTeam(teamId, payload);
    } else {
      await firstValueFrom(this.http.put<Team>(`${API_BASE_URL}/teams/${teamId}`, payload));
    }
    return this.loadTeams();
  }

  async deleteTeam(teamId: number) {
    if (this.appModeService.isGuestMode()) {
      await this.guestStorageService.deleteTeam(teamId);
    } else {
      await firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/teams/${teamId}`));
    }
    return this.loadTeams();
  }
}

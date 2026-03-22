import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { Team } from '../core/models';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);

  readonly teams = signal<Team[]>([]);

  async loadTeams() {
    const teams = await firstValueFrom(this.http.get<Team[]>(`${API_BASE_URL}/teams`));
    this.teams.set(teams);
    return teams;
  }

  async createTeam(payload: { name: string }) {
    const team = await firstValueFrom(this.http.post<Pick<Team, 'id' | 'name'>>(`${API_BASE_URL}/teams`, payload));
    await this.loadTeams();
    return team;
  }

  async updateTeam(teamId: number, payload: { name: string }) {
    await firstValueFrom(this.http.put<Team>(`${API_BASE_URL}/teams/${teamId}`, payload));
    return this.loadTeams();
  }

  async deleteTeam(teamId: number) {
    await firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/teams/${teamId}`));
    return this.loadTeams();
  }
}

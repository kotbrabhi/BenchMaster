import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { AppModeService } from '../core/app-mode.service';
import { GameDetail, PlayerStatType } from '../core/models';
import { GuestStorageService } from './guest-storage.service';

@Injectable({ providedIn: 'root' })
export class LiveMatchService {
  private readonly http = inject(HttpClient);
  private readonly appModeService = inject(AppModeService);
  private readonly guestStorageService = inject(GuestStorageService);

  readonly game = signal<GameDetail | null>(null);
  readonly selectedBenchPlayerIds = signal<number[]>([]);
  readonly selectedActivePlayerIds = signal<number[]>([]);
  readonly pendingBenchPlayers = computed(() => {
    const game = this.game();
    const selectedIds = new Set(this.selectedBenchPlayerIds());
    return game?.benchPlayers.filter((player) => selectedIds.has(player.playerId)) ?? [];
  });
  readonly pendingActivePlayers = computed(() => {
    const game = this.game();
    const selectedIds = new Set(this.selectedActivePlayerIds());
    return game?.activePlayers.filter((player) => selectedIds.has(player.playerId)) ?? [];
  });
  readonly vacancyCount = computed(() => Math.max(0, 5 - (this.game()?.activePlayers.length ?? 0)));
  readonly canApplySubstitutionBatch = computed(() => {
    const benchCount = this.selectedBenchPlayerIds().length;
    const activeCount = this.selectedActivePlayerIds().length;
    return benchCount > 0 && benchCount === activeCount + this.vacancyCount();
  });

  async loadGame(gameId: number) {
    const game = this.appModeService.isGuestMode()
      ? await this.guestStorageService.getGame(gameId)
      : await firstValueFrom(this.http.get<GameDetail>(`${API_BASE_URL}/games/${gameId}`));
    this.game.set(game);
    this.syncPendingSelection();
    return game;
  }

  toggleBenchPlayer(playerId: number) {
    this.selectedBenchPlayerIds.update((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  toggleActivePlayer(playerId: number) {
    this.selectedActivePlayerIds.update((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  clearSelections() {
    this.selectedBenchPlayerIds.set([]);
    this.selectedActivePlayerIds.set([]);
  }

  async startGame(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.startGame(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/start`)
    );
  }

  async pauseGame(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.pauseGame(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/pause`)
    );
  }

  async resumeGame(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.resumeGame(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/resume`)
    );
  }

  async completePeriod(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.completePeriod(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/periods/complete`)
    );
  }

  async startNextPeriod(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.startNextPeriod(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/periods/start`)
    );
  }

  async endGame(gameId: number) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.endGame(gameId)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/end`)
    );
  }

  async substitute(gameId: number) {
    if (!this.canApplySubstitutionBatch()) {
      return null;
    }

    const game = await this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.substitutePlayers(gameId, this.selectedBenchPlayerIds(), this.selectedActivePlayerIds())
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/substitutions`, {
            playerInIds: this.selectedBenchPlayerIds(),
            playerOutIds: this.selectedActivePlayerIds()
          })
    );

    this.clearSelections();
    return game;
  }

  async recordPlayerPoints(gameId: number, playerId: number, points: number, correction = false) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.recordPlayerPoints(gameId, playerId, points, correction)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/players/${playerId}/points`, {
            points,
            correction
          })
    );
  }

  async recordPlayerStat(gameId: number, playerId: number, stat: PlayerStatType, correction = false) {
    return this.updateGame(() =>
      this.appModeService.isGuestMode()
        ? this.guestStorageService.recordPlayerStat(gameId, playerId, stat, correction)
        : this.postGameUpdate(`${API_BASE_URL}/games/${gameId}/players/${playerId}/stats`, {
            stat,
            correction
          })
    );
  }

  private async updateGame(action: () => Promise<GameDetail>) {
    const game = await action();
    this.game.set(game);
    this.syncPendingSelection();
    return game;
  }

  private postGameUpdate(url: string, body: unknown = {}) {
    return firstValueFrom(this.http.post<GameDetail>(url, body));
  }

  private syncPendingSelection() {
    const game = this.game();
    const benchIds = new Set(game?.benchPlayers.map((player) => player.playerId) ?? []);
    const activeIds = new Set(game?.activePlayers.map((player) => player.playerId) ?? []);

    this.selectedBenchPlayerIds.update((current) => current.filter((playerId) => benchIds.has(playerId)));
    this.selectedActivePlayerIds.update((current) => current.filter((playerId) => activeIds.has(playerId)));
  }
}

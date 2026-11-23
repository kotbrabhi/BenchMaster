import { Injectable } from '@angular/core';
import { GamePlayerState } from '../core/models';
import { GuestState } from './guest-storage.types';

export const GUEST_STORAGE_KEY = 'benchmaster.guest-state';

function normalizeGamePlayer(player: GamePlayerState): GamePlayerState {
  return {
    ...player,
    interceptions: player.interceptions ?? 0,
    fouls: player.fouls ?? 0,
    periodFouls: player.periodFouls ?? 0
  };
}

export function defaultGuestState(): GuestState {
  return {
    team: null,
    game: null,
    nextPlayerId: 1,
    nextGameId: 1
  };
}

@Injectable({ providedIn: 'root' })
export class GuestStateStore {
  readState(): GuestState {
    const rawState = localStorage.getItem(GUEST_STORAGE_KEY);

    if (!rawState) {
      return defaultGuestState();
    }

    try {
      const parsedState = JSON.parse(rawState) as GuestState;
      const normalizedTeam = parsedState.team
        ? {
            ...parsedState.team,
            gender: parsedState.team.gender ?? 'MIXED'
          }
        : null;
      const normalizedGame = parsedState.game
        ? {
            ...parsedState.game,
            team: {
              ...parsedState.game.team,
              gender: parsedState.game.team.gender ?? 'MIXED'
            },
            rotationTimeline: parsedState.game.rotationTimeline ?? [],
            selectedPlayers: (parsedState.game.selectedPlayers ?? []).map(normalizeGamePlayer),
            activePlayers: (parsedState.game.activePlayers ?? []).map(normalizeGamePlayer),
            benchPlayers: (parsedState.game.benchPlayers ?? []).map(normalizeGamePlayer),
            sessionType: parsedState.game.sessionType ?? 'GAME',
            periodCount: parsedState.game.periodCount ?? 4,
            periodDurationSeconds: parsedState.game.periodDurationSeconds ?? 600
          }
        : null;

      return {
        ...defaultGuestState(),
        ...parsedState,
        team: normalizedTeam,
        game: normalizedGame
      };
    } catch {
      return defaultGuestState();
    }
  }

  writeState(state: GuestState): void {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
  }
}

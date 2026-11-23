import { Injectable } from '@angular/core';
import { GameDetail, GameListItem, GamePlayerState, GameStatus } from '../core/models';
import { getTeamLabelSet } from '../core/team-labels';
import { GuestStateStore } from './guest-state.store';
import { GuestState, CreateGamePayload } from './guest-storage.types';
import { buildSummaryFromGame, clone, defaultGameLabel, rebuildGameCollections, sortGamePlayersByJersey } from './guest-match.utils';

@Injectable({ providedIn: 'root' })
export class GuestGameService {
  constructor(private readonly store: GuestStateStore) {}

  async loadGames() {
    const state = this.store.readState();
    return state.game ? [this.toGameListItem(state.game)] : [];
  }

  async createGame(payload: CreateGamePayload) {
    const state = this.store.readState();
    const team = this.requireTeam(state, payload.teamId);
    const labels = getTeamLabelSet(team.gender);
    const availablePlayerIds = payload.availablePlayerIds.map(Number);
    const starterPlayerIds = payload.starterPlayerIds.map(Number);
    if (!availablePlayerIds.length) throw new Error(`Sélectionnez au moins ${labels.playerIndefiniteSingular} disponible.`);
    if (new Set(availablePlayerIds).size !== availablePlayerIds.length) throw new Error(`La liste des ${labels.playerPlural} disponibles contient des doublons.`);
    if (new Set(starterPlayerIds).size !== starterPlayerIds.length) throw new Error('La liste des titulaires contient des doublons.');
    if (payload.sessionType !== 'TRAINING' && starterPlayerIds.length > 5) throw new Error('Vous pouvez sélectionner au maximum cinq titulaires.');
    const missingStarter = payload.sessionType === 'TRAINING' ? undefined : starterPlayerIds.find((id) => !availablePlayerIds.includes(id));
    if (missingStarter) throw new Error(`Les titulaires doivent être choisi·es parmi les ${labels.playerPlural} disponibles.`);
    const rosterMap = new Map(team.players.map((player) => [player.id, player]));
    const invalidPlayerId = availablePlayerIds.find((id) => !rosterMap.has(id));
    if (invalidPlayerId) throw new Error(`Les ${labels.playerPlural} sélectionné·es doivent appartenir à l'équipe choisie.`);

    const createdAt = new Date().toISOString();
    const selectedPlayers = availablePlayerIds.map((playerId, index) => {
      const player = rosterMap.get(playerId)!;
      return {
        gamePlayerId: index + 1, playerId: player.id, name: player.name, jerseyNumber: player.jerseyNumber, position: player.position,
        isStarter: starterPlayerIds.includes(player.id), totalSeconds: 0, periodSeconds: 0, points: 0, assists: 0,
        blocks: 0, rebounds: 0, interceptions: 0, fouls: 0, periodFouls: 0, isOnCourt: false,
        lastEnteredAt: null, lastPeriodEnteredAt: null
      } satisfies GamePlayerState;
    });
    state.game = {
      id: state.nextGameId, label: payload.label?.trim() || defaultGameLabel(), status: 'DRAFT', sessionType: payload.sessionType ?? 'GAME',
      periodCount: payload.periodCount ?? 4, periodDurationSeconds: payload.periodDurationSeconds ?? 600,
      currentPeriodNumber: 1, currentPeriodStatus: 'NOT_STARTED', startedAt: null, endedAt: null, isClockRunning: false,
      clockElapsedSeconds: 0, lastClockStartedAt: null, periodElapsedSeconds: 0, lastPeriodStartedAt: null, createdAt,
      team: { id: team.id, name: team.name, gender: team.gender }, rotationTimeline: [], selectedPlayers, activePlayers: [], benchPlayers: []
    };
    state.nextGameId += 1;
    rebuildGameCollections(state.game);
    this.store.writeState(state);
    return clone(state.game);
  }

  async getGame(gameId: number) {
    return clone(this.requireGame(this.store.readState(), gameId));
  }

  async getSummary(gameId: number) {
    return buildSummaryFromGame(this.requireGame(this.store.readState(), gameId));
  }

  private toGameListItem(game: GameDetail): GameListItem {
    return {
      id: game.id, label: game.label, status: game.status as GameStatus, createdAt: game.createdAt,
      teamId: game.team.id, teamName: game.team.name, teamGender: game.team.gender,
      selectedCount: game.selectedPlayers.length, activeCount: game.activePlayers.length, sessionType: game.sessionType
    };
  }

  private requireTeam(state: GuestState, teamId: number) {
    if (!state.team || state.team.id !== teamId) throw new Error('Équipe introuvable.');
    return state.team;
  }

  requireGame(state: GuestState, gameId: number) {
    if (!state.game || state.game.id !== gameId) throw new Error('Match introuvable.');
    return state.game;
  }
}

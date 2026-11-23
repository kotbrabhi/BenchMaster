import { Injectable } from '@angular/core';
import { GameDetail, PlayerStatType, TeamGender } from '../core/models';
import { GuestGameService } from './guest-game.service';
import { GuestLiveMatchService } from './guest-live-match.service';
import { rebuildGameCollections, clone } from './guest-match.utils';
import { GuestRosterService } from './guest-roster.service';
import { GuestStateStore } from './guest-state.store';
import { TeamPayload, CreateGamePayload } from './guest-storage.types';

@Injectable({ providedIn: 'root' })
export class GuestStorageService {
  constructor(
    private readonly store: GuestStateStore,
    private readonly roster: GuestRosterService,
    private readonly games: GuestGameService,
    private readonly live: GuestLiveMatchService
  ) {}

  loadTeams() { return this.roster.loadTeams(); }
  createTeam(payload: TeamPayload) { return this.roster.createTeam(payload); }
  updateTeam(teamId: number, payload: { name: string; gender?: TeamGender }) { return this.roster.updateTeam(teamId, payload); }
  deleteTeam(teamId: number) { return this.roster.deleteTeam(teamId); }
  loadPlayers(teamId: number) { return this.roster.loadPlayers(teamId); }
  createPlayer(teamId: number, payload: { name: string; jerseyNumber: string; position?: string | null }) { return this.roster.createPlayer(teamId, payload); }
  updatePlayer(teamId: number, playerId: number, payload: { name: string; jerseyNumber: string; position?: string | null }) { return this.roster.updatePlayer(teamId, playerId, payload); }
  deletePlayer(teamId: number, playerId: number) { return this.roster.deletePlayer(teamId, playerId); }

  loadGames() { return this.games.loadGames(); }
  createGame(payload: CreateGamePayload) { return this.games.createGame(payload); }
  getGame(gameId: number) { return this.games.getGame(gameId); }
  getSummary(gameId: number) { return this.games.getSummary(gameId); }

  addTrainingPlayer(gameId: number, playerId: number) { return this.live.addTrainingPlayer(gameId, playerId); }
  startGame(gameId: number) { return this.live.startGame(this.updateGame, gameId); }
  pauseGame(gameId: number) { return this.live.pauseGame(this.updateGame, gameId); }
  resumeGame(gameId: number) { return this.live.resumeGame(this.updateGame, gameId); }
  completePeriod(gameId: number) { return this.live.completePeriod(this.updateGame, gameId); }
  startNextPeriod(gameId: number) { return this.live.startNextPeriod(this.updateGame, gameId); }
  endGame(gameId: number) { return this.live.endGame(this.updateGame, gameId); }
  substitutePlayers(gameId: number, playerInIds: number[], playerOutIds: number[]) { return this.live.substitutePlayers(this.updateGame, gameId, playerInIds, playerOutIds); }
  recordPlayerPoints(gameId: number, playerId: number, points: number, correction = false) { return this.live.recordPlayerPoints(this.updateGame, gameId, playerId, points, correction); }
  recordPlayerStat(gameId: number, playerId: number, stat: PlayerStatType, correction = false) { return this.live.recordPlayerStat(this.updateGame, gameId, playerId, stat, correction); }

  private updateGame = async (gameId: number, updater: (game: GameDetail) => void) => {
    const state = this.store.readState();
    if (!state.game || state.game.id !== gameId) throw new Error('Match introuvable.');
    const game = clone(state.game);
    updater(game);
    rebuildGameCollections(game);
    state.game = game;
    this.store.writeState(state);
    return clone(game);
  };
}

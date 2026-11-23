import { Injectable } from '@angular/core';
import { Player, Team, TeamGender } from '../core/models';
import { getTeamLabelSet } from '../core/team-labels';
import { GuestStateStore, defaultGuestState } from './guest-state.store';
import { GuestState, GuestTeamRecord, TeamPayload, GUEST_TEAM_ID } from './guest-storage.types';
import { capitalize, clone, rebuildGameCollections, sortPlayersByJersey } from './guest-match.utils';

@Injectable({ providedIn: 'root' })
export class GuestRosterService {
  constructor(private readonly store: GuestStateStore) {}

  async loadTeams() {
    const state = this.store.readState();
    return state.team ? [this.toTeam(state.team)] : [];
  }

  async createTeam(payload: TeamPayload) {
    const state = this.store.readState();
    const name = payload.name.trim();
    const gender = payload.gender ?? 'MIXED';
    const players = this.normalizeSeedPlayers(payload.players, gender);
    if (!name) throw new Error("Le nom de l'équipe est obligatoire.");
    if (state.team) throw new Error('En mode invité, une seule équipe locale est autorisée.');

    const createdAt = new Date().toISOString();
    state.team = {
      id: GUEST_TEAM_ID, name, gender, createdAt, updatedAt: new Date().toISOString(),
      players: players.map((player, index) => ({ id: state.nextPlayerId + index, teamId: GUEST_TEAM_ID, ...player }))
    };
    state.nextPlayerId += players.length;
    this.syncGameWithRoster(state);
    this.store.writeState(state);
    return { id: state.team.id, name: state.team.name, gender: state.team.gender };
  }

  async updateTeam(teamId: number, payload: { name: string; gender?: TeamGender }) {
    const state = this.store.readState();
    const team = this.requireTeam(state, teamId);
    const name = payload.name.trim();
    if (!name) throw new Error("Le nom de l'équipe est obligatoire.");
    team.name = name;
    team.gender = payload.gender ?? 'MIXED';
    team.updatedAt = new Date().toISOString();
    this.syncGameWithRoster(state);
    this.store.writeState(state);
    return this.toTeam(team);
  }

  async deleteTeam(teamId: number) {
    const state = this.store.readState();
    this.requireTeam(state, teamId);
    this.store.writeState(defaultGuestState());
  }

  async loadPlayers(teamId: number) {
    const state = this.store.readState();
    return sortPlayersByJersey(this.requireTeam(state, teamId).players);
  }

  async createPlayer(teamId: number, payload: { name: string; jerseyNumber: string; position?: string | null }) {
    const state = this.store.readState();
    const team = this.requireTeam(state, teamId);
    const player: Player = { id: state.nextPlayerId, teamId: team.id, ...this.validatePlayerPayload(payload, team.players, team.gender) };
    state.nextPlayerId += 1;
    team.players.push(player);
    team.updatedAt = new Date().toISOString();
    this.syncGameWithRoster(state);
    this.store.writeState(state);
    return player;
  }

  async updatePlayer(teamId: number, playerId: number, payload: { name: string; jerseyNumber: string; position?: string | null }) {
    const state = this.store.readState();
    const team = this.requireTeam(state, teamId);
    const player = team.players.find((entry) => entry.id === playerId);
    if (!player) throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerSingular)} introuvable.`);
    const normalized = this.validatePlayerPayload(payload, team.players, team.gender, playerId);
    if (team.players.some((entry) => entry.id !== playerId && entry.jerseyNumber === normalized.jerseyNumber)) {
      throw new Error('Ce numéro est déjà utilisé dans cette équipe.');
    }
    player.name = normalized.name;
    player.jerseyNumber = normalized.jerseyNumber;
    player.position = normalized.position;
    team.updatedAt = new Date().toISOString();
    this.syncGameWithRoster(state);
    this.store.writeState(state);
    return player;
  }

  async deletePlayer(teamId: number, playerId: number) {
    const state = this.store.readState();
    const team = this.requireTeam(state, teamId);
    if (state.game && state.game.status !== 'FINISHED' && state.game.selectedPlayers.some((player) => player.playerId === playerId)) {
      throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerDemonstrativeSingular)} est déjà lié·e à un match local en cours et ne peut pas être supprimé·e.`);
    }
    const nextPlayers = team.players.filter((player) => player.id !== playerId);
    if (nextPlayers.length === team.players.length) throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerSingular)} introuvable.`);
    team.players = nextPlayers;
    team.updatedAt = new Date().toISOString();
    this.syncGameWithRoster(state);
    this.store.writeState(state);
  }

  syncGameWithRoster(state: GuestState) {
    const team = state.team;
    if (!team || !state.game) return;
    state.game.team.name = team.name;
    state.game.team.gender = team.gender;
    state.game.selectedPlayers = state.game.selectedPlayers.map((player) => {
      const rosterPlayer = team.players.find((entry) => entry.id === player.playerId);
      return rosterPlayer ? { ...player, name: rosterPlayer.name, jerseyNumber: rosterPlayer.jerseyNumber, position: rosterPlayer.position } : player;
    });
    rebuildGameCollections(state.game);
  }

  private toTeam(team: GuestTeamRecord): Team {
    return { id: team.id, name: team.name, gender: team.gender, playerCount: team.players.length, createdAt: team.createdAt, updatedAt: team.updatedAt };
  }

  private validatePlayerPayload(payload: { name: string; jerseyNumber: string; position?: string | null }, existingPlayers: Player[], teamGender: TeamGender = 'MIXED', excludedPlayerId?: number) {
    const name = payload.name.trim();
    const jerseyNumber = payload.jerseyNumber.trim();
    const position = payload.position?.trim() || null;
    const labels = getTeamLabelSet(teamGender);
    if (!name) throw new Error(`Le nom ${labels.playerOfDefiniteSingular} est obligatoire.`);
    if (!/^\d+$/.test(jerseyNumber)) throw new Error('Le numéro doit contenir uniquement des chiffres.');
    if (existingPlayers.some((player) => player.id !== excludedPlayerId && player.jerseyNumber === jerseyNumber)) {
      throw new Error(`${capitalize(labels.playerIndefiniteSingular)} utilise déjà ce numéro dans cette équipe.`);
    }
    return { name, jerseyNumber, position };
  }

  private normalizeSeedPlayers(players: TeamPayload['players'], teamGender: TeamGender = 'MIXED') {
    const usedJerseyNumbers = new Set<string>();
    const labels = getTeamLabelSet(teamGender);
    return (players ?? []).map((player, index) => {
      const name = player.name.trim();
      const jerseyNumber = String(player.jerseyNumber ?? '').trim();
      const position = player.position?.trim() || null;
      if (!name) throw new Error(`Le nom ${labels.playerOfDefiniteSingular} n°${index + 1} est obligatoire.`);
      if (!/^\d+$/.test(jerseyNumber)) throw new Error(`Le numéro ${labels.playerOfDefiniteSingular} ${name} doit contenir uniquement des chiffres.`);
      if (usedJerseyNumbers.has(jerseyNumber)) throw new Error(`Le numéro ${jerseyNumber} est utilisé plusieurs fois dans la liste.`);
      usedJerseyNumbers.add(jerseyNumber);
      return { name, jerseyNumber, position };
    });
  }

  private requireTeam(state: GuestState, teamId: number) {
    if (!state.team || state.team.id !== teamId) throw new Error('Équipe introuvable.');
    return state.team;
  }
}

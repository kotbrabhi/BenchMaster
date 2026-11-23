import { GameDetail, Player, TeamGender } from '../core/models';

export interface GuestTeamRecord {
  id: number;
  name: string;
  gender: TeamGender;
  createdAt: string;
  updatedAt: string;
  players: Player[];
}

export interface GuestState {
  team: GuestTeamRecord | null;
  game: GameDetail | null;
  nextPlayerId: number;
  nextGameId: number;
}

export interface TeamSeedPlayerPayload {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

export interface TeamPayload {
  name: string;
  gender?: TeamGender;
  players?: TeamSeedPlayerPayload[];
}

export interface CreateGamePayload {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
  sessionType?: 'GAME' | 'TRAINING';
  periodCount?: number;
  periodDurationSeconds?: number;
}

export interface RotationEventPayload {
  onCourtPlayerIds: number[];
  playerInIds?: number[];
  playerOutIds?: number[];
}

export const GUEST_TEAM_ID = 1;

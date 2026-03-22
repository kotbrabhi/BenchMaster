export type GameStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'FINISHED';
export type PeriodStatus = 'NOT_STARTED' | 'LIVE' | 'COMPLETED';

export interface Player {
  id: number;
  teamId: number;
  name: string;
  jerseyNumber: string;
  position: string | null;
}

export interface Team {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  players: Player[];
}

export interface GamePlayerState {
  gamePlayerId: number;
  playerId: number;
  name: string;
  jerseyNumber: string;
  position: string | null;
  isStarter: boolean;
  totalSeconds: number;
  periodSeconds: number;
  points: number;
  isOnCourt: boolean;
  lastEnteredAt: string | null;
  lastPeriodEnteredAt: string | null;
}

export interface GameListItem {
  id: number;
  label: string;
  status: GameStatus;
  createdAt: string;
  teamId: number;
  teamName: string;
  selectedCount: number;
  activeCount: number;
}

export interface GameDetail {
  id: number;
  label: string;
  status: GameStatus;
  currentPeriodNumber: number;
  currentPeriodStatus: PeriodStatus;
  startedAt: string | null;
  endedAt: string | null;
  isClockRunning: boolean;
  clockElapsedSeconds: number;
  lastClockStartedAt: string | null;
  periodElapsedSeconds: number;
  lastPeriodStartedAt: string | null;
  createdAt: string;
  team: {
    id: number;
    name: string;
  };
  selectedPlayers: GamePlayerState[];
  activePlayers: GamePlayerState[];
  benchPlayers: GamePlayerState[];
}

export interface GameSummary {
  id: number;
  label: string;
  status: GameStatus;
  startedAt: string | null;
  endedAt: string | null;
  team: {
    id: number;
    name: string;
  };
  totalGameSeconds: number;
  maxPlayerSeconds: number;
  players: GamePlayerState[];
}

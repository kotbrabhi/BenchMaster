export type GameStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'FINISHED';
export type PeriodStatus = 'NOT_STARTED' | 'LIVE' | 'COMPLETED';
export type PlayerStatType = 'assists' | 'blocks' | 'rebounds' | 'interceptions' | 'fouls';
export type AppMode = 'guest' | 'authenticated';
export type TeamGender = 'MIXED' | 'FEMININE' | 'MASCULINE';
export type RotationEventType = 'PERIOD_START' | 'SUBSTITUTION' | 'PERIOD_END' | 'GAME_END';

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
  gender: TeamGender;
  playerCount: number;
  createdAt?: string;
  updatedAt?: string;
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
  assists: number;
  blocks: number;
  rebounds: number;
  interceptions: number;
  fouls: number;
  periodFouls: number;
  isOnCourt: boolean;
  lastEnteredAt: string | null;
  lastPeriodEnteredAt: string | null;
}

export interface RotationTimelineEvent {
  id: number;
  kind: RotationEventType;
  periodNumber: number;
  clockMarkSeconds: number;
  createdAt: string;
  playersIn: GamePlayerState[];
  playersOut: GamePlayerState[];
  onCourt: GamePlayerState[];
}

export interface SummaryUsageInsight {
  playerId: number;
  name: string;
  jerseyNumber: string;
  isStarter: boolean;
  totalSeconds: number;
  expectedSeconds: number;
  deltaSeconds: number;
  utilizationRatio: number;
}

export interface StarterBenchSplit {
  starterCount: number;
  benchCount: number;
  starterSeconds: number;
  benchSeconds: number;
  starterAverageSeconds: number;
  benchAverageSeconds: number;
  starterShare: number;
  benchShare: number;
}

export interface GameSummaryInsights {
  topMinutes: SummaryUsageInsight[];
  overusedPlayers: SummaryUsageInsight[];
  underusedPlayers: SummaryUsageInsight[];
  starterBenchSplit: StarterBenchSplit;
}

export interface GameListItem {
  id: number;
  label: string;
  status: GameStatus;
  createdAt: string;
  teamId: number;
  teamName: string;
  teamGender: TeamGender;
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
    gender: TeamGender;
  };
  rotationTimeline: RotationTimelineEvent[];
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
    gender: TeamGender;
  };
  totalGameSeconds: number;
  totalPlayerSeconds: number;
  maxPlayerSeconds: number;
  insights: GameSummaryInsights;
  rotationTimeline: RotationTimelineEvent[];
  players: GamePlayerState[];
}

export interface GameSummaryExport {
  schemaVersion: number;
  exportedAt: string;
  shareId: string | null;
  game: {
    id: number;
    label: string;
    status: GameStatus;
    startedAt: string | null;
    endedAt: string | null;
    totalGameSeconds: number;
    totalPlayerSeconds: number;
    maxPlayerSeconds: number;
  };
  team: {
    id: number;
    name: string;
    gender: TeamGender;
  };
  totals: {
    points: number;
    assists: number;
    blocks: number;
    rebounds: number;
    interceptions: number;
    fouls: number;
  };
  players: Array<{
    playerId: number;
    name: string;
    jerseyNumber: string;
    position: string | null;
    isStarter: boolean;
    isOnCourt: boolean;
    timing: {
      totalSeconds: number;
      periodSeconds: number;
    };
    stats: {
      points: number;
      assists: number;
      blocks: number;
      rebounds: number;
      interceptions: number;
      fouls: number;
      periodFouls: number;
    };
  }>;
  insights: GameSummaryInsights;
  rotationTimeline: Array<{
    id: number;
    kind: RotationEventType;
    periodNumber: number;
    clockMarkSeconds: number;
    createdAt: string;
    playersIn: Array<{
      playerId: number;
      name: string;
      jerseyNumber: string;
    }>;
    playersOut: Array<{
      playerId: number;
      name: string;
      jerseyNumber: string;
    }>;
    onCourt: Array<{
      playerId: number;
      name: string;
      jerseyNumber: string;
    }>;
  }>;
}

export interface GameShareInfo {
  shareId: string;
  path: string;
  url: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

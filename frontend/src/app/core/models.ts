export type GameStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'FINISHED';
export type PeriodStatus = 'NOT_STARTED' | 'LIVE' | 'COMPLETED';
export type PlayerStatType = 'assists' | 'blocks' | 'rebounds' | 'interceptions' | 'fouls';
export type AppMode = 'guest' | 'authenticated';
export type TeamGender = 'MIXED' | 'FEMININE' | 'MASCULINE';
export type FriendlyProposalStatus = 'DRAFT' | 'OPEN' | 'IN_DISCUSSION' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';
export type FriendlyApplicationStatus = 'INTERESTED' | 'COLLECTING' | 'SUBMITTED' | 'NEEDS_RECONFIRMATION' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
export type FriendlyAvailability = 'AVAILABLE' | 'UNAVAILABLE';
export type FriendlyNotificationType = 'INTEREST_RECEIVED' | 'TEAM_SUBMITTED' | 'MATCH_CONFIRMED' | 'APPLICATION_REJECTED' | 'MATCH_CANCELLED';
export type FriendlyMatchLifecycle = 'CONFIRMED' | 'CANCELLED';
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

export interface FriendlyMatchProposal {
  id: number;
  organizerTeamId: number;
  createdByUserId?: number;
  status: FriendlyProposalStatus;
  category: string;
  startsAt: string;
  durationMinutes: number | null;
  area: string;
  venueName: string | null;
  format: string;
  requestedPlayerCount: number | null;
  level: string | null;
  notes: string | null;
  responseDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  organizerTeam: Pick<Team, 'id' | 'name' | 'gender'>;
}

export interface FriendlyMatchProposalPayload {
  organizerTeamId: number;
  category: string;
  startsAt: string;
  durationMinutes?: number | null;
  area: string;
  venueName?: string | null;
  format: string;
  requestedPlayerCount?: number | null;
  level?: string | null;
  notes?: string | null;
  responseDeadline?: string | null;
}

export interface FriendlyPlayerResponse {
  id: number;
  playerId: number | null;
  playerNameSnapshot: string;
  jerseyNumberSnapshot: string;
  availability: FriendlyAvailability | null;
  respondedAt: string | null;
  revision: number;
  invite: { expiresAt: string; revokedAt: string | null } | null;
  availabilityHistory: Array<{ availability: FriendlyAvailability; respondedAt: string | null; changedAt: string }>;
}

export interface FriendlyMatchApplication {
  id: number;
  proposalId: number;
  teamId: number;
  coachUserId: number;
  status: FriendlyApplicationStatus;
  submittedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  team: Pick<Team, 'id' | 'name' | 'gender'>;
  proposal: {
    id: number;
    status: FriendlyProposalStatus;
    category: string;
    startsAt: string;
    durationMinutes: number | null;
    area: string;
    format: string;
    requestedPlayerCount: number | null;
    responseDeadline: string | null;
    organizerTeam: { name: string };
  };
  playerResponses: FriendlyPlayerResponse[];
  teamInvite: { expiresAt: string; revokedAt: string | null } | null;
  proposedPlayers: Array<{ id: number; playerId: number | null; playerNameSnapshot: string; jerseyNumberSnapshot: string }>;
}

export interface FriendlyCandidateApplication {
  id: number;
  proposalId: number;
  teamId: number;
  status: FriendlyApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  team: Pick<Team, 'id' | 'name' | 'gender'>;
  proposedPlayers: Array<{ id: number; playerNameSnapshot: string; jerseyNumberSnapshot: string }>;
}

export interface FriendlyConfirmedMatch {
  id: number;
  proposalId: number;
  applicationId: number;
  startsAt: string;
  durationMinutes: number | null;
  area: string;
  format: string;
  status: FriendlyMatchLifecycle;
  confirmedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  organizerTeam: { id: number; name: string };
  candidateTeam: { id: number; name: string };
  proposal: { category: string };
  application: { proposedPlayers: Array<{ playerNameSnapshot: string; jerseyNumberSnapshot: string }> };
}

export interface FriendlyNotification {
  id: number;
  type: FriendlyNotificationType;
  proposalId: number | null;
  applicationId: number | null;
  createdAt: string;
  readAt: string | null;
  perspective: 'ORGANIZER' | 'CANDIDATE';
  proposal: { category: string; startsAt: string; organizerTeam: { name: string } } | null;
  application: { team: { name: string } } | null;
}

export interface FriendlyInviteLink {
  path: string;
  expiresAt: string;
}

export interface PublicFriendlyInvite {
  proposal: {
    organizer: string;
    category: string;
    startsAt: string;
    durationMinutes: number | null;
    area: string;
    format: string;
    responseDeadline: string | null;
  };
  expiresAt: string;
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

import {
  GameDetail,
  GamePlayerState,
  GameSummary,
  GameSummaryInsights,
  Player,
  RotationTimelineEvent
} from '../core/models';
import { getTeamLabelSet } from '../core/team-labels';

export interface RotationEventPayload {
  onCourtPlayerIds: number[];
  playerInIds?: number[];
  playerOutIds?: number[];
}

export const statLabels: Record<'assists' | 'blocks' | 'rebounds' | 'interceptions' | 'fouls', string> = {
  assists: 'passe décisive',
  blocks: 'contre',
  rebounds: 'rebond',
  interceptions: 'interception',
  fouls: 'faute'
};

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function compareJerseyNumbers(left: string, right: string) {
  return Number(left) - Number(right) || left.localeCompare(right);
}

export function sortPlayersByJersey(players: Player[]) {
  return [...players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

export function sortGamePlayersByJersey(players: GamePlayerState[]) {
  return [...players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

export function sortGamePlayersByTime(players: GamePlayerState[]) {
  return [...players].sort((left, right) => {
    if (right.totalSeconds !== left.totalSeconds) {
      return right.totalSeconds - left.totalSeconds;
    }

    return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
  });
}

export function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function diffSeconds(from: string, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 1000));
}

export function effectivePeriodStatus(game: GameDetail) {
  if (game.currentPeriodStatus === 'NOT_STARTED' && game.status !== 'DRAFT' && game.startedAt) {
    return 'LIVE';
  }

  return game.currentPeriodStatus;
}

export function currentPeriodClockSeconds(game: GameDetail, now: Date) {
  return (
    game.periodElapsedSeconds +
    (game.isClockRunning && effectivePeriodStatus(game) === 'LIVE' && game.lastPeriodStartedAt
      ? diffSeconds(game.lastPeriodStartedAt, now)
      : 0)
  );
}

export function onCourtPlayerIds(players: GamePlayerState[]) {
  return players.filter((player) => player.isOnCourt).map((player) => player.playerId);
}

function nextRotationEventId(game: GameDetail) {
  return (game.rotationTimeline.at(-1)?.id ?? 0) + 1;
}

export function pushRotationEvent(
  game: GameDetail,
  kind: RotationTimelineEvent['kind'],
  periodNumber: number,
  clockMarkSeconds: number,
  payload: RotationEventPayload,
  createdAt: string
) {
  const playerMap = new Map(game.selectedPlayers.map((player) => [player.playerId, player]));
  const toPlayers = (playerIds: number[]) =>
    sortGamePlayersByJersey(
      playerIds
        .map((playerId) => playerMap.get(playerId))
        .filter((player): player is GamePlayerState => Boolean(player))
    );

  game.rotationTimeline.push({
    id: nextRotationEventId(game),
    kind,
    periodNumber,
    clockMarkSeconds,
    createdAt,
    playersIn: toPlayers(payload.playerInIds ?? []),
    playersOut: toPlayers(payload.playerOutIds ?? []),
    onCourt: toPlayers(payload.onCourtPlayerIds)
  });
}

function buildSummaryInsights(players: GamePlayerState[]): { totalPlayerSeconds: number; insights: GameSummaryInsights } {
  const totalPlayerSeconds = players.reduce((sum, player) => sum + player.totalSeconds, 0);
  const expectedSeconds = players.length ? totalPlayerSeconds / players.length : 0;
  const usageEntries = players.map((player) => ({
    playerId: player.playerId,
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    isStarter: player.isStarter,
    totalSeconds: player.totalSeconds,
    expectedSeconds,
    deltaSeconds: player.totalSeconds - expectedSeconds,
    utilizationRatio: expectedSeconds > 0 ? player.totalSeconds / expectedSeconds : 1
  }));

  const topMinutes = usageEntries
    .slice()
    .sort((left, right) => right.totalSeconds - left.totalSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const overusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds >= 60 && player.utilizationRatio >= 1.15)
    .sort((left, right) => right.deltaSeconds - left.deltaSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const underusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds <= -60 && player.utilizationRatio <= 0.85)
    .sort((left, right) => left.deltaSeconds - right.deltaSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const starterSeconds = players.filter((player) => player.isStarter).reduce((sum, player) => sum + player.totalSeconds, 0);
  const benchSeconds = totalPlayerSeconds - starterSeconds;
  const starterCount = players.filter((player) => player.isStarter).length;
  const benchCount = players.length - starterCount;

  return {
    totalPlayerSeconds,
    insights: {
      topMinutes,
      overusedPlayers,
      underusedPlayers,
      starterBenchSplit: {
        starterCount,
        benchCount,
        starterSeconds,
        benchSeconds,
        starterAverageSeconds: starterCount ? Math.round(starterSeconds / starterCount) : 0,
        benchAverageSeconds: benchCount ? Math.round(benchSeconds / benchCount) : 0,
        starterShare: totalPlayerSeconds ? starterSeconds / totalPlayerSeconds : 0,
        benchShare: totalPlayerSeconds ? benchSeconds / totalPlayerSeconds : 0
      }
    }
  };
}

export function buildSummaryFromGame(game: GameDetail, now: Date = new Date()): GameSummary {
  const players = sortGamePlayersByTime(game.selectedPlayers);
  const { totalPlayerSeconds, insights } = buildSummaryInsights(players);
  const totalGameSeconds =
    game.clockElapsedSeconds +
    (game.status === 'LIVE' && game.lastClockStartedAt ? diffSeconds(game.lastClockStartedAt, now) : 0);

  return {
    id: game.id,
    label: game.label,
    status: game.status,
    sessionType: game.sessionType,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    team: clone(game.team),
    totalGameSeconds,
    totalPlayerSeconds,
    maxPlayerSeconds: players[0]?.totalSeconds ?? 0,
    insights: game.sessionType === 'TRAINING' ? {
      ...insights,
      starterBenchSplit: {
        starterCount: 0,
        benchCount: 0,
        starterSeconds: 0,
        benchSeconds: 0,
        starterAverageSeconds: 0,
        benchAverageSeconds: 0,
        starterShare: 0,
        benchShare: 0
      }
    } : insights,
    rotationTimeline: clone(game.rotationTimeline),
    players
  };
}

export function rebuildGameCollections(game: GameDetail) {
  game.selectedPlayers = sortGamePlayersByJersey(game.selectedPlayers);
  game.activePlayers = game.selectedPlayers.filter((player) => player.isOnCourt);
  game.benchPlayers = game.selectedPlayers.filter((player) => !player.isOnCourt);
}

export function ensureTrackableLiveGame(game: GameDetail) {
  if (game.status !== 'LIVE' && game.status !== 'PAUSED') {
    throw new Error('Cette action est uniquement possible pendant un match en direct ou en pause.');
  }
}

export function ensureLiveState(game: GameDetail) {
  if (game.status === 'FINISHED') {
    throw new Error('Ce match est déjà terminé.');
  }
}

export function ensureExactlyFiveStarters(game: GameDetail) {
  if (game.sessionType === 'TRAINING') return;
  const starters = game.selectedPlayers.filter((player) => player.isStarter);
  const labels = getTeamLabelSet(game.team.gender);

  if (game.selectedPlayers.length < 5 || starters.length !== 5) {
    throw new Error(`Un match en direct nécessite au moins cinq ${labels.playerPlural} sélectionné·es et exactement cinq titulaires.`);
  }
}

export function finalizeClockAndPlayers(game: GameDetail, now: Date) {
  if (!game.isClockRunning || !game.lastClockStartedAt) {
    return;
  }

  const elapsedSinceResume = diffSeconds(game.lastClockStartedAt, now);
  const periodElapsedSinceResume =
    effectivePeriodStatus(game) === 'LIVE' && game.lastPeriodStartedAt ? diffSeconds(game.lastPeriodStartedAt, now) : 0;

  game.clockElapsedSeconds += elapsedSinceResume;
  game.periodElapsedSeconds += periodElapsedSinceResume;
  game.isClockRunning = false;
  game.lastClockStartedAt = null;
  game.lastPeriodStartedAt = null;

  game.selectedPlayers = game.selectedPlayers.map((player) => {
    if (!player.isOnCourt || !player.lastEnteredAt) {
      return player;
    }

    return {
      ...player,
      totalSeconds: player.totalSeconds + diffSeconds(player.lastEnteredAt, now),
      periodSeconds:
        player.periodSeconds + (player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, now) : 0),
      lastEnteredAt: null,
      lastPeriodEnteredAt: null
    };
  });

  rebuildGameCollections(game);
}

export function defaultGameLabel(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `Match ${formatter.format(now)}`;
}

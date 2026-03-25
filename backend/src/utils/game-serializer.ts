import { GameStatus, Prisma } from '@prisma/client';
import { compareJerseyNumbers } from './jersey-number';

type GameWithRoster = Prisma.GameGetPayload<{
  include: {
    team: true;
    rotationEvents: true;
    players: {
      include: {
        player: true;
        playingTime: true;
      };
    };
  };
}>;

type SerializedPlayer = ReturnType<typeof mapPlayerEntry>;

type RotationPayload = {
  onCourtPlayerIds: number[];
  playerInIds: number[];
  playerOutIds: number[];
};

function sortByJersey<T extends { jerseyNumber: string }>(players: T[]) {
  return [...players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

function sortByTime<T extends { totalSeconds: number; jerseyNumber: string }>(players: T[]) {
  return [...players].sort((left, right) => {
    if (right.totalSeconds !== left.totalSeconds) {
      return right.totalSeconds - left.totalSeconds;
    }

    return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
  });
}

function mapPlayerEntry(entry: GameWithRoster['players'][number]) {
  return {
    gamePlayerId: entry.id,
    playerId: entry.playerId,
    name: entry.player.name,
    jerseyNumber: entry.player.jerseyNumber,
    position: entry.player.position,
    isStarter: entry.isStarter,
    totalSeconds: entry.playingTime?.totalSeconds ?? 0,
    periodSeconds: entry.playingTime?.periodSeconds ?? 0,
    points: entry.playingTime?.points ?? 0,
    assists: entry.playingTime?.assists ?? 0,
    blocks: entry.playingTime?.blocks ?? 0,
    rebounds: entry.playingTime?.rebounds ?? 0,
    isOnCourt: entry.playingTime?.isOnCourt ?? false,
    lastEnteredAt: entry.playingTime?.lastEnteredAt?.toISOString() ?? null,
    lastPeriodEnteredAt: entry.playingTime?.lastPeriodEnteredAt?.toISOString() ?? null
  };
}

function liveGameSeconds(game: Pick<GameWithRoster, 'clockElapsedSeconds' | 'status' | 'lastClockStartedAt'>) {
  return (
    game.clockElapsedSeconds +
    (game.status === GameStatus.LIVE && game.lastClockStartedAt
      ? Math.max(0, Math.floor((Date.now() - game.lastClockStartedAt.getTime()) / 1000))
      : 0)
  );
}

function toNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry));
}

function parseRotationPayload(payload: Prisma.JsonValue | null): RotationPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      onCourtPlayerIds: [],
      playerInIds: [],
      playerOutIds: []
    };
  }

  const payloadRecord = payload as Record<string, unknown>;

  return {
    onCourtPlayerIds: toNumberArray(payloadRecord.onCourtPlayerIds),
    playerInIds: toNumberArray(payloadRecord.playerInIds),
    playerOutIds: toNumberArray(payloadRecord.playerOutIds)
  };
}

function serializeRotationTimeline(game: GameWithRoster, players: SerializedPlayer[]) {
  const playerMap = new Map(players.map((player) => [player.playerId, player]));

  return [...game.rotationEvents]
    .sort((left, right) => {
      if (left.periodNumber !== right.periodNumber) {
        return left.periodNumber - right.periodNumber;
      }

      if (left.clockMarkSeconds !== right.clockMarkSeconds) {
        return left.clockMarkSeconds - right.clockMarkSeconds;
      }

      return left.id - right.id;
    })
    .map((event) => {
      const payload = parseRotationPayload(event.payload);

      const toPlayers = (playerIds: number[]) =>
        sortByJersey(
          playerIds
            .map((playerId) => playerMap.get(playerId))
            .filter((player): player is SerializedPlayer => Boolean(player))
        );

      return {
        id: event.id,
        kind: event.kind,
        periodNumber: event.periodNumber,
        clockMarkSeconds: event.clockMarkSeconds,
        createdAt: event.createdAt.toISOString(),
        playersIn: toPlayers(payload.playerInIds),
        playersOut: toPlayers(payload.playerOutIds),
        onCourt: toPlayers(payload.onCourtPlayerIds)
      };
    });
}

function buildUsageInsights(players: SerializedPlayer[]) {
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

  const sortByDeltaDescending = (left: (typeof usageEntries)[number], right: (typeof usageEntries)[number]) => {
    if (right.deltaSeconds !== left.deltaSeconds) {
      return right.deltaSeconds - left.deltaSeconds;
    }

    return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
  };

  const sortByDeltaAscending = (left: (typeof usageEntries)[number], right: (typeof usageEntries)[number]) => {
    if (left.deltaSeconds !== right.deltaSeconds) {
      return left.deltaSeconds - right.deltaSeconds;
    }

    return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
  };

  const overusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds >= 60 && player.utilizationRatio >= 1.15)
    .sort(sortByDeltaDescending)
    .slice(0, 3);

  const underusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds <= -60 && player.utilizationRatio <= 0.85)
    .sort(sortByDeltaAscending)
    .slice(0, 3);

  const starterSeconds = players
    .filter((player) => player.isStarter)
    .reduce((sum, player) => sum + player.totalSeconds, 0);
  const benchSeconds = totalPlayerSeconds - starterSeconds;
  const starterCount = players.filter((player) => player.isStarter).length;
  const benchCount = players.length - starterCount;

  return {
    totalPlayerSeconds,
    insights: {
      topMinutes: usageEntries
        .slice()
        .sort((left, right) => {
          if (right.totalSeconds !== left.totalSeconds) {
            return right.totalSeconds - left.totalSeconds;
          }

          return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
        })
        .slice(0, 3),
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

export function serializeSelectedPlayers(players: GameWithRoster['players']) {
  return sortByJersey(players.map(mapPlayerEntry));
}

export function serializeGame(game: GameWithRoster) {
  const selectedPlayers = serializeSelectedPlayers(game.players);
  const activePlayers = selectedPlayers.filter((player) => player.isOnCourt);
  const benchPlayers = selectedPlayers.filter((player) => !player.isOnCourt);

  return {
    id: game.id,
    label: game.label,
    status: game.status,
    currentPeriodNumber: game.currentPeriodNumber,
    currentPeriodStatus: game.currentPeriodStatus,
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    isClockRunning: game.isClockRunning,
    clockElapsedSeconds: game.clockElapsedSeconds,
    lastClockStartedAt: game.lastClockStartedAt?.toISOString() ?? null,
    periodElapsedSeconds: game.periodElapsedSeconds,
    lastPeriodStartedAt: game.lastPeriodStartedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    team: {
      id: game.team.id,
      name: game.team.name,
      gender: game.team.gender ?? 'MIXED'
    },
    rotationTimeline: serializeRotationTimeline(game, selectedPlayers),
    selectedPlayers,
    activePlayers,
    benchPlayers
  };
}

export function serializeGameListItem(game: GameWithRoster) {
  const activeCount = game.players.filter((player) => player.playingTime?.isOnCourt).length;

  return {
    id: game.id,
    label: game.label,
    status: game.status,
    createdAt: game.createdAt.toISOString(),
    teamId: game.teamId,
    teamName: game.team.name,
    teamGender: game.team.gender ?? 'MIXED',
    selectedCount: game.players.length,
    activeCount
  };
}

export function serializeSummary(game: GameWithRoster) {
  const players = sortByTime(game.players.map(mapPlayerEntry));
  const maxSeconds = players[0]?.totalSeconds ?? 0;
  const totalGameSeconds = liveGameSeconds(game);
  const { totalPlayerSeconds, insights } = buildUsageInsights(players);

  return {
    id: game.id,
    label: game.label,
    status: game.status,
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    team: {
      id: game.team.id,
      name: game.team.name,
      gender: game.team.gender ?? 'MIXED'
    },
    totalGameSeconds,
    totalPlayerSeconds,
    maxPlayerSeconds: maxSeconds,
    insights,
    rotationTimeline: serializeRotationTimeline(game, players),
    players
  };
}

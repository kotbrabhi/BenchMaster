import { GameStatus, Prisma } from '@prisma/client';
import { compareJerseyNumbers } from './jersey-number';

type GameWithRoster = Prisma.GameGetPayload<{
  include: {
    team: true;
    players: {
      include: {
        player: true;
        playingTime: true;
      };
    };
  };
}>;

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
    totalGameSeconds:
      game.clockElapsedSeconds +
      (game.status === GameStatus.LIVE && game.lastClockStartedAt
        ? Math.max(0, Math.floor((Date.now() - game.lastClockStartedAt.getTime()) / 1000))
        : 0),
    maxPlayerSeconds: maxSeconds,
    players
  };
}

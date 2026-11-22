import { randomBytes } from 'crypto';
import { GameStatus, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import { serializeGame, serializeSelectedPlayers, serializeSummary, serializeSummaryExport } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';
import { getTeamLabelSet } from '../utils/team-labels';

export interface CreateGameInput {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
  sessionType?: 'GAME' | 'TRAINING';
  periodCount?: number;
  periodDurationSeconds?: number;
}

export interface GameShareResult {
  shareId: string;
  path: string;
}

const gameInclude = {
  team: true,
  rotationEvents: true,
  players: {
    include: {
      player: true,
      playingTime: true
    }
  }
} satisfies Prisma.GameInclude;

const gameListSelect = {
  id: true,
  label: true,
  status: true,
    createdAt: true,
    teamId: true,
    team: {
      select: {
        name: true,
        gender: true
      }
    },
  _count: {
    select: {
      players: true
    }
  },
  players: {
    select: {
      playingTime: {
        select: {
          isOnCourt: true
        }
      }
    }
  }
} satisfies Prisma.GameSelect;

const gamePlayersInclude = {
  players: {
    include: {
      player: true,
      playingTime: true
    }
  }
} satisfies Prisma.GameInclude;

function ensureUniqueIds(label: string, ids: number[]) {
  const unique = new Set(ids);

  if (unique.size !== ids.length) {
    throw new HttpError(400, `${label} contient des doublons.`);
  }
}

function defaultGameLabel() {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `Match ${formatter.format(new Date())}`;
}

function buildPublicSharePath(shareId: string) {
  return `/api/public/game-shares/${shareId}`;
}

function createShareToken() {
  return randomBytes(12).toString('hex');
}

function createSnapshotShareId() {
  return `pub_${createShareToken()}`;
}

function asSharePayload(payload: unknown, shareId: string): Prisma.InputJsonObject {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Le JSON de partage est invalide.');
  }

  return {
    ...(payload as Prisma.InputJsonObject),
    shareId,
    exportedAt: new Date().toISOString()
  };
}

export async function listGames(userId: number, teamId?: number) {
  const games = await prisma.game.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
      team: {
        is: {
          userId
        }
      }
    },
    select: gameListSelect,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return games.map((game) => ({
    id: game.id,
    label: game.label,
    status: game.status,
    createdAt: game.createdAt.toISOString(),
    teamId: game.teamId,
    teamName: game.team.name,
    teamGender: game.team.gender ?? 'MIXED',
    selectedCount: game._count.players,
    activeCount: game.players.filter((player) => player.playingTime?.isOnCourt).length
  }));
}

export async function createGame(userId: number, input: CreateGameInput) {
  const sessionType = input.sessionType ?? 'GAME';
  const availablePlayerIds = input.availablePlayerIds.map(Number);
  const starterPlayerIds = input.starterPlayerIds.map(Number);

  if (!Number.isInteger(input.teamId)) {
    throw new HttpError(400, 'Une équipe valide est obligatoire.');
  }

  const periodCount = input.periodCount ?? 4;
  const periodDurationSeconds = input.periodDurationSeconds ?? 600;
  if (![2, 4, 6, 8].includes(periodCount) || ![300, 480, 600, 720].includes(periodDurationSeconds)) {
    throw new HttpError(400, 'Le format des périodes est invalide.');
  }

  const team = await prisma.team.findFirst({
    where: {
      id: input.teamId,
      userId
    },
    include: {
      players: true
    }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  const labels = getTeamLabelSet(team.gender);

  if (availablePlayerIds.length === 0) {
    throw new HttpError(400, `Sélectionnez au moins ${labels.playerIndefiniteSingular} disponible.`);
  }

  ensureUniqueIds(`La liste des ${labels.playerPlural} disponibles`, availablePlayerIds);
  ensureUniqueIds('La liste des titulaires', starterPlayerIds);

  if (sessionType === 'GAME') {
    if (starterPlayerIds.length > 5) {
      throw new HttpError(400, 'Vous pouvez sélectionner au maximum cinq titulaires.');
    }

    const missingStarter = starterPlayerIds.find((playerId) => !availablePlayerIds.includes(playerId));

    if (missingStarter) {
      throw new HttpError(400, `Les titulaires doivent être choisi·es parmi les ${labels.playerPlural} disponibles.`);
    }
  } else if (starterPlayerIds.length) {
    throw new HttpError(400, 'Un entraînement ne comporte pas de titulaires.');
  }

  const rosterIds = new Set(team.players.map((player) => player.id));
  const invalidPlayerId = availablePlayerIds.find((playerId) => !rosterIds.has(playerId));

  if (invalidPlayerId) {
    throw new HttpError(400, `Les ${labels.playerPlural} sélectionné·es doivent appartenir à l'équipe choisie.`);
  }

  const game = await prisma.game.create({
    data: {
      teamId: input.teamId,
      label: input.label?.trim() || defaultGameLabel(),
      status: GameStatus.DRAFT,
      sessionType,
      periodCount,
      periodDurationSeconds,
      players: {
        create: availablePlayerIds.map((playerId) => ({
          playerId,
          isStarter: starterPlayerIds.includes(playerId),
          playingTime: {
            create: {}
          }
        }))
      }
    },
    include: gameInclude
  });

  return serializeGame(game);
}

export async function getOwnedGame(userId: number, gameId: number) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      team: {
        is: {
          userId
        }
      }
    },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeGame(game);
}

export async function getGame(gameId: number, userId: number) {
  return getOwnedGame(userId, gameId);
}

export async function getGamePlayers(gameId: number, userId: number) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      team: {
        is: {
          userId
        }
      }
    },
    include: gamePlayersInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeSelectedPlayers(game.players);
}

export async function getGameSummary(gameId: number, userId: number) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      team: {
        is: {
          userId
        }
      }
    },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeSummary(game);
}

export async function createGameShare(gameId: number, userId: number): Promise<GameShareResult> {
  const existingGame = await prisma.game.findFirst({
    where: {
      id: gameId,
      team: {
        is: {
          userId
        }
      }
    },
    select: {
      id: true,
      shareToken: true
    }
  });

  if (!existingGame) {
    throw new HttpError(404, 'Match introuvable.');
  }

  if (existingGame.shareToken) {
    return {
      shareId: existingGame.shareToken,
      path: buildPublicSharePath(existingGame.shareToken)
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createShareToken();

    try {
      await prisma.game.update({
        where: {
          id: existingGame.id
        },
        data: {
          shareToken: shareId
        }
      });

      return {
        shareId,
        path: buildPublicSharePath(shareId)
      };
    } catch {
      // Retry with a new token if an unlikely collision occurs.
    }
  }

  throw new HttpError(500, 'Impossible de generer un identifiant de partage.');
}

export async function createPublicShareSnapshot(payload: unknown): Promise<GameShareResult> {
  validatePublicSharePayload(payload);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createSnapshotShareId();

    try {
      await prisma.sharedGameSnapshot.create({
        data: {
          shareId,
          payload: asSharePayload(payload, shareId)
        }
      });

      return {
        shareId,
        path: buildPublicSharePath(shareId)
      };
    } catch {
      // Retry with a new token if an unlikely collision occurs.
    }
  }

  throw new HttpError(500, 'Impossible de generer un identifiant de partage.');
}

function validatePublicSharePayload(payload: unknown): asserts payload is Record<string, unknown> {
  const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const allowed = ['schemaVersion', 'exportedAt', 'shareId', 'game', 'team', 'totals', 'players', 'insights', 'rotationTimeline'];
  if (!isRecord(payload) || Object.keys(payload).some((key) => !allowed.includes(key))
    || payload.schemaVersion !== 1 || typeof payload.exportedAt !== 'string' || !Number.isFinite(Date.parse(payload.exportedAt))
    || (payload.shareId !== null && typeof payload.shareId !== 'string')
    || !isRecord(payload.game) || !isRecord(payload.team) || !isRecord(payload.totals) || !isRecord(payload.insights)
    || !Array.isArray(payload.players) || payload.players.length > 100
    || !Array.isArray(payload.rotationTimeline) || payload.rotationTimeline.length > 500) {
    throw new HttpError(400, 'Le résumé de partage est invalide ou trop volumineux.');
  }
  const checkText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
  if (!checkText(payload.game.label, 120) || !checkText(payload.team.name, 120)
    || payload.players.some((player) => !isRecord(player) || !checkText(player.name, 80) || !checkText(player.jerseyNumber, 12))
    || payload.rotationTimeline.some((event) => !isRecord(event) || !checkText(event.kind, 40))) {
    throw new HttpError(400, 'Le résumé de partage contient des champs invalides.');
  }
}

export async function getPublicSharedSummary(shareId: string) {
  if (!/^(?:[a-f0-9]{24}|pub_[a-f0-9]{24})$/.test(shareId)) {
    throw new HttpError(400, 'Identifiant de partage invalide.');
  }

  const snapshot = await prisma.sharedGameSnapshot.findUnique({
    where: {
      shareId
    }
  });

  if (snapshot) {
    return snapshot.payload;
  }

  const game = await prisma.game.findFirst({
    where: {
      shareToken: shareId
    },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Partage introuvable.');
  }

  return serializeSummaryExport(game, shareId);
}

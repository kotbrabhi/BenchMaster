import { randomBytes } from 'crypto';
import { GameStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeGame, serializeSelectedPlayers, serializeSummary, serializeSummaryExport } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';
import { getTeamLabelSet } from '../utils/team-labels';

export interface CreateGameInput {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
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
  const availablePlayerIds = input.availablePlayerIds.map(Number);
  const starterPlayerIds = input.starterPlayerIds.map(Number);

  if (!Number.isInteger(input.teamId)) {
    throw new HttpError(400, 'Une équipe valide est obligatoire.');
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

  if (starterPlayerIds.length > 5) {
    throw new HttpError(400, 'Vous pouvez sélectionner au maximum cinq titulaires.');
  }

  const missingStarter = starterPlayerIds.find((playerId) => !availablePlayerIds.includes(playerId));

  if (missingStarter) {
    throw new HttpError(400, `Les titulaires doivent être choisi·es parmi les ${labels.playerPlural} disponibles.`);
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

export async function getPublicSharedSummary(shareId: string) {
  if (!shareId?.trim()) {
    throw new HttpError(400, 'Identifiant de partage invalide.');
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

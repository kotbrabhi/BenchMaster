import { GameStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeGame, serializeSelectedPlayers, serializeSummary } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';
import { getTeamLabelSet } from '../utils/team-labels';

export interface CreateGameInput {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
}

const gameInclude = {
  team: true,
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

import { GameStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeGame, serializeGameListItem, serializeSummary } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';

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

export async function listGames(teamId?: number) {
  const games = await prisma.game.findMany({
    where: teamId ? { teamId } : undefined,
    include: gameInclude,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return games.map(serializeGameListItem);
}

export async function createGame(input: CreateGameInput) {
  const availablePlayerIds = input.availablePlayerIds.map(Number);
  const starterPlayerIds = input.starterPlayerIds.map(Number);

  if (!Number.isInteger(input.teamId)) {
    throw new HttpError(400, 'Une équipe valide est obligatoire.');
  }

  if (availablePlayerIds.length === 0) {
    throw new HttpError(400, 'Sélectionnez au moins un·e joueur·euse disponible.');
  }

  ensureUniqueIds('La liste des joueur·euses disponibles', availablePlayerIds);
  ensureUniqueIds('La liste des titulaires', starterPlayerIds);

  if (starterPlayerIds.length > 5) {
    throw new HttpError(400, 'Vous pouvez sélectionner au maximum cinq titulaires.');
  }

  const missingStarter = starterPlayerIds.find((playerId) => !availablePlayerIds.includes(playerId));

  if (missingStarter) {
    throw new HttpError(400, 'Les titulaires doivent être choisi·es parmi les joueur·euses disponibles.');
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    include: {
      players: true
    }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  const rosterIds = new Set(team.players.map((player) => player.id));
  const invalidPlayerId = availablePlayerIds.find((playerId) => !rosterIds.has(playerId));

  if (invalidPlayerId) {
    throw new HttpError(400, "Les joueur·euses sélectionné·es doivent appartenir à l'équipe choisie.");
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

export async function getGame(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeGame(game);
}

export async function getGamePlayers(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeGame(game).selectedPlayers;
}

export async function getGameSummary(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return serializeSummary(game);
}

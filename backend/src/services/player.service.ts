import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { compareJerseyNumbers, normalizeJerseyNumber } from '../utils/jersey-number';

export interface PlayerInput {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

function sanitizePlayerInput(input: PlayerInput) {
  const jerseyNumber = normalizeJerseyNumber(input.jerseyNumber);

  return {
    name: input.name.trim(),
    jerseyNumber,
    position: input.position?.trim() || null
  };
}

function ensureValidPlayerInput(input: ReturnType<typeof sanitizePlayerInput>): {
  name: string;
  jerseyNumber: string;
  position: string | null;
} {
  if (!input.name) {
    throw new HttpError(400, 'Le nom du/de la joueur·euse est obligatoire.');
  }

  if (!input.jerseyNumber) {
    throw new HttpError(400, 'Le numéro doit contenir uniquement des chiffres.');
  }

  return {
    ...input,
    jerseyNumber: input.jerseyNumber
  };
}

export async function listPlayers(teamId: number) {
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  const players = await prisma.player.findMany({
    where: { teamId },
  });

  return players.sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

export async function createPlayer(teamId: number, input: PlayerInput) {
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  const payload = ensureValidPlayerInput(sanitizePlayerInput(input));

  const duplicate = await prisma.player.findFirst({
    where: {
      teamId,
      jerseyNumber: payload.jerseyNumber
    }
  });

  if (duplicate) {
    throw new HttpError(409, 'Un·e joueur·euse utilise déjà ce numéro dans cette équipe.');
  }

  return prisma.player.create({
    data: {
      teamId,
      ...payload
    }
  });
}

export async function updatePlayer(playerId: number, input: PlayerInput) {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    throw new HttpError(404, 'Joueur·euse introuvable.');
  }

  const payload = ensureValidPlayerInput(sanitizePlayerInput(input));

  const duplicate = await prisma.player.findFirst({
    where: {
      teamId: player.teamId,
      jerseyNumber: payload.jerseyNumber,
      id: {
        not: playerId
      }
    }
  });

  if (duplicate) {
    throw new HttpError(409, 'Un·e joueur·euse utilise déjà ce numéro dans cette équipe.');
  }

  return prisma.player.update({
    where: { id: playerId },
    data: payload
  });
}

export async function deletePlayer(playerId: number) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      gamePlayers: {
        take: 1
      }
    }
  });

  if (!player) {
    throw new HttpError(404, 'Joueur·euse introuvable.');
  }

  if (player.gamePlayers.length > 0) {
    throw new HttpError(409, 'Ce·tte joueur·euse est déjà lié·e à un match et ne peut pas être supprimé·e.');
  }

  await prisma.player.delete({
    where: { id: playerId }
  });
}

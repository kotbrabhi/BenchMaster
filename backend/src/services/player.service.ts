import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { compareJerseyNumbers, normalizeJerseyNumber } from '../utils/jersey-number';
import { rethrowPrismaError } from '../utils/prisma-error';

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
  const payload = ensureValidPlayerInput(sanitizePlayerInput(input));

  try {
    return await prisma.player.create({
      data: {
        teamId,
        ...payload
      }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2002: new HttpError(409, 'Un·e joueur·euse utilise déjà ce numéro dans cette équipe.'),
      P2003: new HttpError(404, 'Équipe introuvable.')
    });
  }
}

export async function updatePlayer(playerId: number, input: PlayerInput) {
  const payload = ensureValidPlayerInput(sanitizePlayerInput(input));

  try {
    return await prisma.player.update({
      where: { id: playerId },
      data: payload
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2002: new HttpError(409, 'Un·e joueur·euse utilise déjà ce numéro dans cette équipe.'),
      P2025: new HttpError(404, 'Joueur·euse introuvable.')
    });
  }
}

export async function deletePlayer(playerId: number) {
  try {
    await prisma.player.delete({
      where: { id: playerId }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2003: new HttpError(409, 'Ce·tte joueur·euse est déjà lié·e à un match et ne peut pas être supprimé·e.'),
      P2025: new HttpError(404, 'Joueur·euse introuvable.')
    });
  }
}

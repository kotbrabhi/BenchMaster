import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { compareJerseyNumbers, normalizeJerseyNumber } from '../utils/jersey-number';
import { rethrowPrismaError } from '../utils/prisma-error';
import { getTeamLabelSet } from '../utils/team-labels';

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

function ensureValidPlayerInput(input: ReturnType<typeof sanitizePlayerInput>, teamGender?: Parameters<typeof getTeamLabelSet>[0]): {
  name: string;
  jerseyNumber: string;
  position: string | null;
} {
  const labels = getTeamLabelSet(teamGender);

  if (!input.name) {
    throw new HttpError(400, `Le nom ${labels.playerOfDefiniteSingular} est obligatoire.`);
  }

  if (!input.jerseyNumber) {
    throw new HttpError(400, 'Le numéro doit contenir uniquement des chiffres.');
  }

  return {
    ...input,
    jerseyNumber: input.jerseyNumber
  };
}

async function getOwnedTeam(teamId: number, userId: number) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      userId
    }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  return team;
}

async function getOwnedPlayer(playerId: number, userId: number) {
  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      team: {
        is: {
          userId
        }
      }
    },
    include: {
      team: {
        select: {
          gender: true
        }
      }
    }
  });

  if (!player) {
    throw new HttpError(404, 'Joueur·euse introuvable.');
  }

  return player;
}

export async function listPlayers(teamId: number, userId: number) {
  await getOwnedTeam(teamId, userId);

  const players = await prisma.player.findMany({
    where: { teamId },
  });

  return players.sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

export async function createPlayer(teamId: number, userId: number, input: PlayerInput) {
  const team = await getOwnedTeam(teamId, userId);
  const labels = getTeamLabelSet(team.gender);
  const payload = ensureValidPlayerInput(sanitizePlayerInput(input), team.gender);

  try {
    return await prisma.player.create({
      data: {
        teamId,
        ...payload
      }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2002: new HttpError(409, `${labels.playerIndefiniteSingular.charAt(0).toUpperCase()}${labels.playerIndefiniteSingular.slice(1)} utilise déjà ce numéro dans cette équipe.`),
      P2003: new HttpError(404, 'Équipe introuvable.')
    });
  }
}

export async function updatePlayer(playerId: number, userId: number, input: PlayerInput) {
  const player = await getOwnedPlayer(playerId, userId);
  const labels = getTeamLabelSet(player.team.gender);
  const payload = ensureValidPlayerInput(sanitizePlayerInput(input), player.team.gender);

  try {
    return await prisma.player.update({
      where: { id: playerId },
      data: payload
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2002: new HttpError(409, `${labels.playerIndefiniteSingular.charAt(0).toUpperCase()}${labels.playerIndefiniteSingular.slice(1)} utilise déjà ce numéro dans cette équipe.`),
      P2025: new HttpError(404, 'Joueur·euse introuvable.')
    });
  }
}

export async function deletePlayer(playerId: number, userId: number) {
  const player = await getOwnedPlayer(playerId, userId);
  const labels = getTeamLabelSet(player.team.gender);

  try {
    await prisma.player.delete({
      where: { id: playerId }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2003: new HttpError(409, `${labels.playerDemonstrativeSingular.charAt(0).toUpperCase()}${labels.playerDemonstrativeSingular.slice(1)} est déjà lié·e à un match et ne peut pas être supprimé·e.`),
      P2025: new HttpError(404, 'Joueur·euse introuvable.')
    });
  }
}

import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { normalizeJerseyNumber } from '../utils/jersey-number';
import { rethrowPrismaError } from '../utils/prisma-error';

interface TeamPlayerInput {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

export interface TeamInput {
  name: string;
  players?: TeamPlayerInput[];
}

function normalizeTeamName(name: string) {
  return name.trim();
}

function sanitizePlayers(players: TeamPlayerInput[] | undefined) {
  return (players ?? []).map((player) => ({
    name: player.name.trim(),
    jerseyNumber: normalizeJerseyNumber(player.jerseyNumber),
    position: player.position?.trim() || null
  }));
}

function ensureValidPlayers(players: ReturnType<typeof sanitizePlayers>) {
  const usedJerseyNumbers = new Set<string>();

  return players.map((player, index) => {
    if (!player.name) {
      throw new HttpError(400, `Le nom du/de la joueur·euse n°${index + 1} est obligatoire.`);
    }

    if (!player.jerseyNumber) {
      throw new HttpError(400, `Le numéro du/de la joueur·euse ${player.name} doit contenir uniquement des chiffres.`);
    }

    if (usedJerseyNumbers.has(player.jerseyNumber)) {
      throw new HttpError(400, `Le numéro ${player.jerseyNumber} est utilisé plusieurs fois dans la liste.`);
    }

    usedJerseyNumbers.add(player.jerseyNumber);

    return {
      name: player.name,
      jerseyNumber: player.jerseyNumber,
      position: player.position
    };
  });
}

export async function listTeams() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          players: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    playerCount: team._count.players
  }));
}

export async function createTeam(input: TeamInput) {
  const name = normalizeTeamName(input.name);
  const players = ensureValidPlayers(sanitizePlayers(input.players));

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  return prisma.team.create({
    data: {
      name,
      ...(players.length
        ? {
            players: {
              create: players
            }
          }
        : {})
    }
  });
}

export async function updateTeam(teamId: number, input: TeamInput) {
  const name = normalizeTeamName(input.name);

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  try {
    return await prisma.team.update({
      where: { id: teamId },
      data: { name }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2025: new HttpError(404, 'Équipe introuvable.')
    });
  }
}

export async function deleteTeam(teamId: number) {
  try {
    await prisma.team.delete({
      where: { id: teamId }
    });
  } catch (error) {
    rethrowPrismaError(error, {
      P2025: new HttpError(404, 'Équipe introuvable.')
    });
  }
}

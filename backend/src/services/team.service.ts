import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { rethrowPrismaError } from '../utils/prisma-error';

export interface TeamInput {
  name: string;
}

function normalizeTeamName(name: string) {
  return name.trim();
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

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  return prisma.team.create({
    data: { name }
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

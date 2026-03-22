import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { compareJerseyNumbers } from '../utils/jersey-number';

export interface TeamInput {
  name: string;
}

function normalizeTeamName(name: string) {
  return name.trim();
}

export async function listTeams() {
  const teams = await prisma.team.findMany({
    include: {
      players: true
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return teams.map((team) => ({
    ...team,
    players: [...team.players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
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
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  const name = normalizeTeamName(input.name);

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { name }
  });
}

export async function deleteTeam(teamId: number) {
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  await prisma.team.delete({
    where: { id: teamId }
  });
}

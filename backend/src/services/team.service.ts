import { TeamGender } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { normalizeJerseyNumber } from '../utils/jersey-number';
import { getTeamLabelSet } from '../utils/team-labels';

interface TeamPlayerInput {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

export interface TeamInput {
  name: string;
  gender?: TeamGender;
  players?: TeamPlayerInput[];
}

function serializeTeamListItem(team: {
  id: number;
  name: string;
  gender: TeamGender | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { players: number };
}) {
  return {
    id: team.id,
    name: team.name,
    gender: team.gender ?? 'MIXED',
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    playerCount: team._count.players
  };
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

function ensureValidPlayers(players: ReturnType<typeof sanitizePlayers>, teamGender: TeamGender = 'MIXED') {
  const usedJerseyNumbers = new Set<string>();
  const labels = getTeamLabelSet(teamGender);

  return players.map((player, index) => {
    if (!player.name) {
      throw new HttpError(400, `Le nom ${labels.playerOfDefiniteSingular} n°${index + 1} est obligatoire.`);
    }

    if (!player.jerseyNumber) {
      throw new HttpError(400, `Le numéro ${labels.playerOfDefiniteSingular} ${player.name} doit contenir uniquement des chiffres.`);
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

export async function listTeams(userId: number) {
  const teams = await prisma.team.findMany({
    where: {
      userId
    },
    select: {
      id: true,
      name: true,
      gender: true,
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

  return teams.map(serializeTeamListItem);
}

export async function createTeam(userId: number, input: TeamInput) {
  const name = normalizeTeamName(input.name);
  const gender = input.gender ?? 'MIXED';
  const players = ensureValidPlayers(sanitizePlayers(input.players), gender);

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  return prisma.team.create({
    data: {
      userId,
      name,
      gender,
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

export async function updateTeam(userId: number, teamId: number, input: TeamInput) {
  const name = normalizeTeamName(input.name);
  const gender = input.gender ?? 'MIXED';

  if (!name) {
    throw new HttpError(400, "Le nom de l'équipe est obligatoire.");
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      userId
    }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { name, gender }
  });
}

export async function deleteTeam(userId: number, teamId: number) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      userId
    }
  });

  if (!team) {
    throw new HttpError(404, 'Équipe introuvable.');
  }

  await prisma.team.delete({
    where: { id: teamId }
  });
}

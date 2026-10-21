import { FriendlyApplicationStatus, FriendlyMatchLifecycle, FriendlyNotificationType, FriendlyProposalStatus, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { createFriendlyNotifications } from './friendly-notification.service';
import { notifyUsersOfProposal } from './push-notification.service';

const proposalSelect = {
  id: true,
  organizerTeamId: true,
  createdByUserId: true,
  status: true,
  category: true,
  startsAt: true,
  durationMinutes: true,
  area: true,
  venueName: true,
  format: true,
  requestedPlayerCount: true,
  level: true,
  notes: true,
  responseDeadline: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  organizerTeam: { select: { id: true, name: true, gender: true } }
} satisfies Prisma.FriendlyMatchProposalSelect;

const publicProposalSelect = {
  id: true,
  organizerTeamId: true,
  status: true,
  category: true,
  startsAt: true,
  durationMinutes: true,
  area: true,
  format: true,
  requestedPlayerCount: true,
  level: true,
  responseDeadline: true,
  createdAt: true,
  updatedAt: true,
  organizerTeam: { select: { id: true, name: true, gender: true } }
} satisfies Prisma.FriendlyMatchProposalSelect;

type ProposalInput = {
  organizerTeamId: number;
  category: string;
  startsAt: string;
  durationMinutes?: number | null;
  area: string;
  venueName?: string | null;
  format: string;
  requestedPlayerCount?: number | null;
  level?: string | null;
  notes?: string | null;
  responseDeadline?: string | null;
};

type ProposalPatch = Partial<ProposalInput>;

function cleanText(value: unknown, field: string, maxLength: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} est obligatoire.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} est invalide.`);
  const normalized = value.trim();
  if (required && !normalized) throw new HttpError(400, `${field} est obligatoire.`);
  if (normalized.length > maxLength) throw new HttpError(400, `${field} est trop long (maximum ${maxLength} caractères).`);
  return normalized || null;
}

function cleanDate(value: unknown, field: string, required: boolean): Date | undefined | null {
  if ((value === undefined || value === null || value === '') && !required) return value === undefined ? undefined : null;
  if (typeof value !== 'string') throw new HttpError(400, `${field} est invalide.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} est invalide.`);
  return date;
}

function normalizeInput(input: ProposalPatch, isCreate = false): Prisma.FriendlyMatchProposalUncheckedCreateInput | Prisma.FriendlyMatchProposalUncheckedUpdateInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Les informations de la proposition sont invalides.');
  const data: Record<string, unknown> = {};
  if (input.organizerTeamId !== undefined || isCreate) {
    const teamId = Number(input.organizerTeamId);
    if (!Number.isInteger(teamId) || teamId <= 0) throw new HttpError(400, "Une équipe valide est obligatoire.");
    data.organizerTeamId = teamId;
  }

  const strings: Array<[keyof ProposalInput, string, number, boolean]> = [
    ['category', 'La catégorie', 80, true],
    ['area', 'La zone', 160, true],
    ['format', 'Le format', 80, true],
    ['venueName', 'Le lieu', 160, false],
    ['level', 'Le niveau', 80, false],
    ['notes', 'La note', 2000, false]
  ];
  for (const [key, label, max, required] of strings) {
    if (input[key] !== undefined || (isCreate && required)) data[key] = cleanText(input[key], label, max, required);
  }

  if (input.startsAt !== undefined || isCreate) {
    const startsAt = cleanDate(input.startsAt, 'La date du match', true) as Date;
    if (startsAt.getTime() <= Date.now()) throw new HttpError(400, 'La date du match doit être dans le futur.');
    data.startsAt = startsAt;
  }
  if (input.responseDeadline !== undefined || isCreate) {
    const deadline = cleanDate(input.responseDeadline, 'La date limite', false);
    if (deadline && deadline.getTime() <= Date.now()) throw new HttpError(400, 'La date limite doit être dans le futur.');
    if (deadline && input.startsAt) {
      const startsAt = new Date(input.startsAt);
      if (deadline.getTime() >= startsAt.getTime()) throw new HttpError(400, 'La date limite doit précéder le match.');
    }
    data.responseDeadline = deadline;
  }

  if (input.durationMinutes !== undefined || isCreate) {
    const value = input.durationMinutes;
    if (value === null || value === undefined) data.durationMinutes = null;
    else if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 240) throw new HttpError(400, 'La durée doit être comprise entre 1 et 240 minutes.');
    else data.durationMinutes = Number(value);
  }
  if (input.requestedPlayerCount !== undefined || isCreate) {
    const value = input.requestedPlayerCount;
    if (value === null || value === undefined) data.requestedPlayerCount = null;
    else if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 30) throw new HttpError(400, 'Le nombre de joueurs doit être compris entre 1 et 30.');
    else data.requestedPlayerCount = Number(value);
  }
  return data as Prisma.FriendlyMatchProposalUncheckedCreateInput;
}

function assertDeadlineBeforeStart(data: Record<string, unknown>, current?: { startsAt: Date; responseDeadline: Date | null }) {
  const startsAt = (data.startsAt as Date | undefined) ?? current?.startsAt;
  const deadline = Object.prototype.hasOwnProperty.call(data, 'responseDeadline')
    ? (data.responseDeadline as Date | null)
    : current?.responseDeadline;
  if (deadline && startsAt && deadline.getTime() >= startsAt.getTime()) {
    throw new HttpError(400, 'La date limite doit précéder le match.');
  }
}

export async function listProposals(userId: number, query: { from?: string; to?: string; category?: string }) {
  const now = new Date();
  await expireDueProposals();
  const from = query.from ? cleanDate(query.from, 'La date de début', true) as Date : now;
  const to = query.to ? cleanDate(query.to, 'La date de fin', true) as Date : undefined;
  if (to && to < from) throw new HttpError(400, 'La période de recherche est invalide.');

  return prisma.friendlyMatchProposal.findMany({
    where: {
      status: { in: [FriendlyProposalStatus.OPEN, FriendlyProposalStatus.IN_DISCUSSION] },
      startsAt: { gt: now, gte: from, ...(to ? { lte: to } : {}) },
      OR: [{ responseDeadline: null }, { responseDeadline: { gt: now } }],
      ...(query.category ? { category: { equals: query.category.trim(), mode: 'insensitive' } } : {}),
      NOT: { createdByUserId: userId }
    },
    select: publicProposalSelect,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 100
  });
}

export async function listMyProposals(userId: number) {
  await expireDueProposals();
  return prisma.friendlyMatchProposal.findMany({
    where: { createdByUserId: userId },
    select: proposalSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 100
  });
}

export async function createProposal(userId: number, input: ProposalInput) {
  const data = normalizeInput(input, true) as Prisma.FriendlyMatchProposalUncheckedCreateInput;
  assertDeadlineBeforeStart(data as Record<string, unknown>);
  const team = await prisma.team.findFirst({ where: { id: data.organizerTeamId, userId }, select: { id: true } });
  if (!team) throw new HttpError(404, 'Équipe introuvable.');
  const proposal = await prisma.friendlyMatchProposal.create({
    data: { ...data, createdByUserId: userId, status: FriendlyProposalStatus.OPEN },
    select: proposalSelect
  });
  void notifyUsersOfProposal(userId, {
    id: proposal.id,
    category: proposal.category,
    startsAt: proposal.startsAt,
    area: proposal.area,
    teamName: proposal.organizerTeam.name
  });
  return proposal;
}

export async function getProposal(userId: number, proposalId: number) {
  if (!Number.isInteger(proposalId) || proposalId <= 0) throw new HttpError(400, 'La proposition demandée est invalide.');
  await expireProposalIfDue(proposalId);
  const proposal = await prisma.friendlyMatchProposal.findUnique({ where: { id: proposalId }, select: proposalSelect });
  if (!proposal) throw new HttpError(404, 'Proposition introuvable.');
  if (proposal.createdByUserId === userId) return proposal;
  if (proposal.status === FriendlyProposalStatus.CONFIRMED || proposal.status === FriendlyProposalStatus.CANCELLED) {
    const participant = await prisma.friendlyConfirmedMatch.findFirst({
      where: { proposalId, OR: [{ proposal: { createdByUserId: userId } }, { application: { coachUserId: userId } }] },
      select: { id: true }
    });
    if (!participant) throw new HttpError(404, 'Proposition introuvable.');
    const { createdByUserId: _createdByUserId, ...confirmedProposal } = proposal;
    return confirmedProposal;
  }
  if (proposal.status !== FriendlyProposalStatus.OPEN && proposal.status !== FriendlyProposalStatus.IN_DISCUSSION) throw new HttpError(404, 'Proposition introuvable.');
  const { venueName: _venueName, notes: _notes, createdByUserId: _createdByUserId, ...publicProposal } = proposal;
  return publicProposal;
}

async function lockProposal(tx: Prisma.TransactionClient, proposalId: number) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "FriendlyMatchProposal" WHERE "id" = ${proposalId} FOR UPDATE`);
}

export async function expireProposalIfDue(proposalId: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockProposal(tx, proposalId);
    const proposal = await tx.friendlyMatchProposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true, startsAt: true, responseDeadline: true }
    });
    if (!proposal || (proposal.status !== FriendlyProposalStatus.OPEN && proposal.status !== FriendlyProposalStatus.IN_DISCUSSION)) return false;
    if (proposal.startsAt > now && (!proposal.responseDeadline || proposal.responseDeadline > now)) return false;
    const expired = await tx.friendlyMatchProposal.updateMany({
      where: { id: proposalId, status: proposal.status },
      data: { status: FriendlyProposalStatus.EXPIRED }
    });
    if (expired.count !== 1) return false;
    const activeStatuses = [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION];
    const applications = await tx.friendlyMatchApplication.findMany({ where: { proposalId, status: { in: activeStatuses } }, select: { id: true, coachUserId: true } });
    await tx.friendlyMatchApplication.updateMany({ where: { proposalId, status: { in: activeStatuses } }, data: { status: FriendlyApplicationStatus.EXPIRED } });
    await tx.friendlyInvite.updateMany({ where: { OR: [{ application: { proposalId } }, { response: { application: { proposalId } } }], revokedAt: null }, data: { revokedAt: now } });
    await createFriendlyNotifications(tx, applications.map((application) => ({
      userId: application.coachUserId,
      type: FriendlyNotificationType.APPLICATION_REJECTED,
      proposalId,
      applicationId: application.id
    })));
    return true;
  });
}

async function expireDueProposals() {
  const now = new Date();
  const due = await prisma.friendlyMatchProposal.findMany({
    where: {
      status: { in: [FriendlyProposalStatus.OPEN, FriendlyProposalStatus.IN_DISCUSSION] },
      OR: [{ startsAt: { lte: now } }, { responseDeadline: { lte: now } }]
    },
    select: { id: true },
    take: 100
  });
  for (const proposal of due) await expireProposalIfDue(proposal.id);
}

export async function updateProposal(userId: number, proposalId: number, input: ProposalPatch) {
  if (!Number.isInteger(proposalId) || proposalId <= 0) throw new HttpError(400, 'La proposition demandée est invalide.');
  await expireProposalIfDue(proposalId);
  const current = await prisma.friendlyMatchProposal.findFirst({ where: { id: proposalId, createdByUserId: userId } });
  if (!current) throw new HttpError(404, 'Proposition introuvable.');
  if (current.status !== FriendlyProposalStatus.OPEN && current.status !== FriendlyProposalStatus.IN_DISCUSSION) throw new HttpError(409, 'Cette proposition ne peut plus être modifiée.');

  const data = normalizeInput(input) as Prisma.FriendlyMatchProposalUncheckedUpdateInput;
  assertDeadlineBeforeStart(data as Record<string, unknown>, current);
  if (data.organizerTeamId !== undefined) {
    const team = await prisma.team.findFirst({ where: { id: Number(data.organizerTeamId), userId }, select: { id: true } });
    if (!team) throw new HttpError(404, 'Équipe introuvable.');
  }
  const materialChange = (data.startsAt !== undefined && new Date(data.startsAt as Date).getTime() !== current.startsAt.getTime())
    || (data.responseDeadline !== undefined && (data.responseDeadline as Date | null)?.getTime() !== current.responseDeadline?.getTime())
    || (data.category !== undefined && data.category !== current.category)
    || (data.format !== undefined && data.format !== current.format);
  return prisma.$transaction(async (tx) => {
    const result = await tx.friendlyMatchProposal.updateMany({
      where: { id: proposalId, createdByUserId: userId, status: { in: [FriendlyProposalStatus.OPEN, FriendlyProposalStatus.IN_DISCUSSION] } },
      data
    });
    if (result.count !== 1) throw new HttpError(409, 'Cette proposition ne peut plus être modifiée.');
    if (materialChange) {
      const now = new Date();
      await tx.friendlyInvite.updateMany({ where: { OR: [{ application: { proposalId } }, { response: { application: { proposalId } } }], revokedAt: null }, data: { revokedAt: now } });
      const priorResponses = await tx.friendlyPlayerResponse.findMany({ where: { application: { proposalId }, availability: { not: null } }, select: { id: true, availability: true, respondedAt: true } });
      await tx.friendlyPlayerAvailabilityHistory.createMany({ data: priorResponses.flatMap((response) => response.availability ? [{ responseId: response.id, availability: response.availability, respondedAt: response.respondedAt }] : []) });
      await tx.friendlyPlayerResponse.updateMany({
        where: { application: { proposalId } },
        data: { availability: null, respondedAt: null, revision: { increment: 1 } }
      });
      await tx.friendlyMatchApplication.updateMany({ where: { proposalId, status: FriendlyApplicationStatus.COLLECTING }, data: { status: FriendlyApplicationStatus.INTERESTED } });
      await tx.friendlyMatchApplication.updateMany({ where: { proposalId, status: { in: [FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION] } }, data: { status: FriendlyApplicationStatus.NEEDS_RECONFIRMATION } });
    }
    return tx.friendlyMatchProposal.findUniqueOrThrow({ where: { id: proposalId }, select: proposalSelect });
  });
}

export async function cancelProposal(userId: number, proposalId: number, rawReason?: unknown) {
  if (!Number.isInteger(proposalId) || proposalId <= 0) throw new HttpError(400, 'La proposition demandée est invalide.');
  await expireProposalIfDue(proposalId);
  let reason: string | null = null;
  if (rawReason !== undefined && rawReason !== null && rawReason !== '') {
    if (typeof rawReason !== 'string' || rawReason.trim().length > 500) throw new HttpError(400, 'Le motif d’annulation est invalide.');
    reason = rawReason.trim() || null;
  }
  const current = await prisma.friendlyMatchProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true, createdByUserId: true, status: true,
      applications: { where: { status: FriendlyApplicationStatus.ACCEPTED }, select: { coachUserId: true, id: true } }
    }
  });
  if (!current || (current.createdByUserId !== userId && !current.applications.some((application) => application.coachUserId === userId))) throw new HttpError(404, 'Proposition introuvable.');
  const isConfirmed = current.status === FriendlyProposalStatus.CONFIRMED;
  if (!isConfirmed && current.status !== FriendlyProposalStatus.OPEN && current.status !== FriendlyProposalStatus.IN_DISCUSSION) throw new HttpError(409, 'Cette proposition ne peut plus être annulée.');
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const candidateApps = await tx.friendlyMatchApplication.findMany({
      where: { proposalId, status: { in: [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION, FriendlyApplicationStatus.ACCEPTED] } },
      select: { id: true, coachUserId: true, status: true }
    });
    const changed = await tx.friendlyMatchProposal.updateMany({
      where: {
        id: proposalId,
        status: current.status,
        OR: [{ createdByUserId: userId }, { applications: { some: { coachUserId: userId, status: FriendlyApplicationStatus.ACCEPTED } } }]
      },
      data: { status: FriendlyProposalStatus.CANCELLED, cancelledAt: now }
    });
    if (changed.count !== 1) throw new HttpError(409, 'La proposition a changé. Actualisez-la avant de l’annuler.');
    await tx.friendlyInvite.updateMany({ where: { OR: [{ application: { proposalId } }, { response: { application: { proposalId } } }], revokedAt: null }, data: { revokedAt: now } });
    await tx.friendlyMatchApplication.updateMany({ where: { proposalId, status: { in: [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION] } }, data: { status: FriendlyApplicationStatus.EXPIRED } });
    if (isConfirmed) {
      await tx.friendlyConfirmedMatch.updateMany({ where: { proposalId, status: FriendlyMatchLifecycle.CONFIRMED }, data: { status: FriendlyMatchLifecycle.CANCELLED, cancelledAt: now, cancelledByUserId: userId, cancellationReason: reason } });
    }
    await createFriendlyNotifications(tx, [
      ...candidateApps.filter((application) => application.coachUserId !== userId).map((application) => ({
      userId: application.coachUserId,
      type: FriendlyNotificationType.MATCH_CANCELLED,
      proposalId,
      applicationId: application.id
      })),
      ...(isConfirmed && current.applications.some((application) => application.coachUserId === userId)
        ? [{ userId: current.createdByUserId, type: FriendlyNotificationType.MATCH_CANCELLED, proposalId, applicationId: current.applications.find((application) => application.coachUserId === userId)!.id }]
        : [])
    ]);
    return 1;
  });
  if (result !== 1) throw new HttpError(409, 'Cette proposition ne peut plus être annulée.');
  return getProposal(userId, proposalId);
}

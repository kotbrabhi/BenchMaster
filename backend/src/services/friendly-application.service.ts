import { createHash, randomBytes } from 'node:crypto';
import { FriendlyApplicationStatus, FriendlyAvailability, FriendlyNotificationType, FriendlyProposalStatus, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { createFriendlyNotifications } from './friendly-notification.service';
import { availabilityChangeNeedsResubmission, canReopenWithdrawnFriendlyApplication, canWithdrawFriendlyApplication, isFriendlyInviteRevisionCurrent, isFriendlyInviteTokenWellFormed, isFriendlyResponseWindowOpen, normalizeFriendlyPlayerName } from './friendly-match.rules';
import { expireProposalIfDue } from './friendly-match.service';

const applicationSelect = {
  id: true,
  proposalId: true,
  teamId: true,
  coachUserId: true,
  status: true,
  submittedAt: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
  team: { select: { id: true, name: true, gender: true } },
  proposal: {
    select: {
      id: true,
      status: true,
      category: true,
      startsAt: true,
      durationMinutes: true,
      area: true,
      format: true,
      requestedPlayerCount: true,
      responseDeadline: true,
      organizerTeam: { select: { name: true } }
    }
  },
  playerResponses: {
    select: {
      id: true,
      playerId: true,
      playerNameSnapshot: true,
      jerseyNumberSnapshot: true,
      availability: true,
      respondedAt: true,
      revision: true,
      invite: { select: { expiresAt: true, revokedAt: true } },
      availabilityHistory: { select: { availability: true, respondedAt: true, changedAt: true }, orderBy: { changedAt: 'desc' as const } }
    },
    orderBy: [{ jerseyNumberSnapshot: 'asc' as const }, { id: 'asc' as const }]
  },
  teamInvite: { select: { expiresAt: true, revokedAt: true } },
  proposedPlayers: {
    select: { id: true, playerId: true, playerNameSnapshot: true, jerseyNumberSnapshot: true },
    orderBy: [{ jerseyNumberSnapshot: 'asc' as const }, { id: 'asc' as const }]
  }
} satisfies Prisma.FriendlyMatchApplicationSelect;

function isActiveProposal(status: FriendlyProposalStatus) {
  return status === FriendlyProposalStatus.OPEN || status === FriendlyProposalStatus.IN_DISCUSSION;
}

function ensureOpenForResponses(proposal: { status: FriendlyProposalStatus; startsAt: Date; responseDeadline: Date | null }) {
  if (!isActiveProposal(proposal.status)) throw new HttpError(409, 'Cette proposition n’accepte plus de réponses.');
  if (!isFriendlyResponseWindowOpen(proposal)) {
    throw new HttpError(410, 'La période de réponse est terminée.');
  }
}

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function lockProposal(tx: Prisma.TransactionClient, proposalId: number) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "FriendlyMatchProposal" WHERE "id" = ${proposalId} FOR UPDATE`);
}

export async function createInterest(userId: number, proposalId: number, teamId: number) {
  if (!Number.isInteger(proposalId) || proposalId <= 0 || !Number.isInteger(teamId) || teamId <= 0) {
    throw new HttpError(400, 'La proposition ou l’équipe est invalide.');
  }
  await expireProposalIfDue(proposalId);
  const [proposal, team] = await Promise.all([
    prisma.friendlyMatchProposal.findUnique({ where: { id: proposalId } }),
    prisma.team.findFirst({ where: { id: teamId, userId }, select: { id: true } })
  ]);
  if (!proposal) throw new HttpError(404, 'Proposition introuvable.');
  if (!team) throw new HttpError(404, 'Équipe introuvable.');
  ensureOpenForResponses(proposal);
  if (proposal.createdByUserId === userId || proposal.organizerTeamId === teamId) {
    throw new HttpError(400, 'Vous ne pouvez pas candidater à votre propre proposition.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const claim = await tx.friendlyMatchProposal.updateMany({
        where: {
          id: proposalId,
          status: { in: [FriendlyProposalStatus.OPEN, FriendlyProposalStatus.IN_DISCUSSION] },
          startsAt: { gt: now },
          OR: [{ responseDeadline: null }, { responseDeadline: { gt: now } }]
        },
        data: { status: FriendlyProposalStatus.IN_DISCUSSION }
      });
      if (claim.count !== 1) throw new HttpError(409, 'Cette proposition n’accepte plus de réponses.');
      const existing = await tx.friendlyMatchApplication.findUnique({ where: { proposalId_teamId: { proposalId, teamId } }, select: { id: true, status: true } });
      let application: Prisma.FriendlyMatchApplicationGetPayload<{ select: typeof applicationSelect }>;
      if (existing) {
        if (!canReopenWithdrawnFriendlyApplication(existing.status)) throw new HttpError(409, 'Cette équipe a déjà manifesté son intérêt.');
        await tx.friendlyInvite.updateMany({ where: { response: { applicationId: existing.id }, revokedAt: null }, data: { revokedAt: now } });
        await tx.friendlyPlayerResponse.deleteMany({ where: { applicationId: existing.id } });
        await tx.friendlyApplicationPlayer.deleteMany({ where: { applicationId: existing.id } });
        await tx.friendlyNotification.deleteMany({ where: { applicationId: existing.id } });
        const reopened = await tx.friendlyMatchApplication.updateMany({
          where: { id: existing.id, status: FriendlyApplicationStatus.WITHDRAWN },
          data: { coachUserId: userId, status: FriendlyApplicationStatus.INTERESTED, submittedAt: null, acceptedAt: null }
        });
        if (reopened.count !== 1) throw new HttpError(409, 'Cette candidature a changé. Actualisez la page.');
        application = await tx.friendlyMatchApplication.findUniqueOrThrow({ where: { id: existing.id }, select: applicationSelect });
      } else {
        application = await tx.friendlyMatchApplication.create({
          data: { proposalId, teamId, coachUserId: userId, status: FriendlyApplicationStatus.INTERESTED },
          select: applicationSelect
        });
      }
      await createFriendlyNotifications(tx, [{
        userId: proposal.createdByUserId,
        type: FriendlyNotificationType.INTEREST_RECEIVED,
        proposalId,
        applicationId: application.id
      }]);
      return application;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Cette équipe a déjà manifesté son intérêt.');
    }
    throw error;
  }
}

export async function listMyApplications(userId: number) {
  const applications = await prisma.friendlyMatchApplication.findMany({ where: { coachUserId: userId }, select: { proposalId: true } });
  for (const proposalId of new Set(applications.map((application) => application.proposalId))) await expireProposalIfDue(proposalId);
  return prisma.friendlyMatchApplication.findMany({
    where: { coachUserId: userId },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
}

export async function getMyApplication(userId: number, applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw new HttpError(400, 'La candidature demandée est invalide.');
  const initial = await prisma.friendlyMatchApplication.findFirst({ where: { id: applicationId, coachUserId: userId }, select: { proposalId: true } });
  if (!initial) throw new HttpError(404, 'Candidature introuvable.');
  await expireProposalIfDue(initial.proposalId);
  const application = await prisma.friendlyMatchApplication.findFirst({
    where: { id: applicationId, coachUserId: userId },
    select: applicationSelect
  });
  if (!application) throw new HttpError(404, 'Candidature introuvable.');
  return application;
}

export async function createOrRotateInvites(userId: number, applicationId: number) {
  const application = await prisma.friendlyMatchApplication.findFirst({
    where: { id: applicationId, coachUserId: userId },
    select: {
      id: true,
      teamId: true,
      status: true,
      proposal: { select: { id: true, status: true, startsAt: true, responseDeadline: true } },
      team: { select: { players: { select: { id: true, name: true, jerseyNumber: true } } } },
      teamInvite: { select: { expiresAt: true, revokedAt: true } }
    }
  });
  if (!application) throw new HttpError(404, 'Candidature introuvable.');
  if (!new Set<FriendlyApplicationStatus>([FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.NEEDS_RECONFIRMATION]).has(application.status)) {
    throw new HttpError(409, 'Cette candidature ne peut plus recueillir de disponibilités.');
  }
  ensureOpenForResponses(application.proposal);
  const result = await prisma.$transaction(async (tx) => {
    await lockProposal(tx, application.proposal.id);
    const current = await tx.friendlyMatchApplication.findFirst({
      where: { id: applicationId, coachUserId: userId },
      select: {
        id: true,
        status: true,
        proposal: { select: { status: true, startsAt: true, responseDeadline: true } },
        team: { select: { players: { select: { id: true, name: true, jerseyNumber: true } } } },
        teamInvite: { select: { id: true, expiresAt: true, revokedAt: true } }
      }
    });
    if (!current || current.status !== application.status) throw new HttpError(409, 'La candidature a changé. Actualisez-la avant de renouveler les liens.');
    if (!new Set<FriendlyApplicationStatus>([FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.NEEDS_RECONFIRMATION]).has(current.status)) {
      throw new HttpError(409, 'Cette candidature ne peut plus recueillir de disponibilités.');
    }
    ensureOpenForResponses(current.proposal);
    const expiresAt = current.proposal.responseDeadline ?? current.proposal.startsAt;
    const token = randomBytes(32).toString('base64url');
    const claimed = await tx.friendlyMatchApplication.updateMany({
      where: { id: applicationId, coachUserId: userId, status: current.status },
      data: { status: current.status === FriendlyApplicationStatus.INTERESTED ? FriendlyApplicationStatus.COLLECTING : current.status }
    });
    if (claimed.count !== 1) throw new HttpError(409, 'La candidature a changé. Actualisez-la avant de renouveler les liens.');
    await tx.friendlyInvite.updateMany({
      where: { applicationId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await tx.friendlyInvite.upsert({
      where: { applicationId },
      create: { applicationId, tokenHash: tokenDigest(token), expiresAt },
      update: { tokenHash: tokenDigest(token), expiresAt, revokedAt: null, lastUsedAt: null, createdAt: new Date() }
    });
    // Keep the roster visible to the coach as explicit unanswered rows.
    await tx.friendlyPlayerResponse.createMany({
      data: current.team.players.map((player) => ({
        applicationId,
        playerId: player.id,
        playerNameSnapshot: player.name,
        jerseyNumberSnapshot: player.jerseyNumber,
        normalizedName: normalizeFriendlyPlayerName(player.name)
      })),
      skipDuplicates: true
    });
    return { token, expiresAt };
  });

  return {
    path: `/friendlies/respond/${result.token}`,
    expiresAt: result.expiresAt.toISOString()
  };
}

export async function revokeTeamInvite(userId: number, applicationId: number) {
  const invite = await prisma.friendlyInvite.findFirst({ where: { applicationId, application: { coachUserId: userId } }, select: { id: true, revokedAt: true } });
  if (!invite) throw new HttpError(404, 'Lien introuvable.');
  if (!invite.revokedAt) await prisma.friendlyInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
  return { revoked: true };
}

export async function revokeInvite(userId: number, applicationId: number, responseId: number) {
  const invite = await prisma.friendlyInvite.findFirst({
    where: { responseId, response: { applicationId, application: { coachUserId: userId } } },
    select: { id: true, revokedAt: true }
  });
  if (!invite) throw new HttpError(404, 'Lien introuvable.');
  if (!invite.revokedAt) await prisma.friendlyInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
  return { revoked: true };
}

async function resolveInvite(token: string, client: Pick<typeof prisma, 'friendlyInvite'> | Pick<Prisma.TransactionClient, 'friendlyInvite'> = prisma) {
  if (!isFriendlyInviteTokenWellFormed(token)) throw new HttpError(404, 'Lien indisponible ou expiré.');
  const invite = await client.friendlyInvite.findUnique({
    where: { tokenHash: tokenDigest(token) },
    select: {
      id: true,
      responseId: true,
      applicationId: true,
      expiresAt: true,
      revokedAt: true,
      application: {
        select: {
          id: true,
          proposalId: true,
          teamId: true,
          status: true,
          proposal: { select: { status: true, category: true, startsAt: true, durationMinutes: true, area: true, format: true, responseDeadline: true, organizerTeam: { select: { name: true } } } }
        }
      },
      response: {
        select: {
          id: true,
          playerId: true,
          playerNameSnapshot: true,
          jerseyNumberSnapshot: true,
          availability: true,
          respondedAt: true,
          revision: true,
          player: { select: { teamId: true } },
          application: {
            select: {
              id: true,
              proposalId: true,
              teamId: true,
              status: true,
              proposal: { select: { status: true, category: true, startsAt: true, durationMinutes: true, area: true, format: true, responseDeadline: true, organizerTeam: { select: { name: true } } } }
            }
          }
        }
      }
    }
  });
  if (!invite || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) throw new HttpError(404, 'Lien indisponible ou expiré.');
  const app = invite.application ?? invite.response?.application;
  if (!app) throw new HttpError(404, 'Lien indisponible ou expiré.');
  if (invite.response && invite.response.playerId && invite.response.player?.teamId !== app.teamId) throw new HttpError(404, 'Lien indisponible ou expiré.');
  if (!new Set<FriendlyApplicationStatus>([FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION]).has(app.status)) throw new HttpError(404, 'Lien indisponible ou expiré.');
  ensureOpenForResponses(app.proposal);
  return invite;
}

export async function getPublicInvite(token: string) {
  await expireDueProposalForInvite(token);
  const invite = await resolveInvite(token);
  const response = invite.response;
  const proposal = (invite.application ?? response?.application)!.proposal;
  return {
    proposal: {
      organizer: proposal.organizerTeam.name,
      category: proposal.category,
      startsAt: proposal.startsAt.toISOString(),
      durationMinutes: proposal.durationMinutes,
      area: proposal.area,
      format: proposal.format,
      responseDeadline: proposal.responseDeadline?.toISOString() ?? null
    },
    expiresAt: invite.expiresAt.toISOString()
  };
}

async function expireDueProposalForInvite(token: string) {
  if (!isFriendlyInviteTokenWellFormed(token)) return;
  const invite = await prisma.friendlyInvite.findUnique({
    where: { tokenHash: tokenDigest(token) },
    select: { application: { select: { proposalId: true } }, response: { select: { application: { select: { proposalId: true } } } } }
  });
  const proposalId = invite?.application?.proposalId ?? invite?.response?.application.proposalId;
  if (proposalId) await expireProposalIfDue(proposalId);
}

export async function setPublicAvailability(token: string, input: { availability?: string; playerName?: string; revision?: number }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'La réponse est invalide.');
  if (input.availability !== FriendlyAvailability.AVAILABLE && input.availability !== FriendlyAvailability.UNAVAILABLE) {
    throw new HttpError(400, 'Choisissez disponible ou indisponible.');
  }
  const availability = input.availability as FriendlyAvailability;
  if (typeof input.playerName !== 'string' || !input.playerName.trim() || input.playerName.trim().length > 80) throw new HttpError(400, 'Saisissez un nom valide (80 caractères maximum).');
  const playerName = input.playerName.trim();
  const normalizedName = normalizeFriendlyPlayerName(playerName);
  if (input.revision !== undefined && (!Number.isInteger(input.revision) || input.revision < 0)) throw new HttpError(400, 'La version de la réponse est invalide. Rechargez la page.');
  await expireDueProposalForInvite(token);
  return prisma.$transaction(async (tx) => {
    const initialInvite = await resolveInvite(token, tx);
    await lockProposal(tx, (initialInvite.application ?? initialInvite.response?.application)!.proposalId);
    const invite = await resolveInvite(token, tx);
    const app = invite.application ?? invite.response?.application;
    if (!app) throw new HttpError(404, 'Lien indisponible ou expiré.');
    let current = await tx.friendlyPlayerResponse.findUnique({ where: { applicationId_normalizedName: { applicationId: app.id, normalizedName } } });
    if (!current) {
      const rosterResponses = await tx.friendlyPlayerResponse.findMany({
        where: { applicationId: app.id, playerId: { not: null } }
      });
      const enteredTokens = normalizedName.split(' ').filter(Boolean);
      const matches = rosterResponses.filter((item) => {
        const rosterTokens = item.normalizedName.split(' ').filter(Boolean);
        return enteredTokens.length > 0 && enteredTokens.every((token) => rosterTokens.includes(token));
      });
      if (matches.length === 1) {
        current = matches[0];
      } else if (matches.length > 1) {
        throw new HttpError(409, 'Plusieurs joueuses correspondent à ce nom. Saisissez le nom complet pour éviter une confusion.');
      }
    }
    if (current && input.revision !== undefined && !isFriendlyInviteRevisionCurrent(current.revision, input.revision)) throw new HttpError(409, 'La réponse a changé depuis son chargement. Rechargez la page.');
    const activeInvite = await tx.friendlyInvite.updateMany({
      where: { id: invite.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { lastUsedAt: new Date() }
    });
    if (activeInvite.count !== 1) throw new HttpError(404, 'Lien indisponible ou expiré.');
    const isInSubmittedSelection = current && app.status === FriendlyApplicationStatus.SUBMITTED
      ? await tx.friendlyApplicationPlayer.findFirst({ where: { applicationId: app.id, playerNameSnapshot: current.playerNameSnapshot }, select: { id: true } })
      : null;
    if (current && availabilityChangeNeedsResubmission(app.status, !!isInSubmittedSelection, current.availability, availability)) {
      const applicationChanged = await tx.friendlyMatchApplication.updateMany({
        where: { id: app.id, status: FriendlyApplicationStatus.SUBMITTED },
        data: { status: FriendlyApplicationStatus.NEEDS_RECONFIRMATION }
      });
      if (applicationChanged.count === 0) {
        const latestApplication = await tx.friendlyMatchApplication.findUnique({ where: { id: app.id }, select: { status: true } });
        if (latestApplication?.status === FriendlyApplicationStatus.ACCEPTED || latestApplication?.status === FriendlyApplicationStatus.REJECTED || latestApplication?.status === FriendlyApplicationStatus.EXPIRED) {
          throw new HttpError(409, 'La collecte de disponibilités est terminée. Contactez votre coach en cas de changement.');
        }
      }
    }
    if (current && current.availability && current.availability !== input.availability) {
      await tx.friendlyPlayerAvailabilityHistory.create({ data: { responseId: current.id, availability: current.availability, respondedAt: current.respondedAt } });
    }
    const updated = current
      ? await tx.friendlyPlayerResponse.update({ where: { id: current.id }, data: { availability, respondedAt: new Date(), revision: { increment: 1 } }, select: { availability: true, respondedAt: true, revision: true } })
      : await tx.friendlyPlayerResponse.create({ data: { applicationId: app.id, playerNameSnapshot: playerName, normalizedName, jerseyNumberSnapshot: '', availability, respondedAt: new Date(), revision: 1 }, select: { availability: true, respondedAt: true, revision: true } });
    return { availability: updated.availability, respondedAt: updated.respondedAt?.toISOString() ?? null, revision: updated.revision };
  });
}

export async function submitApplication(userId: number, applicationId: number, input: { responseIds?: number[] }) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw new HttpError(400, 'La candidature demandée est invalide.');
  if (!input || !Array.isArray(input.responseIds) || input.responseIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(input.responseIds).size !== input.responseIds.length) {
    throw new HttpError(400, 'Sélectionnez une composition valide.');
  }
  const selectedIds = input.responseIds;
    if (!selectedIds.length) throw new HttpError(400, 'Sélectionnez au moins un joueur disponible.');
  const initial = await prisma.friendlyMatchApplication.findFirst({ where: { id: applicationId, coachUserId: userId }, select: { proposalId: true } });
  if (!initial) throw new HttpError(404, 'Candidature introuvable.');
  await expireProposalIfDue(initial.proposalId);
  return prisma.$transaction(async (tx) => {
    await lockProposal(tx, initial.proposalId);
    const application = await tx.friendlyMatchApplication.findFirst({
      where: { id: applicationId, coachUserId: userId },
      select: { id: true, teamId: true, status: true, proposalId: true, proposal: { select: { status: true, startsAt: true, responseDeadline: true, requestedPlayerCount: true, createdByUserId: true } } }
    });
    if (!application) throw new HttpError(404, 'Candidature introuvable.');
    if (!new Set<FriendlyApplicationStatus>([FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.NEEDS_RECONFIRMATION]).has(application.status)) {
      throw new HttpError(409, 'Cette candidature ne peut pas être soumise dans son état actuel.');
    }
    ensureOpenForResponses(application.proposal);
    const minimum = application.proposal.requestedPlayerCount ?? 1;
    if (selectedIds.length < minimum) throw new HttpError(400, `Au moins ${minimum} joueurs disponibles sont nécessaires.`);
    const now = new Date();
    const updated = await tx.friendlyMatchApplication.updateMany({
      where: { id: applicationId, coachUserId: userId, status: application.status },
      data: { status: FriendlyApplicationStatus.SUBMITTED, submittedAt: now }
    });
    if (updated.count !== 1) throw new HttpError(409, 'La candidature a changé. Actualisez-la avant de soumettre.');
    const selected = await tx.friendlyPlayerResponse.findMany({
      where: { applicationId, id: { in: selectedIds }, availability: FriendlyAvailability.AVAILABLE },
      select: { id: true, playerId: true, playerNameSnapshot: true, jerseyNumberSnapshot: true }
    });
    if (selected.length !== selectedIds.length) {
      throw new HttpError(409, 'La disponibilité a changé. Actualisez le tableau avant de soumettre.');
    }
    await tx.friendlyApplicationPlayer.deleteMany({ where: { applicationId } });
    await tx.friendlyApplicationPlayer.createMany({
      data: selected.map((response) => ({ applicationId, playerId: response.playerId, playerNameSnapshot: response.playerNameSnapshot, jerseyNumberSnapshot: response.jerseyNumberSnapshot }))
    });
    await createFriendlyNotifications(tx, [{
      userId: application.proposal.createdByUserId,
      type: FriendlyNotificationType.TEAM_SUBMITTED,
      proposalId: application.proposalId,
      applicationId
    }]);
    return tx.friendlyMatchApplication.findFirstOrThrow({ where: { id: applicationId, coachUserId: userId }, select: applicationSelect });
  });
}

export async function withdrawApplication(userId: number, applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw new HttpError(400, 'La candidature demandée est invalide.');
  const initial = await prisma.friendlyMatchApplication.findFirst({ where: { id: applicationId, coachUserId: userId }, select: { proposalId: true } });
  if (!initial) throw new HttpError(404, 'Candidature introuvable.');
  await expireProposalIfDue(initial.proposalId);
  return prisma.$transaction(async (tx) => {
    const initial = await tx.friendlyMatchApplication.findFirst({ where: { id: applicationId, coachUserId: userId }, select: { proposalId: true } });
    if (!initial) throw new HttpError(404, 'Candidature introuvable.');
    await lockProposal(tx, initial.proposalId);
    const application = await tx.friendlyMatchApplication.findFirst({
      where: { id: applicationId, coachUserId: userId },
      select: { id: true, proposalId: true, status: true }
    });
    if (!application) throw new HttpError(404, 'Candidature introuvable.');
    if (!canWithdrawFriendlyApplication(application.status)) throw new HttpError(409, 'Cette candidature ne peut plus être retirée.');
    const withdrawable = [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION];
    const changed = await tx.friendlyMatchApplication.updateMany({
      where: { id: applicationId, coachUserId: userId, status: application.status },
      data: { status: FriendlyApplicationStatus.WITHDRAWN }
    });
    if (changed.count !== 1) throw new HttpError(409, 'La candidature a changé. Actualisez-la avant de la retirer.');
    await tx.friendlyInvite.updateMany({ where: { OR: [{ applicationId }, { response: { applicationId } }], revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.friendlyMatchProposal.updateMany({
      where: {
        id: application.proposalId,
        status: FriendlyProposalStatus.IN_DISCUSSION,
        applications: { none: { status: { in: withdrawable } } }
      },
      data: { status: FriendlyProposalStatus.OPEN }
    });
    return { id: applicationId, status: FriendlyApplicationStatus.WITHDRAWN };
  });
}

export async function listProposalApplications(userId: number, proposalId: number) {
  if (!Number.isInteger(proposalId) || proposalId <= 0) throw new HttpError(400, 'La proposition demandée est invalide.');
  const proposal = await prisma.friendlyMatchProposal.findFirst({ where: { id: proposalId, createdByUserId: userId }, select: { id: true } });
  if (!proposal) throw new HttpError(404, 'Proposition introuvable.');
  await expireProposalIfDue(proposalId);
  return prisma.friendlyMatchApplication.findMany({
    where: { proposalId, status: { in: [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION, FriendlyApplicationStatus.ACCEPTED, FriendlyApplicationStatus.REJECTED, FriendlyApplicationStatus.WITHDRAWN, FriendlyApplicationStatus.EXPIRED] } },
    select: {
      id: true,
      proposalId: true,
      teamId: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      team: { select: { id: true, name: true, gender: true } },
      proposedPlayers: { select: { id: true, playerNameSnapshot: true, jerseyNumberSnapshot: true }, orderBy: [{ jerseyNumberSnapshot: 'asc' }, { id: 'asc' }] }
    },
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'asc' }]
  });
}

export async function acceptApplication(userId: number, applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw new HttpError(400, 'La candidature demandée est invalide.');
  const initial = await prisma.friendlyMatchApplication.findFirst({ where: { id: applicationId, proposal: { createdByUserId: userId } }, select: { proposalId: true } });
  if (!initial) throw new HttpError(404, 'Candidature introuvable.');
  await expireProposalIfDue(initial.proposalId);
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.friendlyMatchApplication.findFirst({
      where: { id: applicationId },
      select: {
        id: true, proposalId: true, teamId: true, coachUserId: true, status: true,
        proposal: { select: { id: true, createdByUserId: true, organizerTeamId: true, status: true, startsAt: true, durationMinutes: true, area: true, format: true, responseDeadline: true, requestedPlayerCount: true } },
        proposedPlayers: { select: { playerId: true } }
      }
    });
    if (!candidate || candidate.proposal.createdByUserId !== userId) throw new HttpError(404, 'Candidature introuvable.');
    if (candidate.status !== FriendlyApplicationStatus.SUBMITTED) throw new HttpError(409, 'Seule une équipe officiellement proposée peut être acceptée.');
    ensureOpenForResponses(candidate.proposal);
    const minimum = candidate.proposal.requestedPlayerCount ?? 1;
    if (candidate.proposedPlayers.length < minimum) throw new HttpError(409, 'Cette équipe ne satisfait plus le minimum demandé.');

    const now = new Date();
    const proposalClaim = await tx.friendlyMatchProposal.updateMany({
      where: {
        id: candidate.proposalId,
        createdByUserId: userId,
        status: { in: [FriendlyProposalStatus.OPEN, FriendlyProposalStatus.IN_DISCUSSION] },
        startsAt: { gt: now },
        OR: [{ responseDeadline: null }, { responseDeadline: { gt: now } }]
      },
      data: { status: FriendlyProposalStatus.CONFIRMED }
    });
    if (proposalClaim.count !== 1) throw new HttpError(409, 'Cette proposition a déjà été confirmée, annulée ou fermée.');

    const accepted = await tx.friendlyMatchApplication.updateMany({
      where: { id: candidate.id, status: FriendlyApplicationStatus.SUBMITTED },
      data: { status: FriendlyApplicationStatus.ACCEPTED, acceptedAt: now }
    });
    if (accepted.count !== 1) throw new HttpError(409, 'La candidature a changé. Actualisez la liste des équipes.');

    const confirmation = await tx.friendlyConfirmedMatch.create({
      data: {
        proposalId: candidate.proposalId,
        applicationId: candidate.id,
        organizerTeamId: candidate.proposal.organizerTeamId,
        candidateTeamId: candidate.teamId,
        startsAt: candidate.proposal.startsAt,
        durationMinutes: candidate.proposal.durationMinutes,
        area: candidate.proposal.area,
        format: candidate.proposal.format,
        confirmedAt: now
      },
      select: { id: true, proposalId: true, applicationId: true, status: true, confirmedAt: true }
    });

    const otherCandidates = await tx.friendlyMatchApplication.findMany({
      where: { proposalId: candidate.proposalId, id: { not: candidate.id }, status: { in: [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION] } },
      select: { id: true, coachUserId: true }
    });
    await tx.friendlyMatchApplication.updateMany({
      where: { proposalId: candidate.proposalId, id: { not: candidate.id }, status: { in: [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION] } },
      data: { status: FriendlyApplicationStatus.REJECTED }
    });
    await tx.friendlyInvite.updateMany({ where: { OR: [{ application: { proposalId: candidate.proposalId } }, { response: { application: { proposalId: candidate.proposalId } } }], revokedAt: null }, data: { revokedAt: now } });
    await createFriendlyNotifications(tx, [
      { userId, type: FriendlyNotificationType.MATCH_CONFIRMED, proposalId: candidate.proposalId, applicationId: candidate.id },
      { userId: candidate.coachUserId, type: FriendlyNotificationType.MATCH_CONFIRMED, proposalId: candidate.proposalId, applicationId: candidate.id },
      ...otherCandidates.map((other) => ({ userId: other.coachUserId, type: FriendlyNotificationType.APPLICATION_REJECTED, proposalId: candidate.proposalId, applicationId: other.id }))
    ]);
    return confirmation;
  });
}

export async function rejectApplication(userId: number, applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw new HttpError(400, 'La candidature demandée est invalide.');
  const dueCheck = await prisma.friendlyMatchApplication.findFirst({ where: { id: applicationId, proposal: { createdByUserId: userId } }, select: { proposalId: true } });
  if (!dueCheck) throw new HttpError(404, 'Candidature introuvable.');
  await expireProposalIfDue(dueCheck.proposalId);
  return prisma.$transaction(async (tx) => {
    const initial = await tx.friendlyMatchApplication.findUnique({ where: { id: applicationId }, select: { proposalId: true } });
    if (!initial) throw new HttpError(404, 'Candidature introuvable.');
    await lockProposal(tx, initial.proposalId);
    const candidate = await tx.friendlyMatchApplication.findFirst({
      where: { id: applicationId },
      select: { id: true, proposalId: true, coachUserId: true, status: true, proposal: { select: { createdByUserId: true, status: true, startsAt: true, responseDeadline: true } } }
    });
    if (!candidate || candidate.proposal.createdByUserId !== userId) throw new HttpError(404, 'Candidature introuvable.');
    if (candidate.proposal.status !== FriendlyProposalStatus.OPEN && candidate.proposal.status !== FriendlyProposalStatus.IN_DISCUSSION) throw new HttpError(409, 'Cette proposition n’accepte plus de décision.');
    ensureOpenForResponses({ status: candidate.proposal.status, startsAt: candidate.proposal.startsAt, responseDeadline: candidate.proposal.responseDeadline });
    if (candidate.status !== FriendlyApplicationStatus.SUBMITTED && candidate.status !== FriendlyApplicationStatus.NEEDS_RECONFIRMATION) throw new HttpError(409, 'Cette équipe ne peut pas être refusée dans son état actuel.');
    const changed = await tx.friendlyMatchApplication.updateMany({ where: { id: candidate.id, status: candidate.status }, data: { status: FriendlyApplicationStatus.REJECTED } });
    if (changed.count !== 1) throw new HttpError(409, 'La candidature a changé. Actualisez la liste des équipes.');
    await tx.friendlyInvite.updateMany({ where: { OR: [{ applicationId }, { response: { applicationId } }], revokedAt: null }, data: { revokedAt: new Date() } });
    await createFriendlyNotifications(tx, [{ userId: candidate.coachUserId, type: FriendlyNotificationType.APPLICATION_REJECTED, proposalId: candidate.proposalId, applicationId }]);
    return { id: applicationId, status: FriendlyApplicationStatus.REJECTED };
  });
}

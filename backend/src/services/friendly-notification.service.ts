import { FriendlyNotificationType, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';

export type FriendlyNotificationInput = {
  userId: number;
  type: FriendlyNotificationType;
  proposalId?: number | null;
  applicationId?: number | null;
};

export async function createFriendlyNotifications(
  client: Pick<Prisma.TransactionClient, 'friendlyNotification'>,
  items: FriendlyNotificationInput[]
) {
  const deduped = [...new Map(items.filter((item) => Number.isInteger(item.userId) && item.userId > 0).map((item) => [
    `${item.userId}:${item.type}:${item.proposalId ?? ''}:${item.applicationId ?? ''}`,
    item
  ])).values()];
  if (!deduped.length) return;
  await client.friendlyNotification.createMany({ data: deduped });
}

export async function listMyFriendlyNotifications(userId: number) {
  const items = await prisma.friendlyNotification.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      proposalId: true,
      applicationId: true,
      createdAt: true,
      readAt: true,
      proposal: { select: { category: true, startsAt: true, createdByUserId: true, organizerTeam: { select: { name: true } } } },
      application: { select: { coachUserId: true, team: { select: { name: true } } } }
    },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: 100
  });
  return items.map(({ proposal, application, ...item }) => ({
    ...item,
    perspective: application?.coachUserId === userId ? 'CANDIDATE' as const : 'ORGANIZER' as const,
    proposal: proposal ? { category: proposal.category, startsAt: proposal.startsAt, organizerTeam: proposal.organizerTeam } : null,
    application: application ? { team: application.team } : null
  }));
}

export async function listMyFriendlyMatches(userId: number) {
  return prisma.friendlyConfirmedMatch.findMany({
    where: { OR: [{ proposal: { createdByUserId: userId } }, { application: { coachUserId: userId } }] },
    select: {
      id: true,
      proposalId: true,
      applicationId: true,
      startsAt: true,
      durationMinutes: true,
      area: true,
      format: true,
      status: true,
      confirmedAt: true,
      cancelledAt: true,
      cancellationReason: true,
      organizerTeam: { select: { id: true, name: true } },
      candidateTeam: { select: { id: true, name: true } },
      proposal: { select: { category: true } },
      application: { select: { proposedPlayers: { select: { playerNameSnapshot: true, jerseyNumberSnapshot: true }, orderBy: [{ jerseyNumberSnapshot: 'asc' }, { id: 'asc' }] } } }
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 100
  });
}

export async function markFriendlyNotificationRead(userId: number, notificationId: number) {
  if (!Number.isInteger(notificationId) || notificationId <= 0) throw new HttpError(400, 'La notification demandée est invalide.');
  const updated = await prisma.friendlyNotification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() }
  });
  if (!updated.count) {
    const exists = await prisma.friendlyNotification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
    if (!exists) throw new HttpError(404, 'Notification introuvable.');
  }
  return { read: true };
}

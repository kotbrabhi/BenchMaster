import { FriendlyApplicationStatus, FriendlyProposalStatus } from '../generated/prisma/client.js';

type ResponseWindow = {
  status: FriendlyProposalStatus;
  startsAt: Date;
  responseDeadline: Date | null;
};

export function isFriendlyResponseWindowOpen(proposal: ResponseWindow, now = Date.now()) {
  return (proposal.status === FriendlyProposalStatus.OPEN || proposal.status === FriendlyProposalStatus.IN_DISCUSSION)
    && proposal.startsAt.getTime() > now
    && (!proposal.responseDeadline || proposal.responseDeadline.getTime() > now);
}

export function isFriendlyInviteTokenWellFormed(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function isFriendlyInviteRevisionCurrent(storedRevision: number, submittedRevision: unknown) {
  return Number.isInteger(submittedRevision) && submittedRevision === storedRevision;
}

export function availabilityChangeNeedsResubmission(
  status: FriendlyApplicationStatus,
  isInProposedLineup: boolean,
  currentAvailability: string | null,
  nextAvailability: string
) {
  return status === FriendlyApplicationStatus.SUBMITTED
    && isInProposedLineup
    && currentAvailability !== 'UNAVAILABLE'
    && nextAvailability === 'UNAVAILABLE';
}

export function normalizeFriendlyPlayerName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

export function canWithdrawFriendlyApplication(status: FriendlyApplicationStatus) {
  return status === FriendlyApplicationStatus.INTERESTED
    || status === FriendlyApplicationStatus.COLLECTING
    || status === FriendlyApplicationStatus.SUBMITTED
    || status === FriendlyApplicationStatus.NEEDS_RECONFIRMATION;
}

export function canReopenWithdrawnFriendlyApplication(status: FriendlyApplicationStatus) {
  return status === FriendlyApplicationStatus.WITHDRAWN;
}

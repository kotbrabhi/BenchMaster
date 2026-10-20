import assert from 'node:assert/strict';
import test from 'node:test';
import { FriendlyApplicationStatus, FriendlyProposalStatus } from '../generated/prisma/client.js';
import { availabilityChangeNeedsResubmission, canReopenWithdrawnFriendlyApplication, canWithdrawFriendlyApplication, isFriendlyInviteRevisionCurrent, isFriendlyInviteTokenWellFormed, isFriendlyResponseWindowOpen, normalizeFriendlyPlayerName } from './friendly-match.rules';

test('a response window closes at the start time or response deadline', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const base = {
    status: FriendlyProposalStatus.OPEN,
    startsAt: new Date(now + 60_000),
    responseDeadline: new Date(now + 30_000)
  };

  assert.equal(isFriendlyResponseWindowOpen(base, now), true);
  assert.equal(isFriendlyResponseWindowOpen(base, now + 30_000), false);
  assert.equal(isFriendlyResponseWindowOpen({ ...base, responseDeadline: null, startsAt: new Date(now) }, now), false);
  assert.equal(isFriendlyResponseWindowOpen({ ...base, status: FriendlyProposalStatus.CONFIRMED }, now), false);
});

test('invite token format accepts only 32-byte base64url tokens', () => {
  assert.equal(isFriendlyInviteTokenWellFormed('a'.repeat(43)), true);
  assert.equal(isFriendlyInviteTokenWellFormed('a'.repeat(42)), false);
  assert.equal(isFriendlyInviteTokenWellFormed(`${'a'.repeat(42)}.`), false);
});

test('only undecided applications can be withdrawn', () => {
  for (const status of [FriendlyApplicationStatus.INTERESTED, FriendlyApplicationStatus.COLLECTING, FriendlyApplicationStatus.SUBMITTED, FriendlyApplicationStatus.NEEDS_RECONFIRMATION]) {
    assert.equal(canWithdrawFriendlyApplication(status), true, `${status} should be withdrawable`);
  }
  for (const status of [FriendlyApplicationStatus.ACCEPTED, FriendlyApplicationStatus.REJECTED, FriendlyApplicationStatus.WITHDRAWN, FriendlyApplicationStatus.EXPIRED]) {
    assert.equal(canWithdrawFriendlyApplication(status), false, `${status} should not be withdrawable`);
  }
});

test('a withdrawn team can reuse its application while terminal decisions cannot be reopened', () => {
  assert.equal(canReopenWithdrawnFriendlyApplication(FriendlyApplicationStatus.WITHDRAWN), true);
  assert.equal(canReopenWithdrawnFriendlyApplication(FriendlyApplicationStatus.REJECTED), false);
  assert.equal(canReopenWithdrawnFriendlyApplication(FriendlyApplicationStatus.EXPIRED), false);
});

test('invite responses require the currently loaded revision', () => {
  assert.equal(isFriendlyInviteRevisionCurrent(4, 4), true);
  assert.equal(isFriendlyInviteRevisionCurrent(4, 3), false);
  assert.equal(isFriendlyInviteRevisionCurrent(4, undefined), false);
  assert.equal(isFriendlyInviteRevisionCurrent(4, '4'), false);
});

test('changing availability after submission requires a new official submission', () => {
  assert.equal(availabilityChangeNeedsResubmission(FriendlyApplicationStatus.SUBMITTED, true, 'AVAILABLE', 'UNAVAILABLE'), true);
  assert.equal(availabilityChangeNeedsResubmission(FriendlyApplicationStatus.SUBMITTED, true, 'UNAVAILABLE', 'AVAILABLE'), false);
  assert.equal(availabilityChangeNeedsResubmission(FriendlyApplicationStatus.SUBMITTED, false, 'AVAILABLE', 'UNAVAILABLE'), false);
  assert.equal(availabilityChangeNeedsResubmission(FriendlyApplicationStatus.COLLECTING, true, null, 'AVAILABLE'), false);
});

test('team invite names collapse case and repeated whitespace for duplicate response detection', () => {
  assert.equal(normalizeFriendlyPlayerName('  Maya   Carter '), normalizeFriendlyPlayerName('maya carter'));
});

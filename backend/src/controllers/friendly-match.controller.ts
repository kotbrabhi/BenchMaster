import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import * as friendlyMatchService from '../services/friendly-match.service';
import * as friendlyApplicationService from '../services/friendly-application.service';
import * as friendlyNotificationService from '../services/friendly-notification.service';

export async function listProposals(request: Request, response: Response) {
  response.json(await friendlyMatchService.listProposals(getAuthenticatedUser(request).id, {
    from: typeof request.query.from === 'string' ? request.query.from : undefined,
    to: typeof request.query.to === 'string' ? request.query.to : undefined,
    category: typeof request.query.category === 'string' ? request.query.category : undefined
  }));
}

export async function listAllProposals(request: Request, response: Response) {
  response.json(await friendlyMatchService.listProposals(getAuthenticatedUser(request).id, {
    from: typeof request.query.from === 'string' ? request.query.from : undefined,
    to: typeof request.query.to === 'string' ? request.query.to : undefined,
    category: typeof request.query.category === 'string' ? request.query.category : undefined
  }));
}

export async function listMyProposals(request: Request, response: Response) {
  response.json(await friendlyMatchService.listMyProposals(getAuthenticatedUser(request).id));
}

export async function createProposal(request: Request, response: Response) {
  response.status(201).json(await friendlyMatchService.createProposal(getAuthenticatedUser(request).id, request.body));
}

export async function getProposal(request: Request, response: Response) {
  response.json(await friendlyMatchService.getProposal(getAuthenticatedUser(request).id, Number(request.params.proposalId)));
}

export async function updateProposal(request: Request, response: Response) {
  response.json(await friendlyMatchService.updateProposal(getAuthenticatedUser(request).id, Number(request.params.proposalId), request.body));
}

export async function cancelProposal(request: Request, response: Response) {
  response.json(await friendlyMatchService.cancelProposal(getAuthenticatedUser(request).id, Number(request.params.proposalId), request.body?.reason));
}

export async function createInterest(request: Request, response: Response) {
  response.status(201).json(await friendlyApplicationService.createInterest(
    getAuthenticatedUser(request).id,
    Number(request.params.proposalId),
    Number(request.body?.teamId)
  ));
}

export async function listMyApplications(request: Request, response: Response) {
  response.json(await friendlyApplicationService.listMyApplications(getAuthenticatedUser(request).id));
}

export async function getMyApplication(request: Request, response: Response) {
  response.json(await friendlyApplicationService.getMyApplication(getAuthenticatedUser(request).id, Number(request.params.applicationId)));
}

export async function createOrRotateInvites(request: Request, response: Response) {
  response.status(201).json(await friendlyApplicationService.createOrRotateInvites(
    getAuthenticatedUser(request).id,
    Number(request.params.applicationId)
  ));
}

export async function revokeInvite(request: Request, response: Response) {
  response.json(await friendlyApplicationService.revokeInvite(
    getAuthenticatedUser(request).id,
    Number(request.params.applicationId),
    Number(request.params.responseId)
  ));
}

export async function revokeTeamInvite(request: Request, response: Response) {
  response.json(await friendlyApplicationService.revokeTeamInvite(getAuthenticatedUser(request).id, Number(request.params.applicationId)));
}

export async function submitApplication(request: Request, response: Response) {
  response.json(await friendlyApplicationService.submitApplication(
    getAuthenticatedUser(request).id,
    Number(request.params.applicationId),
    request.body
  ));
}

export async function withdrawApplication(request: Request, response: Response) {
  response.json(await friendlyApplicationService.withdrawApplication(getAuthenticatedUser(request).id, Number(request.params.applicationId)));
}

export async function listProposalApplications(request: Request, response: Response) {
  response.json(await friendlyApplicationService.listProposalApplications(getAuthenticatedUser(request).id, Number(request.params.proposalId)));
}

export async function acceptApplication(request: Request, response: Response) {
  response.json(await friendlyApplicationService.acceptApplication(getAuthenticatedUser(request).id, Number(request.params.applicationId)));
}

export async function rejectApplication(request: Request, response: Response) {
  response.json(await friendlyApplicationService.rejectApplication(getAuthenticatedUser(request).id, Number(request.params.applicationId)));
}

export async function listMyFriendlyMatches(request: Request, response: Response) {
  response.json(await friendlyNotificationService.listMyFriendlyMatches(getAuthenticatedUser(request).id));
}

export async function listMyFriendlyNotifications(request: Request, response: Response) {
  response.json(await friendlyNotificationService.listMyFriendlyNotifications(getAuthenticatedUser(request).id));
}

export async function markFriendlyNotificationRead(request: Request, response: Response) {
  response.json(await friendlyNotificationService.markFriendlyNotificationRead(getAuthenticatedUser(request).id, Number(request.params.notificationId)));
}

export async function getPublicInvite(request: Request, response: Response) {
  response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const token = Array.isArray(request.params.token) ? request.params.token[0] : request.params.token;
  response.json(await friendlyApplicationService.getPublicInvite(token));
}

export async function setPublicAvailability(request: Request, response: Response) {
  response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const token = Array.isArray(request.params.token) ? request.params.token[0] : request.params.token;
  response.json(await friendlyApplicationService.setPublicAvailability(token, request.body));
}

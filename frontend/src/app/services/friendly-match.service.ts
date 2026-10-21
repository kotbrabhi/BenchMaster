import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import { FriendlyCandidateApplication, FriendlyConfirmedMatch, FriendlyInviteLink, FriendlyMatchApplication, FriendlyMatchProposal, FriendlyMatchProposalPayload, FriendlyAvailability, FriendlyNotification, PublicFriendlyInvite } from '../core/models';

@Injectable({ providedIn: 'root' })
export class FriendlyMatchService {
  private readonly http = inject(HttpClient);

  list(category?: string) {
    const params = category ? new HttpParams().set('category', category) : undefined;
    return firstValueFrom(this.http.get<FriendlyMatchProposal[]>(`${API_BASE_URL}/friendly-matches`, { params }));
  }

  listMine() {
    return firstValueFrom(this.http.get<FriendlyMatchProposal[]>(`${API_BASE_URL}/friendly-matches/mine`));
  }

  get(proposalId: number) {
    return firstValueFrom(this.http.get<FriendlyMatchProposal>(`${API_BASE_URL}/friendly-matches/${proposalId}`));
  }

  create(payload: FriendlyMatchProposalPayload) {
    return firstValueFrom(this.http.post<FriendlyMatchProposal>(`${API_BASE_URL}/friendly-matches`, payload));
  }

  update(proposalId: number, payload: Partial<FriendlyMatchProposalPayload>) {
    return firstValueFrom(this.http.put<FriendlyMatchProposal>(`${API_BASE_URL}/friendly-matches/${proposalId}`, payload));
  }

  cancel(proposalId: number, reason?: string) {
    return firstValueFrom(this.http.post<FriendlyMatchProposal>(`${API_BASE_URL}/friendly-matches/${proposalId}/cancel`, { reason }));
  }

  expressInterest(proposalId: number, teamId: number) {
    return firstValueFrom(this.http.post<FriendlyMatchApplication>(`${API_BASE_URL}/friendly-matches/${proposalId}/applications`, { teamId }));
  }

  listMyApplications() {
    return firstValueFrom(this.http.get<FriendlyMatchApplication[]>(`${API_BASE_URL}/my/friendly-match-applications`));
  }

  getApplication(applicationId: number) {
    return firstValueFrom(this.http.get<FriendlyMatchApplication>(`${API_BASE_URL}/friendly-match-applications/${applicationId}`));
  }

  listProposalApplications(proposalId: number) {
    return firstValueFrom(this.http.get<FriendlyCandidateApplication[]>(`${API_BASE_URL}/friendly-matches/${proposalId}/applications`));
  }

  acceptApplication(applicationId: number) {
    return firstValueFrom(this.http.post<{ id: number; proposalId: number; applicationId: number; status: 'CONFIRMED'; confirmedAt: string }>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/accept`, {}));
  }

  rejectApplication(applicationId: number) {
    return firstValueFrom(this.http.post<{ id: number; status: 'REJECTED' }>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/reject`, {}));
  }

  listMyConfirmedMatches() {
    return firstValueFrom(this.http.get<FriendlyConfirmedMatch[]>(`${API_BASE_URL}/my/friendly-matches`));
  }

  listNotifications() {
    return firstValueFrom(this.http.get<FriendlyNotification[]>(`${API_BASE_URL}/my/friendly-notifications`));
  }

  markNotificationRead(notificationId: number) {
    return firstValueFrom(this.http.post<{ read: boolean }>(`${API_BASE_URL}/my/friendly-notifications/${notificationId}/read`, {}));
  }

  getPushPublicKey() {
    return firstValueFrom(this.http.get<{ publicKey: string }>(`${API_BASE_URL}/push/public-key`));
  }

  savePushSubscription(subscription: unknown) {
    return firstValueFrom(this.http.post<{ saved: boolean }>(`${API_BASE_URL}/push/subscriptions`, subscription));
  }

  removePushSubscription(endpoint: string) {
    return firstValueFrom(this.http.delete<{ removed: boolean }>(`${API_BASE_URL}/push/subscriptions`, { body: { endpoint } }));
  }

  createOrRotateInvites(applicationId: number) {
    return firstValueFrom(this.http.post<FriendlyInviteLink>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/invites`, {}));
  }

  revokeTeamInvite(applicationId: number) {
    return firstValueFrom(this.http.delete<{ revoked: boolean }>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/team-invite`));
  }

  revokeInvite(applicationId: number, responseId: number) {
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/invites/${responseId}`));
  }

  submitApplication(applicationId: number, responseIds: number[]) {
    return firstValueFrom(this.http.post<FriendlyMatchApplication>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/submit`, { responseIds }));
  }

  withdrawApplication(applicationId: number) {
    return firstValueFrom(this.http.post<{ id: number; status: 'WITHDRAWN' }>(`${API_BASE_URL}/friendly-match-applications/${applicationId}/withdraw`, {}));
  }

  getPublicInvite(token: string) {
    return firstValueFrom(this.http.get<PublicFriendlyInvite>(`${API_BASE_URL}/public/friendly-match-invites/${encodeURIComponent(token)}`));
  }

  setAvailability(token: string, playerName: string, availability: FriendlyAvailability, revision?: number) {
    return firstValueFrom(this.http.put<{ availability: FriendlyAvailability; respondedAt: string; revision: number }>(
      `${API_BASE_URL}/public/friendly-match-invites/${encodeURIComponent(token)}/response`,
      { playerName, availability, ...(revision === undefined ? {} : { revision }) }
    ));
  }
}

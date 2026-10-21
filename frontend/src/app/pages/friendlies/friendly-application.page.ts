import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { getErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { FriendlyInviteLink, FriendlyMatchApplication, FriendlyPlayerResponse } from '../../core/models';
import { TranslationKey } from '../../core/translations';
import { I18nService } from '../../core/i18n.service';
import { FriendlyMatchService } from '../../services/friendly-match.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-friendly-application-page',
  imports: [CommonModule, DatePipe, RouterLink, TranslatePipe],
  templateUrl: './friendly-application.page.html',
  styleUrl: './friendly-application.page.scss'
})
export class FriendlyApplicationPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FriendlyMatchService);
  private readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private refreshSubscription?: Subscription;

  readonly application = signal<FriendlyMatchApplication | null>(null);
  readonly generatedLink = signal<FriendlyInviteLink | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly selectedPlayerIds = signal<number[]>([]);
  private selectionInitialized = false;

  async ngOnInit() {
    if (!this.auth.isAuthenticated()) {
      this.loading.set(false);
      return;
    }
    await this.load();
    this.refreshSubscription = interval(15000).subscribe(() => void this.load(false));
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
  }

  async load(showLoading = true) {
    const applicationId = Number(this.route.snapshot.paramMap.get('applicationId'));
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      this.error.set(this.i18n.t('friendlies.errorInvalidApplicationId'));
      this.loading.set(false);
      return;
    }
    if (showLoading) this.loading.set(true);
    this.error.set('');
    try {
      const application = await this.service.getApplication(applicationId);
      const previousApplication = this.application();
      this.application.set(application);
      if (!this.selectionInitialized) {
        const selectedIds = ['SUBMITTED', 'ACCEPTED', 'NEEDS_RECONFIRMATION'].includes(application.status)
          ? application.proposedPlayers.flatMap((player) => {
              const response = application.playerResponses.find((item) => item.playerNameSnapshot === player.playerNameSnapshot);
              return response ? [response.id] : [];
            })
          : application.playerResponses.filter((response) => response.availability === 'AVAILABLE').map((response) => response.id);
        this.selectedPlayerIds.set(selectedIds);
        this.selectionInitialized = true;
      } else if (!['SUBMITTED', 'ACCEPTED', 'NEEDS_RECONFIRMATION'].includes(application.status) && previousApplication) {
        const newlyAvailableIds = application.playerResponses
          .filter((response) => response.availability === 'AVAILABLE')
          .filter((response) => {
            const previous = previousApplication.playerResponses.find((item) => item.id === response.id);
            return !previous || previous.availability !== 'AVAILABLE';
          })
          .map((response) => response.id);
        if (newlyAvailableIds.length) {
          this.selectedPlayerIds.update((ids) => [...new Set([...ids, ...newlyAvailableIds])]);
        }
      }
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.loading.set(false);
    }
  }

  async generateLinks() {
    const application = this.application();
    if (!application) return;
    const hasActive = !!application.teamInvite && !application.teamInvite.revokedAt && new Date(application.teamInvite.expiresAt).getTime() > Date.now();
    if (hasActive && !window.confirm(this.i18n.t('friendlies.rotateLinksConfirm'))) return;
    this.error.set('');
    this.info.set('');
    this.submitting.set(true);
    try {
      const link = await this.service.createOrRotateInvites(application.id);
      this.generatedLink.set(link);
      this.info.set(this.i18n.t('friendlies.linksGenerated'));
      await this.load(false);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.submitting.set(false);
    }
  }

  async revokeTeamLink() {
    const application = this.application();
    if (!application || !application.teamInvite || application.teamInvite.revokedAt) return;
    if (!window.confirm(this.i18n.t('friendlies.revokeInviteConfirm'))) return;
    try {
      await this.service.revokeTeamInvite(application.id);
      this.generatedLink.set(null);
      this.info.set(this.i18n.t('friendlies.inviteRevoked'));
      await this.load(false);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    }
  }

  isSelected(response: FriendlyPlayerResponse) {
    return this.selectedPlayerIds().includes(response.id);
  }

  togglePlayer(response: FriendlyPlayerResponse, checked: boolean) {
    this.selectedPlayerIds.update((ids) => checked
      ? [...new Set([...ids, response.id])]
      : ids.filter((id) => id !== response.id));
  }

  async submitTeam() {
    const application = this.application();
    if (!application || this.submitting()) return;
    this.error.set('');
    this.info.set('');
    this.submitting.set(true);
    try {
      const updated = await this.service.submitApplication(application.id, this.selectedPlayerIds());
      this.application.set(updated);
      this.selectedPlayerIds.set(updated.proposedPlayers.flatMap((player) => {
        const response = updated.playerResponses.find((item) => item.playerNameSnapshot === player.playerNameSnapshot);
        return response ? [response.id] : [];
      }));
      this.selectionInitialized = true;
      this.info.set(this.i18n.t('friendlies.applicationSubmitted'));
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
      await this.load(false);
    } finally {
      this.submitting.set(false);
    }
  }

  async withdrawTeam() {
    const application = this.application();
    if (!application || this.submitting()) return;
    if (!window.confirm(this.i18n.t('friendlies.withdrawApplicationConfirm'))) return;
    this.error.set('');
    this.info.set('');
    this.submitting.set(true);
    try {
      await this.service.withdrawApplication(application.id);
      this.info.set(this.i18n.t('friendlies.applicationWithdrawn'));
      await this.load(false);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
      await this.load(false);
    } finally {
      this.submitting.set(false);
    }
  }

  async copyLink() {
    const link = this.generatedLink();
    if (!link) return;
    const url = this.inviteUrl(link);
    try {
      await navigator.clipboard.writeText(url);
      this.info.set(this.i18n.t('friendlies.linkCopied'));
    } catch {
      window.prompt(this.i18n.t('friendlies.copyLinkPrompt'), url);
    }
  }

  async shareLink() {
    const link = this.generatedLink();
    if (!link) return;
    const url = this.inviteUrl(link);
    if (typeof navigator.share !== 'function') {
      await this.copyLink();
      return;
    }
    try {
      await navigator.share({ title: this.i18n.t('friendlies.shareInviteTitle'), url });
      this.info.set(this.i18n.t('friendlies.shareInviteReady'));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.error.set(this.i18n.t('friendlies.shareInviteFailed'));
    }
  }

  inviteUrl(link: FriendlyInviteLink) {
    return new URL(link.path, window.location.origin).toString();
  }

  availabilityLabel(value: FriendlyPlayerResponse['availability']) {
    return (value ? `friendlies.availability.${value}` : 'friendlies.availability.NO_RESPONSE') as TranslationKey;
  }


  statusLabel(status: FriendlyMatchApplication['status']) {
    return `friendlies.applicationStatus.${status}` as TranslationKey;
  }

  isAvailable(response: FriendlyPlayerResponse) { return response.availability === 'AVAILABLE'; }
  isUnavailable(response: FriendlyPlayerResponse) { return response.availability === 'UNAVAILABLE'; }
  isNoResponse(response: FriendlyPlayerResponse) { return response.availability === null; }
  now() { return Date.now(); }
  hasActiveTeamInvite(application: FriendlyMatchApplication) {
    return !!application.teamInvite && !application.teamInvite.revokedAt && new Date(application.teamInvite.expiresAt).getTime() > Date.now();
  }
  count(application: FriendlyMatchApplication, value: FriendlyPlayerResponse['availability']) {
    return application.playerResponses.filter((response) => response.availability === value).length;
  }
  canSubmit(application: FriendlyMatchApplication) {
    return ['INTERESTED', 'COLLECTING', 'NEEDS_RECONFIRMATION'].includes(application.status)
      && this.selectedPlayerIds().every((id) => application.playerResponses.some((response) => response.id === id && response.availability === 'AVAILABLE'));
  }
  canWithdraw(application: FriendlyMatchApplication) {
    return ['INTERESTED', 'COLLECTING', 'SUBMITTED', 'NEEDS_RECONFIRMATION'].includes(application.status);
  }
}

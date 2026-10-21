import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { getErrorMessage } from '../../core/api';
import { FriendlyApplicationStatus, FriendlyCandidateApplication, FriendlyConfirmedMatch, FriendlyMatchApplication, FriendlyMatchProposal, FriendlyMatchProposalPayload } from '../../core/models';
import { TranslationKey } from '../../core/translations';
import { I18nService } from '../../core/i18n.service';
import { AuthService } from '../../core/auth.service';
import { TeamService } from '../../services/team.service';
import { FriendlyMatchService } from '../../services/friendly-match.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-friendlies-page',
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './friendlies.page.html',
  styleUrl: './friendlies.page.scss'
})
export class FriendliesPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly matches = inject(FriendlyMatchService);
  private readonly teamService = inject(TeamService);
  private readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);

  readonly proposals = signal<FriendlyMatchProposal[]>([]);
  readonly teams = this.teamService.teams;
  readonly proposal = signal<FriendlyMatchProposal | null>(null);
  readonly loading = signal(true);
  readonly refreshingList = signal(false);
  readonly listLoadError = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly view = signal<'network' | 'applications' | 'confirmed'>('network');
  readonly applications = signal<FriendlyMatchApplication[]>([]);
  readonly selectedApplication = signal<FriendlyMatchApplication | null>(null);
  readonly candidateApplications = signal<FriendlyCandidateApplication[]>([]);
  readonly confirmedMatches = signal<FriendlyConfirmedMatch[]>([]);
  readonly confirmedLoading = signal(true);
  readonly refreshingConfirmed = signal(false);
  readonly confirmedLoadError = signal(false);
  readonly decisionBusyId = signal<number | null>(null);
  readonly creatingInterest = signal(false);
  readonly proposalId = signal<number | null>(null);
  readonly isForm = signal(false);
  readonly isEdit = signal(false);
  private notificationsSubscription?: Subscription;
  private filterDebounce?: ReturnType<typeof setTimeout>;
  private listRequestInFlight = false;
  private listReloadQueued = false;
  private confirmedRequestInFlight = false;
  private confirmedInitialLoadComplete = false;
  readonly confirmedMatchesLoaded = signal(false);

  teamId = 0;
  category = '';
  startsAt = '';
  durationMinutes: number | null = 90;
  area = '';
  venueName = '';
  format = '5x5';
  level = '';
  notes = '';
  responseDeadline = '';
  filterCategory = '';
  selectedTeamForInterest = 0;

  async ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('proposalId');
    this.proposalId.set(idParam ? Number(idParam) : null);
    const routePath = this.route.snapshot.routeConfig?.path ?? '';
    this.isForm.set(routePath.endsWith('/new') || routePath.endsWith('/edit'));
    this.isEdit.set(routePath.endsWith('/edit'));
    if (!this.auth.isAuthenticated()) {
      this.loading.set(false);
      return;
    }
    if (!this.isForm() && !this.proposalId()) {
      void this.loadAuxiliaryData();
      this.notificationsSubscription = interval(20000).subscribe(() => {
        if (this.view() === 'confirmed') void this.loadAuxiliaryData();
      });
    }

    try {
      if (this.isForm()) {
        await this.teamService.loadTeams();
        if (this.isEdit() && this.proposalId()) {
          this.proposal.set(await this.matches.get(this.proposalId()!));
          this.fillForm(this.proposal()!);
        } else if (this.teams().length) {
          this.teamId = this.teams()[0].id;
        }
      } else if (this.proposalId()) {
        this.proposal.set(await this.matches.get(this.proposalId()!));
        if (this.proposal() && this.canManage(this.proposal()!)) {
          this.candidateApplications.set(await this.matches.listProposalApplications(this.proposalId()!));
        } else {
          const [teams, applications] = await Promise.all([this.teamService.loadTeams(), this.matches.listMyApplications()]);
          this.selectedTeamForInterest = teams[0]?.id ?? 0;
          this.applications.set(applications);
          this.selectedApplication.set(applications.find((application) =>
            application.proposalId === this.proposalId() && application.status !== 'WITHDRAWN'
          ) ?? null);
        }
      } else {
        await this.loadList();
      }
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.notificationsSubscription?.unsubscribe();
    if (this.filterDebounce != null) clearTimeout(this.filterDebounce);
  }

  async loadAuxiliaryData() {
    if (!this.auth.isAuthenticated() || this.confirmedRequestInFlight) return;
    this.confirmedRequestInFlight = true;
    if (this.confirmedInitialLoadComplete) this.refreshingConfirmed.set(true);
    else this.confirmedLoading.set(true);
    try {
      const matches = await this.matches.listMyConfirmedMatches();
      this.confirmedMatches.set(matches);
      this.confirmedMatchesLoaded.set(true);
      this.confirmedLoadError.set(false);
    } catch {
      this.confirmedLoadError.set(true);
    } finally {
      this.confirmedLoading.set(false);
      this.refreshingConfirmed.set(false);
      this.confirmedInitialLoadComplete = true;
      this.confirmedRequestInFlight = false;
    }
  }

  async loadList() {
    if (this.view() === 'confirmed') return;
    if (this.listRequestInFlight) {
      this.listReloadQueued = true;
      return;
    }
    this.listRequestInFlight = true;
    if (this.loading()) this.refreshingList.set(false);
    else this.refreshingList.set(true);
    this.error.set('');
    try {
      if (this.view() === 'applications') {
        this.applications.set(await this.matches.listMyApplications());
      } else if (this.view() === 'network') {
        const [network, mine] = await Promise.all([
          this.matches.list(this.filterCategory.trim() || undefined),
          this.matches.listMine()
        ]);
        const combined = new Map<number, FriendlyMatchProposal>();
        for (const proposal of [...network, ...mine]) combined.set(proposal.id, proposal);
        this.proposals.set([...combined.values()].sort((a, b) => {
          const ownershipOrder = Number(this.canManage(b)) - Number(this.canManage(a));
          return ownershipOrder || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        }));
      } else {
        this.proposals.set([]);
      }
      this.listLoadError.set(false);
    } catch (error) {
      if (this.view() === 'network' || this.view() === 'applications') {
        this.listLoadError.set(true);
        this.error.set('');
      } else {
        this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
      }
    } finally {
      this.loading.set(false);
      this.refreshingList.set(false);
      this.listRequestInFlight = false;
      if (this.listReloadQueued) {
        this.listReloadQueued = false;
        void this.loadList();
      }
    }
  }

  onFilterCategoryChange(value: string) {
    this.filterCategory = value;
    if (this.filterDebounce != null) clearTimeout(this.filterDebounce);
    this.filterDebounce = setTimeout(() => {
      this.filterDebounce = undefined;
      if (this.view() === 'network') void this.loadList();
    }, 300);
  }

  async setView(view: 'network' | 'applications' | 'confirmed') {
    if (this.view() === view) return;
    this.view.set(view);
    this.listLoadError.set(false);
    if (view === 'confirmed') return;
    await this.loadList();
  }

  async expressInterest() {
    if (!this.proposalId() || !this.selectedTeamForInterest) return;
    this.error.set('');
    this.creatingInterest.set(true);
    try {
      const application = await this.matches.expressInterest(this.proposalId()!, this.selectedTeamForInterest);
      await this.router.navigate(['/friendlies/applications', application.id]);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.creatingInterest.set(false);
    }
  }

  async submit() {
    this.error.set('');
    this.success.set('');
    this.submitting.set(true);
    const payload: FriendlyMatchProposalPayload = {
      organizerTeamId: Number(this.teamId),
      category: this.category,
      startsAt: new Date(this.startsAt).toISOString(),
      durationMinutes: this.durationMinutes,
      area: this.area,
      venueName: this.venueName || null,
      format: this.format,
      requestedPlayerCount: null,
      level: this.level || null,
      notes: this.notes || null,
      responseDeadline: this.responseDeadline ? new Date(this.responseDeadline).toISOString() : null
    };
    try {
      const result = this.isEdit() && this.proposalId()
        ? await this.matches.update(this.proposalId()!, payload)
        : await this.matches.create(payload);
      await this.router.navigate(['/friendlies', result.id]);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.submitting.set(false);
    }
  }

  async cancelProposal() {
    const proposal = this.proposal();
    if (!proposal || !window.confirm(this.i18n.t(proposal.status === 'CONFIRMED' ? 'friendlies.cancelConfirmedMatchConfirm' : 'friendlies.cancelConfirm'))) return;
    const reason = proposal.status === 'CONFIRMED' ? window.prompt(this.i18n.t('friendlies.cancelReasonPrompt')) ?? '' : '';
    this.error.set('');
    this.submitting.set(true);
    try {
      this.proposal.set(await this.matches.cancel(proposal.id, reason));
      await this.loadAuxiliaryData();
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.submitting.set(false);
    }
  }

  canManage(proposal: FriendlyMatchProposal) {
    return proposal.createdByUserId !== undefined && proposal.createdByUserId === this.auth.currentUser()?.id;
  }

  statusLabel(status: FriendlyMatchProposal['status']) {
    return `friendlies.status.${status}` as TranslationKey;
  }

  applicationStatusLabel(status: FriendlyApplicationStatus) {
    return `friendlies.applicationStatus.${status}` as TranslationKey;
  }

  async acceptCandidate(candidate: FriendlyCandidateApplication) {
    if (!window.confirm(this.i18n.t('friendlies.acceptCandidateConfirm', { team: candidate.team.name }))) return;
    this.decisionBusyId.set(candidate.id);
    this.error.set('');
    try {
      await this.matches.acceptApplication(candidate.id);
      if (this.proposalId()) this.proposal.set(await this.matches.get(this.proposalId()!));
      await Promise.all([this.reloadCandidates(), this.loadAuxiliaryData()]);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
      await this.reloadCandidates();
    } finally {
      this.decisionBusyId.set(null);
    }
  }

  async rejectCandidate(candidate: FriendlyCandidateApplication) {
    if (!window.confirm(this.i18n.t('friendlies.rejectCandidateConfirm', { team: candidate.team.name }))) return;
    this.decisionBusyId.set(candidate.id);
    this.error.set('');
    try {
      await this.matches.rejectApplication(candidate.id);
      await Promise.all([this.reloadCandidates(), this.loadAuxiliaryData()]);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.decisionBusyId.set(null);
    }
  }

  async cancelConfirmedMatch(match: FriendlyConfirmedMatch) {
    if (!window.confirm(this.i18n.t('friendlies.cancelConfirmedMatchConfirm'))) return;
    const reason = window.prompt(this.i18n.t('friendlies.cancelReasonPrompt')) ?? '';
    try {
      await this.matches.cancel(match.proposalId, reason);
      await this.loadAuxiliaryData();
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    }
  }

  acceptedLineupNames(match: FriendlyConfirmedMatch) {
    return match.application.proposedPlayers.map((player) => player.playerNameSnapshot).join(', ');
  }

  private fillForm(proposal: FriendlyMatchProposal) {
    this.teamId = proposal.organizerTeamId;
    this.category = proposal.category;
    this.startsAt = this.toLocalInput(proposal.startsAt);
    this.durationMinutes = proposal.durationMinutes;
    this.area = proposal.area;
    this.venueName = proposal.venueName ?? '';
    this.format = proposal.format;
    this.level = proposal.level ?? '';
    this.notes = proposal.notes ?? '';
    this.responseDeadline = proposal.responseDeadline ? this.toLocalInput(proposal.responseDeadline) : '';
  }

  private async reloadCandidates() {
    const proposalId = this.proposalId();
    if (proposalId) this.candidateApplications.set(await this.matches.listProposalApplications(proposalId));
  }

  private toLocalInput(value: string) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}

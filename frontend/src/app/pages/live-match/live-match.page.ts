import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameDetail, GamePlayerState } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { LiveMatchService } from '../../services/live-match.service';
import {
  PlayerCardInlineStat,
  PlayerCardQuickAction,
  PlayerCardStat,
  PlayerCardQuickActionValue
} from '../../shared/components/player-card/player-card.component';
import { TimeTrackingService } from '../../services/time-tracking.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { PlayerCardComponent } from '../../shared/components/player-card/player-card.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type LiveRosterView = 'court' | 'bench';

interface PendingLiveConfirmation {
  action: 'complete-period' | 'end-game';
  title: string;
  message: string;
  details: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
}

@Component({
  selector: 'app-live-match-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PlayerCardComponent, DurationPipe, TranslatePipe, ConfirmationDialogComponent],
  templateUrl: './live-match.page.html',
  styleUrl: './live-match.page.scss'
})
export class LiveMatchPageComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private rosterTouchStart: { x: number; y: number } | null = null;
  private mobileMediaQuery: MediaQueryList | null = null;
  readonly liveMatchService = inject(LiveMatchService);
  readonly timeTrackingService = inject(TimeTrackingService);

  readonly game = this.liveMatchService.game;
  readonly pendingBenchPlayers = this.liveMatchService.pendingBenchPlayers;
  readonly pendingActivePlayers = this.liveMatchService.pendingActivePlayers;
  readonly canApplySubstitutionBatch = this.liveMatchService.canApplySubstitutionBatch;
  readonly errorMessage = signal('');
  readonly busyAction = signal<string | null>(null);
  readonly statUpdatePlayerIds = signal<number[]>([]);
  readonly correctionMode = signal(false);
  readonly mobileRosterView = signal<LiveRosterView>('court');
  readonly isMobileViewport = signal(false);
  readonly expandedStatsPlayerId = signal<number | null>(null);
  readonly pendingConfirmation = signal<PendingLiveConfirmation | null>(null);
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  readonly t = this.i18n.t;

  async ngOnInit() {
    this.initMobileViewport();
    await this.loadGame();
  }

  ngOnDestroy() {
    this.mobileMediaQuery?.removeEventListener('change', this.handleMobileViewportChange);
  }

  async startGame() {
    await this.runAction('start', () => this.liveMatchService.startGame(this.gameId));
  }

  async pauseGame() {
    await this.runAction('pause', () => this.liveMatchService.pauseGame(this.gameId));
  }

  async resumeGame() {
    await this.runAction('resume', () => this.liveMatchService.resumeGame(this.gameId));
  }

  requestCompletePeriod() {
    const game = this.game();

    if (!game) {
      return;
    }

    this.pendingConfirmation.set({
      action: 'complete-period',
      title: this.t('live.confirmCompletePeriod.title', { number: game.currentPeriodNumber }),
      message: this.t('live.confirmCompletePeriod.message'),
      details: this.t('live.confirmCompletePeriod.details'),
      confirmLabel: this.t('live.actions.completePeriod'),
      tone: 'default'
    });
  }

  async startNextPeriod() {
    await this.runAction('start-next-period', () => this.liveMatchService.startNextPeriod(this.gameId));
  }

  async toggleBenchPlayer(playerId: number) {
    const player = this.game()?.benchPlayers.find((entry) => entry.playerId === playerId);

    if (player && this.isDisqualified(player)) {
      return;
    }

    const wasSelected = this.isBenchSelected(playerId);
    this.liveMatchService.toggleBenchPlayer(playerId);
    this.errorMessage.set('');
    this.syncMobileRosterFlow('bench', wasSelected);
  }

  async toggleActivePlayer(playerId: number) {
    const wasSelected = this.isActiveSelected(playerId);
    this.liveMatchService.toggleActivePlayer(playerId);
    this.errorMessage.set('');
    this.syncMobileRosterFlow('court', wasSelected);
  }

  clearSelections() {
    this.liveMatchService.clearSelections();
  }

  mobileRosterSwitchAriaLabel() {
    return this.t('live.mobileRosterSwitch.ariaLabel');
  }

  setMobileRosterView(view: LiveRosterView) {
    this.mobileRosterView.set(view);

    if (view !== 'court') {
      this.expandedStatsPlayerId.set(null);
    }
  }

  handleRosterTouchStart(event: TouchEvent) {
    const [touch] = event.touches;

    if (!touch) {
      return;
    }

    this.rosterTouchStart = { x: touch.clientX, y: touch.clientY };
  }

  handleRosterTouchEnd(event: TouchEvent) {
    if (!this.rosterTouchStart) {
      return;
    }

    const [touch] = event.changedTouches;

    if (!touch) {
      this.rosterTouchStart = null;
      return;
    }

    const deltaX = touch.clientX - this.rosterTouchStart.x;
    const deltaY = touch.clientY - this.rosterTouchStart.y;
    this.rosterTouchStart = null;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaY) > 72) {
      return;
    }

    this.setMobileRosterView(deltaX < 0 ? 'bench' : 'court');
  }

  async substituteBatch() {
    try {
      this.busyAction.set('apply-substitution');
      await this.liveMatchService.substitute(this.gameId);
      this.mobileRosterView.set('court');
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  requestEndGame() {
    this.pendingConfirmation.set({
      action: 'end-game',
      title: this.t('live.confirmEndGame.title'),
      message: this.t('live.confirmEndGame.message'),
      details: this.t('live.confirmEndGame.details'),
      confirmLabel: this.t('live.actions.end'),
      tone: 'danger'
    });
  }

  clockSeconds(game: GameDetail) {
    return this.timeTrackingService.getClockSeconds(game);
  }

  periodClockSeconds(game: GameDetail) {
    return this.timeTrackingService.getPeriodClockSeconds(game);
  }

  playerSeconds(game: GameDetail, player: GamePlayerState) {
    return this.timeTrackingService.getPlayerSeconds(game, player);
  }

  playerPeriodSeconds(game: GameDetail, player: GamePlayerState) {
    return this.timeTrackingService.getPlayerPeriodSeconds(game, player);
  }

  playerTimeSummary(game: GameDetail, player: GamePlayerState) {
    return [
      `${this.t('live.playerTime.periodShort')} ${this.formatClock(this.playerPeriodSeconds(game, player))}`,
      `${this.t('live.playerTime.matchShort')} ${this.formatClock(this.playerSeconds(game, player))}`
    ].join(' · ');
  }

  playerStats(player: GamePlayerState): PlayerCardStat[] {
    return [
      {
        label: this.t('live.stats.points.short'),
        value: player.points,
        highlighted: player.points > 0
      },
      {
        label: this.t('live.stats.assists.short'),
        value: player.assists,
        highlighted: player.assists > 0
      },
      {
        label: this.t('live.stats.rebounds.short'),
        value: player.rebounds,
        highlighted: player.rebounds > 0
      },
      {
        label: this.t('live.stats.blocks.short'),
        value: player.blocks,
        highlighted: player.blocks > 0
      }
    ];
  }

  foulCounter(player: GamePlayerState, clickable: boolean): PlayerCardInlineStat {
    const correctionMode = this.correctionMode();
    const isDisqualified = this.isDisqualified(player);

    return {
      label: this.t('live.stats.fouls.short'),
      value: player.fouls,
      title: correctionMode ? this.t('live.actions.removeFoul') : this.t('live.actions.addFoul'),
      disabled: this.isUpdatingStats(player.playerId) || (correctionMode && !this.canReverseAction(player, 'fouls')),
      highlighted: player.fouls > 0,
      clickable,
      tone: correctionMode || player.fouls > 0 || isDisqualified ? 'danger' : 'default'
    };
  }

  teamFouls(game: GameDetail) {
    return game.selectedPlayers.reduce((total, player) => total + player.periodFouls, 0);
  }

  isTeamFoulsWarning(game: GameDetail) {
    return this.teamFouls(game) >= 4;
  }

  isBenchSelected(playerId: number) {
    return this.liveMatchService.selectedBenchPlayerIds().includes(playerId);
  }

  isActiveSelected(playerId: number) {
    return this.liveMatchService.selectedActivePlayerIds().includes(playerId);
  }

  isActionBusy(action: string) {
    return this.busyAction() === action;
  }

  activePlayerActionLabel(playerId: number) {
    return this.isActiveSelected(playerId) ? this.t('live.actions.cancelSubOut') : this.t('live.actions.selectSubOutAction');
  }

  benchPlayerActionLabel(playerId: number) {
    const player = this.game()?.benchPlayers.find((entry) => entry.playerId === playerId);

    if (player && this.isDisqualified(player)) {
      return this.t('live.actions.disqualified');
    }

    return this.isBenchSelected(playerId) ? this.t('live.actions.cancelSubIn') : this.t('live.actions.selectSubInAction');
  }

  playerSelectionStateLabel(playerId: number, view: LiveRosterView) {
    const player = view === 'court'
      ? this.game()?.activePlayers.find((entry) => entry.playerId === playerId)
      : this.game()?.benchPlayers.find((entry) => entry.playerId === playerId);

    if (player && this.isDisqualified(player)) {
      return this.t('live.states.disqualified');
    }

    const isSelected = view === 'court' ? this.isActiveSelected(playerId) : this.isBenchSelected(playerId);
    return isSelected ? this.t('common.state.selected', this.labelParams()) : '';
  }

  pendingCountsLabel() {
    return this.t('live.pending.counts', {
      ins: this.pendingBenchPlayers().length,
      outs: this.pendingActivePlayers().length,
      ...this.labelParams()
    });
  }

  pendingHeadline() {
    const game = this.game();
    const incomingSelections = this.pendingBenchPlayers().length;
    const outgoingSelections = this.pendingActivePlayers().length;
    const totalSelections = incomingSelections + outgoingSelections;
    const vacancyCount = game ? this.vacancyCount(game) : 0;
    const requiredIncomingSelections = outgoingSelections + vacancyCount;

    if (totalSelections === 0) {
      return vacancyCount > 0
        ? this.t('live.pending.needIncoming', { count: vacancyCount, ...this.labelParams() })
        : this.t('live.pending.none');
    }

    if (incomingSelections < requiredIncomingSelections) {
      return this.t('live.pending.awaitingInCount', {
        count: requiredIncomingSelections - incomingSelections,
        ...this.labelParams()
      });
    }

    if (incomingSelections > requiredIncomingSelections) {
      return this.t('live.pending.awaitingOutCount', {
        count: incomingSelections - requiredIncomingSelections,
        ...this.labelParams()
      });
    }

    return this.canApplySubstitutionBatch() ? this.pendingCountsLabel() : this.t('live.pending.none');
  }

  pendingStatusMessage() {
    const game = this.game();
    const incomingSelections = this.pendingBenchPlayers().length;
    const outgoingSelections = this.pendingActivePlayers().length;
    const totalSelections = incomingSelections + outgoingSelections;
    const vacancyCount = game ? this.vacancyCount(game) : 0;

    if (totalSelections === 0) {
      return '';
    }

    return this.canApplySubstitutionBatch() ? this.t('live.pending.ready') : this.t('live.pending.mismatch', this.labelParams());
  }

  pendingInstructionMessage() {
    const game = this.game();
    const vacancyCount = game ? this.vacancyCount(game) : 0;

    if (!this.hasPendingSelections()) {
      return this.t('live.pending.instructions', this.labelParams());
    }

    if (vacancyCount > 0 && this.pendingBenchPlayers().length === 0 && this.pendingActivePlayers().length === 0) {
      return this.t('live.pending.instructionsVacancy', { count: vacancyCount, ...this.labelParams() });
    }

    return this.pendingStatusMessage() || this.t('live.pending.subtitle');
  }

  hasPendingSelections() {
    return this.pendingBenchPlayers().length + this.pendingActivePlayers().length > 0 || this.vacancyCount(this.game()) > 0;
  }

  guidedRosterView(): LiveRosterView | null {
    const game = this.game();
    const incomingSelections = this.pendingBenchPlayers().length;
    const outgoingSelections = this.pendingActivePlayers().length;
    const vacancyCount = game ? this.vacancyCount(game) : 0;
    const requiredIncomingSelections = outgoingSelections + vacancyCount;

    if (incomingSelections < requiredIncomingSelections) {
      return 'bench';
    }

    if (incomingSelections > requiredIncomingSelections) {
      return 'court';
    }

    return null;
  }

  rosterGuidanceLabel(view: LiveRosterView) {
    if (this.guidedRosterView() !== view) {
      return '';
    }

    return view === 'court'
      ? this.t('live.flow.pickOutgoing', this.labelParams())
      : this.t('live.flow.pickIncoming', this.labelParams());
  }

  rosterGuidanceChipLabel(view: LiveRosterView) {
    if (this.guidedRosterView() !== view) {
      return '';
    }

    return view === 'court' ? this.t('live.flow.nextOutgoingShort') : this.t('live.flow.nextIncomingShort');
  }

  thumbDockTitle(game: GameDetail) {
    if (this.correctionMode()) {
      return this.t('live.correction.armedTitle');
    }

    if (this.hasPendingSelections()) {
      return this.pendingHeadline();
    }

    return '';
  }

  thumbDockMessage() {
    if (this.correctionMode()) {
      return this.t('live.correction.armedSubtitle');
    }

    if (this.hasPendingSelections()) {
      return this.pendingInstructionMessage();
    }

    return '';
  }

  statusLabel(game: GameDetail) {
    return {
      DRAFT: this.t('live.status.draft'),
      LIVE: this.t('live.status.live'),
      PAUSED: this.t('live.status.paused'),
      FINISHED: this.t('live.status.finished')
    }[game.status];
  }

  periodStatusLabel(game: GameDetail) {
    return {
      NOT_STARTED: this.t('live.period.status.notStarted'),
      LIVE: this.t('live.period.status.live'),
      COMPLETED: this.t('live.period.status.completed')
    }[this.effectivePeriodStatus(game)];
  }

  effectivePeriodStatus(game: GameDetail) {
    if (game.currentPeriodStatus === 'NOT_STARTED' && game.status !== 'DRAFT' && game.startedAt) {
      return 'LIVE';
    }

    return game.currentPeriodStatus;
  }

  canPause(game: GameDetail) {
    return game.status === 'LIVE' && this.effectivePeriodStatus(game) === 'LIVE';
  }

  canResume(game: GameDetail) {
    return game.status === 'PAUSED' && this.effectivePeriodStatus(game) === 'LIVE';
  }

  canCompletePeriod(game: GameDetail) {
    return (game.status === 'LIVE' || game.status === 'PAUSED') && this.effectivePeriodStatus(game) === 'LIVE';
  }

  canStartNextPeriod(game: GameDetail) {
    return game.status === 'PAUSED' && this.effectivePeriodStatus(game) === 'COMPLETED';
  }

  toggleCorrectionMode() {
    this.correctionMode.update((current) => !current);
    this.errorMessage.set('');
  }

  correctionActionKey(): TranslationKey {
    return this.correctionMode() ? 'live.correction.cancel' : 'live.correction.activate';
  }

  pointActions(player: GamePlayerState): PlayerCardQuickAction[] {
    const disabled = this.isUpdatingStats(player.playerId);
    const correctionMode = this.correctionMode();
    const statLabel = (labelKey: TranslationKey) => {
      const label = this.t(labelKey);
      return correctionMode ? `-${label}` : label;
    };

    return [
      ...[1, 2, 3].map((points) => ({
        value: points,
        label: `${correctionMode ? '-' : '+'}${points}`,
        title: correctionMode
          ? this.t('live.actions.removePoints', { count: points })
          : this.t('live.actions.addPoints', { count: points }),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, points)),
        row: 'primary' as const
      })),
      {
        value: 'assists' as const,
        label: statLabel('live.stats.assists.short'),
        title: correctionMode ? this.t('live.actions.removeAssist') : this.t('live.actions.addAssist'),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, 'assists')),
        row: 'secondary' as const
      },
      {
        value: 'blocks' as const,
        label: statLabel('live.stats.blocks.short'),
        title: correctionMode ? this.t('live.actions.removeBlock') : this.t('live.actions.addBlock'),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, 'blocks')),
        row: 'secondary' as const
      },
      {
        value: 'rebounds' as const,
        label: statLabel('live.stats.rebounds.short'),
        title: correctionMode ? this.t('live.actions.removeRebound') : this.t('live.actions.addRebound'),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, 'rebounds')),
        row: 'secondary' as const
      }
    ];
  }

  async handleQuickAction(playerId: number, action: PlayerCardQuickActionValue) {
    const correctionMode = this.correctionMode();
    this.statUpdatePlayerIds.update((current) => (current.includes(playerId) ? current : [...current, playerId]));

    try {
      if (typeof action === 'number') {
        await this.liveMatchService.recordPlayerPoints(this.gameId, playerId, action, correctionMode);
      } else {
        await this.liveMatchService.recordPlayerStat(this.gameId, playerId, action, correctionMode);
      }

      if (correctionMode) {
        this.correctionMode.set(false);
      }

      if (this.isMobileViewport()) {
        this.expandedStatsPlayerId.set(null);
      }

      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.statUpdatePlayerIds.update((current) => current.filter((id) => id !== playerId));
    }
  }

  isUpdatingStats(playerId: number) {
    return this.statUpdatePlayerIds().includes(playerId);
  }

  livePlayerNote(tone: LiveRosterView) {
    return tone === 'court' ? this.t('live.notes.currentlyOnCourt') : this.t('live.notes.availableOnBench');
  }

  playerNote(player: GamePlayerState, tone: LiveRosterView) {
    if (this.isDisqualified(player)) {
      return tone === 'court' ? this.t('live.notes.disqualifiedCourt') : this.t('live.notes.disqualifiedBench');
    }

    return this.livePlayerNote(tone);
  }

  isPlayerActionDisabled(player: GamePlayerState, view: LiveRosterView) {
    return view === 'bench' && this.isDisqualified(player);
  }

  isFoulCounterClickable(player: GamePlayerState, view: LiveRosterView) {
    if (this.isDisqualified(player)) {
      return false;
    }

    if (view === 'court') {
      return true;
    }

    return this.correctionMode() ? player.periodFouls >= 1 : true;
  }

  togglePlayerStatsCard(playerId: number) {
    if (!this.isMobileViewport()) {
      return;
    }

    this.expandedStatsPlayerId.update((current) => (current === playerId ? null : playerId));
  }

  isPlayerStatsCardExpanded(playerId: number) {
    return !this.isMobileViewport() || this.expandedStatsPlayerId() === playerId;
  }

  mobileRosterTabLabel(view: LiveRosterView) {
    const baseLabel = view === 'court' ? this.t('live.onCourt.title') : this.t('live.bench.title');
    return `${baseLabel} (${this.selectedCount(view)})`;
  }

  selectedCount(view: LiveRosterView) {
    return view === 'court' ? this.pendingActivePlayers().length : this.pendingBenchPlayers().length;
  }

  selectedOutgoingPlayers(game: GameDetail) {
    return game.activePlayers.filter((player) => this.isActiveSelected(player.playerId));
  }

  selectedIncomingPlayers(game: GameDetail) {
    return game.benchPlayers.filter((player) => this.isBenchSelected(player.playerId));
  }

  labelParams() {
    return buildTeamLabelParams(this.game()?.team.gender ?? 'MIXED');
  }

  onCourtSubtitleParams(game: GameDetail) {
    return {
      count: game.activePlayers.length,
      ...this.labelParams()
    };
  }

  closePendingConfirmation() {
    if (this.pendingConfirmation() && !this.busyAction()) {
      this.pendingConfirmation.set(null);
    }
  }

  async confirmPendingAction() {
    const confirmation = this.pendingConfirmation();

    if (!confirmation) {
      return;
    }

    if (confirmation.action === 'complete-period') {
      await this.confirmCompletePeriod();
      return;
    }

    await this.confirmEndGame();
  }

  private canReverseAction(player: GamePlayerState, action: PlayerCardQuickActionValue) {
    if (typeof action === 'number') {
      return player.points >= action;
    }

    if (action === 'fouls') {
      return player.periodFouls >= 1;
    }

    return player[action] >= 1;
  }

  private isDisqualified(player: GamePlayerState) {
    return player.fouls >= 5;
  }

  private vacancyCount(game: GameDetail | null | undefined) {
    return Math.max(0, 5 - (game?.activePlayers.length ?? 0));
  }

  private async loadGame() {
    try {
      await this.liveMatchService.loadGame(this.gameId);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  private async runAction(actionKey: string, callback: () => Promise<unknown>) {
    try {
      this.busyAction.set(actionKey);
      await callback();
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  private formatClock(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private readonly handleMobileViewportChange = (event: MediaQueryListEvent) => {
    this.isMobileViewport.set(event.matches);

    if (!event.matches) {
      this.expandedStatsPlayerId.set(null);
    }
  };

  private syncMobileRosterFlow(sourceView: LiveRosterView, wasSelected: boolean) {
    if (wasSelected) {
      return;
    }

    if (this.canApplySubstitutionBatch()) {
      return;
    }

    const guidedView = this.guidedRosterView();

    if (guidedView) {
      this.mobileRosterView.set(guidedView);
      return;
    }

    if (sourceView === 'bench' && this.hasPendingSelections()) {
      this.mobileRosterView.set('court');
    }
  }

  private async confirmCompletePeriod() {
    try {
      this.busyAction.set('complete-period');
      await this.liveMatchService.completePeriod(this.gameId);
      this.pendingConfirmation.set(null);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  private async confirmEndGame() {
    try {
      this.busyAction.set('end-game');
      await this.liveMatchService.endGame(this.gameId);
      this.pendingConfirmation.set(null);
      await this.router.navigate(['/games', this.gameId, 'summary']);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  private initMobileViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mobileMediaQuery = window.matchMedia('(max-width: 767px)');
    this.isMobileViewport.set(this.mobileMediaQuery.matches);
    this.mobileMediaQuery.addEventListener('change', this.handleMobileViewportChange);
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameDetail, GamePlayerState } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { LiveMatchService } from '../../services/live-match.service';
import {
  PlayerCardQuickAction,
  PlayerCardStat,
  PlayerCardQuickActionValue
} from '../../shared/components/player-card/player-card.component';
import { TimeTrackingService } from '../../services/time-tracking.service';
import { PlayerCardComponent } from '../../shared/components/player-card/player-card.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type LiveRosterView = 'court' | 'bench';

@Component({
  selector: 'app-live-match-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PlayerCardComponent, DurationPipe, TranslatePipe],
  templateUrl: './live-match.page.html',
  styleUrl: './live-match.page.scss'
})
export class LiveMatchPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  readonly t = this.i18n.t;

  async ngOnInit() {
    await this.loadGame();
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

  async completePeriod() {
    const confirmed = window.confirm(this.t('live.confirmCompletePeriod'));

    if (!confirmed) {
      return;
    }

    await this.runAction('complete-period', () => this.liveMatchService.completePeriod(this.gameId));
  }

  async startNextPeriod() {
    await this.runAction('start-next-period', () => this.liveMatchService.startNextPeriod(this.gameId));
  }

  async toggleBenchPlayer(playerId: number) {
    this.liveMatchService.toggleBenchPlayer(playerId);
    this.errorMessage.set('');
  }

  async toggleActivePlayer(playerId: number) {
    this.liveMatchService.toggleActivePlayer(playerId);
    this.errorMessage.set('');
  }

  clearSelections() {
    this.liveMatchService.clearSelections();
  }

  mobileRosterSwitchAriaLabel() {
    return this.t('live.mobileRosterSwitch.ariaLabel');
  }

  setMobileRosterView(view: LiveRosterView) {
    this.mobileRosterView.set(view);
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

  async endGame() {
    const confirmed = window.confirm(this.t('live.confirmEndGame'));

    if (!confirmed) {
      return;
    }

    try {
      this.busyAction.set('end-game');
      await this.liveMatchService.endGame(this.gameId);
      await this.router.navigate(['/games', this.gameId, 'summary']);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
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
    return this.isBenchSelected(playerId) ? this.t('live.actions.cancelSubIn') : this.t('live.actions.selectSubInAction');
  }

  playerSelectionStateLabel(playerId: number, view: LiveRosterView) {
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
    const incomingSelections = this.pendingBenchPlayers().length;
    const outgoingSelections = this.pendingActivePlayers().length;
    const totalSelections = incomingSelections + outgoingSelections;

    if (totalSelections === 0) {
      return this.t('live.pending.none');
    }

    if (incomingSelections === 1 && outgoingSelections === 0) {
      return this.t('live.pending.awaitingOut', this.labelParams());
    }

    if (incomingSelections === 0 && outgoingSelections === 1) {
      return this.t('live.pending.awaitingIn', this.labelParams());
    }

    return this.pendingCountsLabel();
  }

  pendingStatusMessage() {
    const incomingSelections = this.pendingBenchPlayers().length;
    const outgoingSelections = this.pendingActivePlayers().length;
    const totalSelections = incomingSelections + outgoingSelections;

    if (totalSelections === 0 || (incomingSelections === 1 && outgoingSelections === 0) || (incomingSelections === 0 && outgoingSelections === 1)) {
      return '';
    }

    return this.canApplySubstitutionBatch() ? this.t('live.pending.ready') : this.t('live.pending.mismatch', this.labelParams());
  }

  pendingInstructionMessage() {
    if (!this.hasPendingSelections()) {
      return this.t('live.pending.instructions', this.labelParams());
    }

    return this.pendingStatusMessage() || this.t('live.pending.subtitle');
  }

  hasPendingSelections() {
    return this.pendingBenchPlayers().length + this.pendingActivePlayers().length > 0;
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

  private canReverseAction(player: GamePlayerState, action: PlayerCardQuickActionValue) {
    if (typeof action === 'number') {
      return player.points >= action;
    }

    return player[action] >= 1;
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
}

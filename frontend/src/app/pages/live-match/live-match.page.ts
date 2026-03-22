import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameDetail, GamePlayerState } from '../../core/models';
import { TranslationKey } from '../../core/translations';
import { LiveMatchService } from '../../services/live-match.service';
import {
  PlayerCardQuickAction,
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
  readonly statUpdatePlayerIds = signal<number[]>([]);
  readonly correctionMode = signal(false);
  readonly mobileRosterView = signal<LiveRosterView>('court');
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  readonly t = this.i18n.t;

  async ngOnInit() {
    await this.loadGame();
  }

  async startGame() {
    await this.runAction(() => this.liveMatchService.startGame(this.gameId));
  }

  async pauseGame() {
    await this.runAction(() => this.liveMatchService.pauseGame(this.gameId));
  }

  async resumeGame() {
    await this.runAction(() => this.liveMatchService.resumeGame(this.gameId));
  }

  async completePeriod() {
    const confirmed = window.confirm(this.t('live.confirmCompletePeriod'));

    if (!confirmed) {
      return;
    }

    await this.runAction(() => this.liveMatchService.completePeriod(this.gameId));
  }

  async startNextPeriod() {
    await this.runAction(() => this.liveMatchService.startNextPeriod(this.gameId));
  }

  async toggleBenchPlayer(playerId: number) {
    this.liveMatchService.toggleBenchPlayer(playerId);
    await this.applyInstantSubstitutionIfReady();
  }

  async toggleActivePlayer(playerId: number) {
    this.liveMatchService.toggleActivePlayer(playerId);
    await this.applyInstantSubstitutionIfReady();
  }

  clearSelections() {
    this.liveMatchService.clearSelections();
  }

  mobileRosterSwitchAriaLabel() {
    return this.i18n.locale() === 'fr'
      ? 'Navigation mobile entre le terrain et le banc'
      : 'Mobile navigation between court and bench';
  }

  mobileRosterSwipeHint() {
    return this.i18n.locale() === 'fr'
      ? "Balayez l'ecran pour passer du terrain au banc."
      : 'Swipe the screen to switch between court and bench.';
  }

  scrollMobileRoster(container: HTMLElement, view: LiveRosterView) {
    this.mobileRosterView.set(view);

    if (!container.clientWidth) {
      return;
    }

    container.scrollTo({
      left: view === 'court' ? 0 : container.clientWidth,
      behavior: 'smooth'
    });
  }

  syncMobileRosterView(container: HTMLElement) {
    if (!container.clientWidth || container.scrollWidth <= container.clientWidth) {
      return;
    }

    const nextView: LiveRosterView = container.scrollLeft >= container.clientWidth / 2 ? 'bench' : 'court';

    if (this.mobileRosterView() !== nextView) {
      this.mobileRosterView.set(nextView);
    }
  }

  async substituteBatch() {
    await this.runAction(() => this.liveMatchService.substitute(this.gameId));
  }

  async endGame() {
    const confirmed = window.confirm(this.t('live.confirmEndGame'));

    if (!confirmed) {
      return;
    }

    try {
      await this.liveMatchService.endGame(this.gameId);
      await this.router.navigate(['/games', this.gameId, 'summary']);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
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
    const segments = [
      `${this.t('live.playerTime.periodShort')}${this.formatClock(this.playerPeriodSeconds(game, player))}`,
      `${this.t('live.playerTime.matchShort')}${this.formatClock(this.playerSeconds(game, player))}`
    ];

    const statSegments = [
      player.points > 0 ? this.t('live.points.inline', { count: player.points }) : '',
      player.assists > 0 ? this.t('live.assists.inline', { count: player.assists }) : '',
      player.blocks > 0 ? this.t('live.blocks.inline', { count: player.blocks }) : '',
      player.rebounds > 0 ? this.t('live.rebounds.inline', { count: player.rebounds }) : ''
    ].filter(Boolean);

    if (statSegments.length) {
      segments.push(statSegments.join(' '));
    }

    return segments.join(' · ');
  }

  isBenchSelected(playerId: number) {
    return this.liveMatchService.selectedBenchPlayerIds().includes(playerId);
  }

  isActiveSelected(playerId: number) {
    return this.liveMatchService.selectedActivePlayerIds().includes(playerId);
  }

  pendingCountsLabel() {
    return this.t('live.pending.counts', {
      ins: this.pendingBenchPlayers().length,
      outs: this.pendingActivePlayers().length
    });
  }

  showSubstitutionBanner() {
    const totalSelections = this.pendingBenchPlayers().length + this.pendingActivePlayers().length;
    return totalSelections > 1 && !this.isInstantSubstitutionReady();
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

    return [
      ...[1, 2, 3].map((points) => ({
        value: points,
        label: `+${points}`,
        title: correctionMode
          ? this.t('live.actions.removePoints', { count: points })
          : this.t('live.actions.addPoints', { count: points }),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, points)),
        row: 'primary' as const
      })),
      {
        value: 'assists' as const,
        label: this.t('live.stats.assists.short'),
        title: correctionMode ? this.t('live.actions.removeAssist') : this.t('live.actions.addAssist'),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, 'assists')),
        row: 'secondary' as const
      },
      {
        value: 'blocks' as const,
        label: this.t('live.stats.blocks.short'),
        title: correctionMode ? this.t('live.actions.removeBlock') : this.t('live.actions.addBlock'),
        disabled: disabled || (correctionMode && !this.canReverseAction(player, 'blocks')),
        row: 'secondary' as const
      },
      {
        value: 'rebounds' as const,
        label: this.t('live.stats.rebounds.short'),
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

  private async runAction(callback: () => Promise<unknown>) {
    try {
      await callback();
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  private isInstantSubstitutionReady() {
    return this.pendingBenchPlayers().length === 1 && this.pendingActivePlayers().length === 1;
  }

  private async applyInstantSubstitutionIfReady() {
    if (!this.isInstantSubstitutionReady()) {
      return;
    }

    await this.substituteBatch();
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

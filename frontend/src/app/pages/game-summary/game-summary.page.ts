import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import {
  GamePlayerState,
  GameSummary,
  RotationTimelineEvent,
  StarterBenchSplit,
  SummaryUsageInsight
} from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { GameService } from '../../services/game.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type SummarySortKey = 'name' | 'totalSeconds' | 'points' | 'assists' | 'blocks' | 'rebounds' | 'fouls';
type SortDirection = 'asc' | 'desc';

const SUMMARY_SORT_LABEL_KEYS: Record<SummarySortKey, TranslationKey> = {
  name: 'summary.table.player',
  totalSeconds: 'summary.table.minutes',
  points: 'summary.table.points',
  assists: 'summary.table.assists',
  blocks: 'summary.table.blocks',
  rebounds: 'summary.table.rebounds',
  fouls: 'summary.table.fouls'
};

@Component({
  selector: 'app-game-summary-page',
  standalone: true,
  imports: [CommonModule, DurationPipe, TranslatePipe],
  templateUrl: './game-summary.page.html',
  styleUrl: './game-summary.page.scss'
})
export class GameSummaryPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);
  private readonly durationPipe = new DurationPipe();

  readonly summary = signal<GameSummary | null>(null);
  readonly shareMessage = signal('');
  readonly timelineExpanded = signal(false);
  readonly sort = signal<{ key: SummarySortKey; direction: SortDirection }>({
    key: 'totalSeconds',
    direction: 'desc'
  });
  readonly sortedPlayers = computed(() => {
    const gameSummary = this.summary();

    if (!gameSummary) {
      return [];
    }

    const { key, direction } = this.sort();
    const directionFactor = direction === 'asc' ? 1 : -1;

    return [...gameSummary.players].sort(
      (left, right) => directionFactor * this.comparePlayers(left, right, key)
    );
  });
  readonly totals = computed(() => {
    const gameSummary = this.summary();

    if (!gameSummary) {
      return null;
    }

    return gameSummary.players.reduce(
      (totals, player) => ({
        points: totals.points + player.points,
        assists: totals.assists + player.assists,
        blocks: totals.blocks + player.blocks,
        rebounds: totals.rebounds + player.rebounds,
        fouls: totals.fouls + player.fouls
      }),
      {
        points: 0,
        assists: 0,
        blocks: 0,
        rebounds: 0,
        fouls: 0
      }
    );
  });
  readonly topMinutes = computed(() => this.summary()?.insights.topMinutes ?? []);
  readonly overusedPlayers = computed(() => this.summary()?.insights.overusedPlayers ?? []);
  readonly underusedPlayers = computed(() => this.summary()?.insights.underusedPlayers ?? []);
  readonly starterBenchSplit = computed<StarterBenchSplit | null>(() => this.summary()?.insights.starterBenchSplit ?? null);
  readonly rotationTimeline = computed(() => this.summary()?.rotationTimeline ?? []);
  readonly substitutionCount = computed(
    () => this.rotationTimeline().filter((event) => event.kind === 'SUBSTITUTION').length
  );
  readonly leader = computed<SummaryUsageInsight | null>(() => this.topMinutes()[0] ?? null);
  readonly errorMessage = signal('');
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  readonly summarySortKeys: SummarySortKey[] = ['totalSeconds', 'points', 'assists', 'rebounds', 'blocks', 'fouls', 'name'];
  readonly t = this.i18n.t;

  async ngOnInit() {
    try {
      this.summary.set(await this.gameService.getSummary(this.gameId));
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  playingMinutes(totalSeconds: number) {
    return String(Math.round(totalSeconds / 60));
  }

  formatDuration(totalSeconds: number, style: 'clock' | 'compact' = 'compact') {
    return this.durationPipe.transform(totalSeconds, style);
  }

  shareRatio(percent: number) {
    return `${Math.round(percent * 100)}%`;
  }

  rotationShareStyle(percent: number) {
    return `${Math.max(8, Math.round(percent * 100))}%`;
  }

  usageDelta(insight: SummaryUsageInsight) {
    const minutes = Math.round(Math.abs(insight.deltaSeconds) / 60);

    return this.t(
      insight.deltaSeconds >= 0 ? 'summary.insights.deltaHigh' : 'summary.insights.deltaLow',
      { count: minutes }
    );
  }

  insightExpectedLabel(insight: SummaryUsageInsight) {
    return this.t('summary.insights.expectedMinutes', {
      count: Math.round(insight.expectedSeconds / 60)
    });
  }

  toggleSort(key: SummarySortKey) {
    this.sort.update((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'desc' ? 'asc' : 'desc'
    }));
  }

  ariaSort(key: SummarySortKey) {
    const currentSort = this.sort();

    if (currentSort.key !== key) {
      return 'none';
    }

    return currentSort.direction === 'asc' ? 'ascending' : 'descending';
  }

  isSortedBy(key: SummarySortKey) {
    return this.sort().key === key;
  }

  sortButtonLabel(key: SummarySortKey) {
    const label = this.t(this.sortLabelKey(key), this.labelParams());
    const currentSort = this.sort();
    const shouldSortAscending = currentSort.key === key ? currentSort.direction === 'desc' : false;

    return this.t(
      shouldSortAscending ? 'summary.table.sortAscending' : 'summary.table.sortDescending',
      { label }
    );
  }

  labelParams() {
    return buildTeamLabelParams(this.summary()?.team.gender ?? 'MIXED');
  }

  summaryCardLabel(key: SummarySortKey) {
    return this.t(this.sortLabelKey(key), this.labelParams());
  }

  playerSummaryLabel(player: GamePlayerState) {
    return player.isStarter ? this.t('summary.notes.starter') : this.t('summary.notes.benchContributor');
  }

  timelineTitle(event: RotationTimelineEvent) {
    switch (event.kind) {
      case 'PERIOD_START':
        return this.t('summary.timeline.periodStart', { number: event.periodNumber });
      case 'PERIOD_END':
        return this.t('summary.timeline.periodEnd', { number: event.periodNumber });
      case 'GAME_END':
        return this.t('summary.timeline.gameEnd');
      default:
        return this.t('summary.timeline.substitution');
    }
  }

  timelineSecondary(event: RotationTimelineEvent) {
    if (event.kind === 'SUBSTITUTION') {
      const inLabel = event.playersIn.map((player) => `#${player.jerseyNumber}`).join(', ');
      const outLabel = event.playersOut.map((player) => `#${player.jerseyNumber}`).join(', ');

      return `${this.t('summary.timeline.checkIn')}: ${inLabel} · ${this.t('summary.timeline.checkOut')}: ${outLabel}`;
    }

    return `${this.t('summary.timeline.onCourt')}: ${event.onCourt.map((player) => `#${player.jerseyNumber}`).join(', ')}`;
  }

  toggleTimelineExpanded() {
    this.timelineExpanded.update((current) => !current);
  }

  timelineToggleLabelKey(): TranslationKey {
    return this.timelineExpanded() ? 'summary.timeline.hide' : 'summary.timeline.show';
  }

  async shareSummary() {
    const gameSummary = this.summary();
    const browserNavigator = typeof globalThis.navigator === 'undefined' ? null : globalThis.navigator;

    if (!gameSummary) {
      return;
    }

    const text = this.buildShareText(gameSummary);

    try {
      if (browserNavigator?.share) {
        await browserNavigator.share({
          title: gameSummary.label,
          text
        });
        this.shareMessage.set(this.t('summary.share.nativeSuccess'));
        return;
      }

      if (browserNavigator?.clipboard?.writeText) {
        await browserNavigator.clipboard.writeText(text);
        this.shareMessage.set(this.t('summary.share.copySuccess'));
        return;
      }

      this.shareMessage.set(this.t('summary.share.unavailable'));
    } catch {
      this.shareMessage.set(this.t('summary.share.unavailable'));
    }
  }

  private buildShareText(gameSummary: GameSummary) {
    const lines = [
      `${gameSummary.label} - ${this.t('summary.hero.eyebrow')}`,
      `${this.t('summary.stats.totalClock')}: ${this.formatDuration(gameSummary.totalGameSeconds, 'clock')}`
    ];

    const leader = gameSummary.insights.topMinutes[0];

    if (leader) {
      lines.push(`${this.t('summary.stats.leader')}: ${leader.name} (#${leader.jerseyNumber}) ${this.formatDuration(leader.totalSeconds)}`);
    }

    const split = gameSummary.insights.starterBenchSplit;
    lines.push(
      `${this.t('summary.stats.starterBenchSplit')}: ${this.t('summary.insights.starterShare')} ${this.shareRatio(split.starterShare)} / ${this.t('summary.insights.benchShare')} ${this.shareRatio(split.benchShare)}`
    );
    lines.push(`${this.t('summary.stats.teamFouls')}: ${gameSummary.players.reduce((total, player) => total + player.fouls, 0)}`);

    if (gameSummary.insights.overusedPlayers.length) {
      lines.push(this.t('summary.insights.overused'));
      lines.push(
        ...gameSummary.insights.overusedPlayers.map(
          (player) => `- ${player.name} (#${player.jerseyNumber}) ${this.usageDelta(player)}`
        )
      );
    }

    if (gameSummary.insights.underusedPlayers.length) {
      lines.push(this.t('summary.insights.underused'));
      lines.push(
        ...gameSummary.insights.underusedPlayers.map(
          (player) => `- ${player.name} (#${player.jerseyNumber}) ${this.usageDelta(player)}`
        )
      );
    }

    if (gameSummary.rotationTimeline.length) {
      lines.push(this.t('summary.timeline.title'));
      lines.push(
        ...gameSummary.rotationTimeline.map(
          (event) => `- ${this.timelineTitle(event)} ${this.formatDuration(event.clockMarkSeconds, 'clock')} · ${this.timelineSecondary(event)}`
        )
      );
    }

    return lines.join('\n');
  }

  private comparePlayers(left: GamePlayerState, right: GamePlayerState, key: SummarySortKey) {
    if (key === 'name') {
      return this.compareNames(left, right);
    }

    const difference = left[key] - right[key];

    if (difference !== 0) {
      return difference;
    }

    return this.compareNames(left, right);
  }

  private compareNames(left: GamePlayerState, right: GamePlayerState) {
    return left.name.localeCompare(right.name, this.i18n.locale(), { sensitivity: 'base' });
  }

  private sortLabelKey(key: SummarySortKey) {
    return SUMMARY_SORT_LABEL_KEYS[key];
  }
}

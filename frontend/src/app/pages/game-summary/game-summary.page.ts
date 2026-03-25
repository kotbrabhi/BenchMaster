import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GamePlayerState, GameSummary } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { GameService } from '../../services/game.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type SummarySortKey = 'name' | 'totalSeconds' | 'points' | 'assists' | 'blocks' | 'rebounds';
type SortDirection = 'asc' | 'desc';

const SUMMARY_SORT_LABEL_KEYS: Record<SummarySortKey, TranslationKey> = {
  name: 'summary.table.player',
  totalSeconds: 'summary.table.minutes',
  points: 'summary.table.points',
  assists: 'summary.table.assists',
  blocks: 'summary.table.blocks',
  rebounds: 'summary.table.rebounds'
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

  readonly summary = signal<GameSummary | null>(null);
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
        rebounds: totals.rebounds + player.rebounds
      }),
      {
        points: 0,
        assists: 0,
        blocks: 0,
        rebounds: 0
      }
    );
  });
  readonly errorMessage = signal('');
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  readonly summarySortKeys: SummarySortKey[] = ['totalSeconds', 'points', 'assists', 'rebounds', 'blocks', 'name'];
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

  labelParams() {
    return buildTeamLabelParams(this.summary()?.team.gender ?? 'MIXED');
  }

  summaryCardLabel(key: SummarySortKey) {
    return this.t(this.sortLabelKey(key), this.labelParams());
  }

  playerSummaryLabel(player: GamePlayerState) {
    return player.isStarter ? this.t('summary.notes.starter') : this.t('summary.notes.benchContributor');
  }

  private sortLabelKey(key: SummarySortKey) {
    return SUMMARY_SORT_LABEL_KEYS[key];
  }
}

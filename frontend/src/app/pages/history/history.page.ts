import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameListItem } from '../../core/models';
import { AppModeService } from '../../core/app-mode.service';
import { GameService } from '../../services/game.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type HistoryFilter = 'ALL' | 'GAME' | 'TRAINING';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss'
})
export class HistoryPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly appModeService = inject(AppModeService);
  private readonly gameService = inject(GameService);
  readonly games = this.gameService.games;
  readonly errorMessage = signal('');
  searchQuery = '';
  filter: HistoryFilter = 'ALL';

  async ngOnInit() {
    try {
      await this.gameService.loadGames();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error, this.i18n.t));
    }
  }

  filteredSessions(): GameListItem[] {
    const query = this.searchQuery.trim().toLocaleLowerCase(this.i18n.locale());
    return [...this.games()]
      .filter((game) => this.filter === 'ALL' || game.sessionType === this.filter)
      .filter((game) => !query || `${game.label} ${game.teamName}`.toLocaleLowerCase(this.i18n.locale()).includes(query))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  gameLink(game: GameListItem) {
    return game.status === 'FINISHED' ? ['/games', game.id, 'summary'] : ['/games', game.id, 'live'];
  }

  statusLabel(status: GameListItem['status']) {
    return {
      DRAFT: this.i18n.t('home.games.status.draft'),
      LIVE: this.i18n.t('home.games.status.live'),
      PAUSED: this.i18n.t('home.games.status.paused'),
      FINISHED: this.i18n.t('home.games.status.finished')
    }[status];
  }

  formattedDate(value: string) {
    const locale = this.i18n.locale() === 'fr' ? 'fr-FR' : 'en-GB';
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }
}

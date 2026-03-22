import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameListItem, Team } from '../../core/models';
import { GameService } from '../../services/game.service';
import { TeamService } from '../../services/team.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly teamService = inject(TeamService);
  private readonly gameService = inject(GameService);

  readonly teams = this.teamService.teams;
  readonly games = this.gameService.games;
  readonly errorMessage = signal('');
  readonly t = this.i18n.t;

  teamName = '';
  editingTeamId: number | null = null;

  async ngOnInit() {
    await this.refresh();
  }

  async submitTeam() {
    try {
      if (this.editingTeamId) {
        await this.teamService.updateTeam(this.editingTeamId, { name: this.teamName });
        this.resetTeamForm();
      } else {
        const createdTeam = await this.teamService.createTeam({ name: this.teamName });
        this.resetTeamForm();
        this.errorMessage.set('');
        await this.router.navigate(['/teams', createdTeam.id]);
        return;
      }

      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  editTeam(team: Team) {
    this.editingTeamId = team.id;
    this.teamName = team.name;
  }

  async deleteTeam(teamId: number) {
    const confirmed = window.confirm(this.t('home.confirmDeleteTeam'));

    if (!confirmed) {
      return;
    }

    try {
      await this.teamService.deleteTeam(teamId);
      await this.gameService.loadGames();
      this.errorMessage.set('');
      this.resetTeamForm();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  resetTeamForm() {
    this.teamName = '';
    this.editingTeamId = null;
  }

  gameLink(game: GameListItem) {
    return game.status === 'FINISHED' ? ['/games', game.id, 'summary'] : ['/games', game.id, 'live'];
  }

  statusLabel(status: GameListItem['status']) {
    return {
      DRAFT: this.t('home.games.status.draft'),
      LIVE: this.t('home.games.status.live'),
      PAUSED: this.t('home.games.status.paused'),
      FINISHED: this.t('home.games.status.finished')
    }[status];
  }

  formattedGameDate(createdAt: string) {
    const locale = this.i18n.locale() === 'fr' ? 'fr-FR' : 'en-GB';

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(createdAt));
  }

  private async refresh() {
    try {
      await Promise.all([this.teamService.loadTeams(), this.gameService.loadGames()]);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }
}

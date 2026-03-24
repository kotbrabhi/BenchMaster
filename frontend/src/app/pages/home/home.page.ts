import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { AppModeService } from '../../core/app-mode.service';
import { I18nService } from '../../core/i18n.service';
import { GameListItem, Team, TeamGender } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
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
  private readonly appModeService = inject(AppModeService);
  private readonly teamService = inject(TeamService);
  private readonly gameService = inject(GameService);

  readonly appMode = this.appModeService.mode;
  readonly teams = this.teamService.teams;
  readonly games = this.gameService.games;
  readonly errorMessage = signal('');
  readonly isSubmittingTeam = signal(false);
  readonly t = this.i18n.t;
  readonly teamGenderOptions: Array<{ value: TeamGender; labelKey: TranslationKey }> = [
    { value: 'MIXED', labelKey: 'common.teamGender.mixed' },
    { value: 'FEMININE', labelKey: 'common.teamGender.feminine' },
    { value: 'MASCULINE', labelKey: 'common.teamGender.masculine' }
  ];

  teamName = '';
  teamGender: TeamGender = 'MIXED';
  teamPlayerNames = '';
  editingTeamId: number | null = null;

  async ngOnInit() {
    await this.refresh();
  }

  async submitTeam() {
    try {
      this.isSubmittingTeam.set(true);
      if (this.editingTeamId) {
        await this.teamService.updateTeam(this.editingTeamId, { name: this.teamName, gender: this.teamGender });
        this.resetTeamForm();
      } else {
        const createdTeam = await this.teamService.createTeam({
          name: this.teamName,
          gender: this.teamGender,
          players: this.parseSeedPlayers(this.teamPlayerNames)
        });
        this.resetTeamForm();
        this.errorMessage.set('');
        await this.router.navigate(['/teams', createdTeam.id]);
        return;
      }

      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.isSubmittingTeam.set(false);
    }
  }

  editTeam(team: Team) {
    this.editingTeamId = team.id;
    this.teamName = team.name;
    this.teamGender = team.gender;
    this.teamPlayerNames = '';
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
    this.teamGender = 'MIXED';
    this.teamPlayerNames = '';
    this.editingTeamId = null;
  }

  showGuestTeamLimitHint() {
    return this.appMode() === 'guest' && this.teams().length > 0 && !this.editingTeamId;
  }

  shouldShowTeamEditor() {
    return this.appMode() !== 'guest' || !this.teams().length || this.editingTeamId !== null;
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

  canSubmitTeam() {
    return this.teamName.trim().length > 0;
  }

  teamFormDisabledReason() {
    return this.canSubmitTeam() ? '' : this.t('common.reasons.teamNameRequired');
  }

  teamLabelParams(teamGender: TeamGender = this.teamGender) {
    return buildTeamLabelParams(teamGender);
  }

  teamCountParams(team: Team) {
    return {
      count: team.playerCount,
      ...this.teamLabelParams(team.gender)
    };
  }

  private async refresh() {
    try {
      await Promise.all([this.teamService.loadTeams(), this.gameService.loadGames()]);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  private parseSeedPlayers(value: string) {
    const usedJerseyNumbers = new Set<string>();
    let nextGeneratedJerseyNumber = 1;

    return value
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .flatMap((entry) => {
        const parsedEntry = this.parseSeedPlayerEntry(entry);
        const explicitJerseyNumber = parsedEntry.jerseyNumber?.trim() || null;

        if (explicitJerseyNumber) {
          if (usedJerseyNumbers.has(explicitJerseyNumber)) {
            return [];
          }

          usedJerseyNumbers.add(explicitJerseyNumber);

          return {
            name: parsedEntry.name,
            jerseyNumber: explicitJerseyNumber
          };
        }

        while (usedJerseyNumbers.has(String(nextGeneratedJerseyNumber))) {
          nextGeneratedJerseyNumber += 1;
        }

        const jerseyNumber = String(nextGeneratedJerseyNumber);
        usedJerseyNumbers.add(jerseyNumber);
        nextGeneratedJerseyNumber += 1;

        return {
          name: parsedEntry.name,
          jerseyNumber
        };
      });
  }

  private parseSeedPlayerEntry(entry: string) {
    const explicitNumberPatterns: Array<{ regex: RegExp; nameIndex: number; jerseyIndex: number }> = [
      {
        regex: /^\s*(\d+)\s*(?:->|[-:|/=])\s*(.+?)\s*$/i,
        nameIndex: 2,
        jerseyIndex: 1
      },
      {
        regex: /^\s*(\d+)\s+(.+?)\s*$/i,
        nameIndex: 2,
        jerseyIndex: 1
      },
      {
        regex: /^\s*(.+?)\s*(?:->|[-:|/=])\s*(?:jersey\s*)?#?\s*(\d+)\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      },
      {
        regex: /^\s*(.+?)\s*(?:->|[-:|/=])\s*(?:n[°ºo]\.?|no\.?|num(?:e|é)ro|jersey)\s*#?\s*(\d+)\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      },
      {
        regex: /^\s*(.+?)\s*[\[({]\s*(?:jersey\s*)?#?\s*(\d+)\s*[\])}]\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      },
      {
        regex: /^\s*(.+?)\s+(?:n[°ºo]\.?|no\.?|num(?:e|é)ro|jersey)\s*#?\s*(\d+)\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      },
      {
        regex: /^\s*(.+?)\s+#\s*(\d+)\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      },
      {
        regex: /^\s*(.+?)\s+(\d+)\s*$/i,
        nameIndex: 1,
        jerseyIndex: 2
      }
    ];

    for (const pattern of explicitNumberPatterns) {
      const match = entry.match(pattern.regex);

      if (match) {
        return {
          name: this.cleanParsedPlayerName(match[pattern.nameIndex]),
          jerseyNumber: match[pattern.jerseyIndex]
        };
      }
    }

    return {
      name: entry,
      jerseyNumber: null
    };
  }

  private cleanParsedPlayerName(value: string) {
    return value.trim().replace(/\s*(?:->|[-:|/=])\s*$/g, '').trim();
  }
}

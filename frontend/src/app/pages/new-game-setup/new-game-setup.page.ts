import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { AppModeService } from '../../core/app-mode.service';
import { I18nService } from '../../core/i18n.service';
import { Player } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { GameService } from '../../services/game.service';
import { PlayerService } from '../../services/player.service';
import { TeamService } from '../../services/team.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-new-game-setup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './new-game-setup.page.html',
  styleUrl: './new-game-setup.page.scss'
})
export class NewGameSetupPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appModeService = inject(AppModeService);
  private readonly teamService = inject(TeamService);
  private readonly playerService = inject(PlayerService);
  private readonly gameService = inject(GameService);

  readonly games = this.gameService.games;
  readonly teams = this.teamService.teams;
  readonly roster = this.playerService.roster;
  readonly errorMessage = signal('');
  readonly isCreatingGame = signal(false);
  readonly selectedTeamId = signal<number | null>(null);
  readonly selectedTeam = computed(() => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null);
  readonly availablePlayerIds = signal<number[]>([]);
  readonly starterPlayerIds = signal<number[]>([]);
  readonly invalidStarterPlayerId = signal<number | null>(null);
  readonly t = this.i18n.t;
  readonly labelParams = computed(() => buildTeamLabelParams(this.selectedTeam()?.gender ?? 'MIXED'));
  readonly sortedRoster = computed(() =>
    [...this.roster()].sort((left, right) => this.playerSortRank(left.id) - this.playerSortRank(right.id))
  );

  gameLabel = '';

  async ngOnInit() {
    try {
      const [teams] = await Promise.all([this.teamService.loadTeams(), this.gameService.loadGames()]);
      const preselectedTeamId = Number(this.route.snapshot.queryParamMap.get('teamId'));
      const firstTeamId = teams[0]?.id ?? null;

      if (preselectedTeamId || firstTeamId) {
        await this.selectTeam(preselectedTeamId || firstTeamId);
      }
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  async selectTeam(teamId: number | null) {
    if (!teamId) {
      return;
    }

    try {
      this.selectedTeamId.set(teamId);
      const players = await this.playerService.loadPlayers(teamId);
      const playerIds = players.map((player) => player.id);
      this.availablePlayerIds.set(playerIds);
      this.starterPlayerIds.set(playerIds.slice(0, 5));
      this.invalidStarterPlayerId.set(null);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  toggleAvailability(playerId: number) {
    this.availablePlayerIds.update((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );

    this.starterPlayerIds.update((current) => current.filter((id) => this.availablePlayerIds().includes(id)));
    this.clearInvalidStarterAttempt(playerId);
  }

  toggleStarter(playerId: number) {
    if (!this.availablePlayerIds().includes(playerId)) {
      return;
    }

    if (this.starterPlayerIds().includes(playerId)) {
      this.starterPlayerIds.update((current) => current.filter((id) => id !== playerId));
      this.clearInvalidStarterAttempt();
      return;
    }

    if (this.starterPlayerIds().length >= 5) {
      this.invalidStarterPlayerId.set(playerId);
      this.errorMessage.set(this.t('newGame.error.chooseFiveStarters'));
      return;
    }

    this.starterPlayerIds.update((current) => [...current, playerId]);
    this.clearInvalidStarterAttempt();
    this.errorMessage.set('');
  }

  async createGame() {
    const teamId = this.selectedTeamId();

    if (!teamId) {
      return;
    }

    try {
      this.isCreatingGame.set(true);
      if (this.appModeService.isGuestMode() && this.games().length) {
        const confirmed = window.confirm(this.t('newGame.confirmReplaceGuestGame'));

        if (!confirmed) {
          return;
        }
      }

      const game = await this.gameService.createGame({
        teamId,
        label: this.gameLabel,
        availablePlayerIds: this.availablePlayerIds(),
        starterPlayerIds: this.starterPlayerIds()
      });

      await this.gameService.loadGames();
      this.router.navigate(['/games', game.id, 'live']);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.isCreatingGame.set(false);
    }
  }

  isAvailable(player: Player) {
    return this.availablePlayerIds().includes(player.id);
  }

  isStarter(player: Player) {
    return this.starterPlayerIds().includes(player.id);
  }

  hasStarterSelectionError(player: Player) {
    return this.invalidStarterPlayerId() === player.id;
  }

  private playerSortRank(playerId: number) {
    if (this.starterPlayerIds().includes(playerId)) {
      return 0;
    }

    if (this.availablePlayerIds().includes(playerId)) {
      return 1;
    }

    return 2;
  }

  canCreateGame() {
    return !!this.selectedTeamId() && this.availablePlayerIds().length >= 5 && this.starterPlayerIds().length === 5;
  }

  createGameDisabledReason() {
    if (!this.selectedTeamId()) {
      return this.t('newGame.available.reason.selectTeam');
    }

    if (this.availablePlayerIds().length < 5) {
      return this.t('newGame.available.reason.needAvailablePlayers', this.labelParams());
    }

    if (this.starterPlayerIds().length !== 5) {
      return this.t('newGame.startingFive.reason.needFive');
    }

    return '';
  }

  trackByPlayer(_index: number, player: Player) {
    return player.id;
  }

  availableSummaryParams() {
    return {
      availableCount: this.availablePlayerIds().length,
      starterCount: this.starterPlayerIds().length,
      ...this.labelParams()
    };
  }

  private clearInvalidStarterAttempt(playerId?: number) {
    if (playerId === undefined || this.invalidStarterPlayerId() === playerId) {
      this.invalidStarterPlayerId.set(null);
    }
  }
}

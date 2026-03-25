import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { AppModeService } from '../../core/app-mode.service';
import { I18nService } from '../../core/i18n.service';
import { Player } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { GameService } from '../../services/game.service';
import { PlayerService } from '../../services/player.service';
import { TeamService } from '../../services/team.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface RosterGroup {
  key: 'starters' | 'available' | 'unselected';
  titleKey: TranslationKey;
  emptyKey: TranslationKey;
  players: Player[];
}

interface SetupStep {
  key: 'team' | 'available' | 'starters';
  number: 1 | 2 | 3;
  titleKey: TranslationKey;
  isComplete: boolean;
}

@Component({
  selector: 'app-new-game-setup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ConfirmationDialogComponent],
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
  readonly showGuestReplacementDialog = signal(false);
  readonly selectedTeamId = signal<number | null>(null);
  readonly selectedTeam = computed(() => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null);
  readonly availablePlayerIds = signal<number[]>([]);
  readonly starterPlayerIds = signal<number[]>([]);
  readonly invalidStarterPlayerId = signal<number | null>(null);
  readonly playerInlineError = signal<{ playerId: number; message: string } | null>(null);
  readonly t = this.i18n.t;
  readonly labelParams = computed(() => buildTeamLabelParams(this.selectedTeam()?.gender ?? 'MIXED'));
  readonly sortedRoster = computed(() =>
    [...this.roster()].sort((left, right) => this.playerSortRank(left.id) - this.playerSortRank(right.id))
  );
  readonly starterPlayers = computed(() => this.sortedRoster().filter((player) => this.isStarter(player)));
  readonly availableBenchPlayers = computed(() =>
    this.sortedRoster().filter((player) => this.isAvailable(player) && !this.isStarter(player))
  );
  readonly unselectedPlayers = computed(() => this.sortedRoster().filter((player) => !this.isAvailable(player)));
  readonly rosterGroups = computed<RosterGroup[]>(() => [
    {
      key: 'starters',
      titleKey: 'newGame.group.starters.title',
      emptyKey: 'newGame.group.starters.empty',
      players: this.starterPlayers()
    },
    {
      key: 'available',
      titleKey: 'newGame.group.available.title',
      emptyKey: 'newGame.group.available.empty',
      players: this.availableBenchPlayers()
    },
    {
      key: 'unselected',
      titleKey: 'newGame.group.unselected.title',
      emptyKey: 'newGame.group.unselected.empty',
      players: this.unselectedPlayers()
    }
  ]);
  readonly completedStepCount = computed(() => {
    let completed = 0;

    if (this.selectedTeamId()) {
      completed += 1;
    }

    if (this.availablePlayerIds().length >= 5) {
      completed += 1;
    }

    if (this.starterPlayerIds().length === 5) {
      completed += 1;
    }

    return completed;
  });
  readonly setupProgressPercent = computed(() => (this.completedStepCount() / 3) * 100);
  readonly setupSteps = computed<SetupStep[]>(() => [
    {
      key: 'team',
      number: 1,
      titleKey: 'newGame.chooseTeam.title',
      isComplete: !!this.selectedTeamId()
    },
    {
      key: 'available',
      number: 2,
      titleKey: 'newGame.progress.step.available.title',
      isComplete: this.availablePlayerIds().length >= 5
    },
    {
      key: 'starters',
      number: 3,
      titleKey: 'newGame.progress.step.starters.title',
      isComplete: this.starterPlayerIds().length === 5
    }
  ]);

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
      this.playerInlineError.set(null);
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  toggleAvailability(playerId: number) {
    const currentAvailableIds = this.availablePlayerIds();
    const nextAvailableIds = currentAvailableIds.includes(playerId)
      ? currentAvailableIds.filter((id) => id !== playerId)
      : [...currentAvailableIds, playerId];

    this.availablePlayerIds.set(nextAvailableIds);
    this.starterPlayerIds.update((current) => current.filter((id) => nextAvailableIds.includes(id)));
    this.clearInvalidStarterAttempt(playerId);
    this.clearPlayerInlineError(playerId);
    this.errorMessage.set('');
  }

  toggleStarter(playerId: number) {
    if (!this.availablePlayerIds().includes(playerId)) {
      this.setPlayerInlineError(playerId, this.t('newGame.startingFive.reason.needAvailability'));
      return;
    }

    if (this.starterPlayerIds().includes(playerId)) {
      this.starterPlayerIds.update((current) => current.filter((id) => id !== playerId));
      this.clearInvalidStarterAttempt();
      this.clearPlayerInlineError(playerId);
      this.errorMessage.set('');
      return;
    }

    if (this.starterPlayerIds().length >= 5) {
      this.invalidStarterPlayerId.set(playerId);
      this.setPlayerInlineError(playerId, this.t('newGame.error.chooseFiveStarters'));
      return;
    }

    this.starterPlayerIds.update((current) => [...current, playerId]);
    this.clearInvalidStarterAttempt();
    this.clearPlayerInlineError(playerId);
    this.errorMessage.set('');
  }

  async createGame() {
    await this.finalizeGameCreation(false);
  }

  closeGuestReplacementDialog() {
    if (!this.isCreatingGame()) {
      this.showGuestReplacementDialog.set(false);
    }
  }

  guestReplacementDialogTitle() {
    return this.t('newGame.confirmReplaceGuestGame.title');
  }

  guestReplacementDialogMessage() {
    return this.t('newGame.confirmReplaceGuestGame.message');
  }

  guestReplacementDialogDetails() {
    return this.t('newGame.confirmReplaceGuestGame.details');
  }

  guestReplacementDialogConfirmLabel() {
    return this.t('newGame.confirmReplaceGuestGame.confirmAction');
  }

  async confirmGuestReplacement() {
    this.showGuestReplacementDialog.set(false);
    await this.finalizeGameCreation(true);
  }

  private async finalizeGameCreation(forceGuestReplacement: boolean) {
    const teamId = this.selectedTeamId();

    if (!teamId) {
      return;
    }

    try {
      this.isCreatingGame.set(true);
      if (this.appModeService.isGuestMode() && this.games().length && !forceGuestReplacement) {
        this.showGuestReplacementDialog.set(true);
        return;
      }

      const game = await this.gameService.createGame({
        teamId,
        label: this.gameLabel,
        availablePlayerIds: this.availablePlayerIds(),
        starterPlayerIds: this.starterPlayerIds()
      });

      if (!game) {
        throw new Error(this.t('error.generic'));
      }

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

  hasInlinePlayerError(player: Player) {
    return this.playerInlineError()?.playerId === player.id;
  }

  inlinePlayerErrorMessage(player: Player) {
    return this.hasInlinePlayerError(player) ? this.playerInlineError()?.message ?? '' : '';
  }

  playerCardHasError(player: Player) {
    return this.hasStarterSelectionError(player) || this.hasInlinePlayerError(player);
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

  availableStepMessage() {
    if (!this.selectedTeamId()) {
      return this.t('newGame.available.reason.selectTeam');
    }

    if (this.availablePlayerIds().length < 5) {
      return this.t('newGame.available.reason.needAvailablePlayers', this.labelParams());
    }

    return this.t('newGame.progress.step.available.ready');
  }

  starterStepMessage() {
    if (!this.selectedTeamId()) {
      return this.t('newGame.available.reason.selectTeam');
    }

    if (this.starterPlayerIds().length !== 5) {
      return this.t('newGame.startingFive.reason.needFive');
    }

    return this.t('newGame.progress.step.starters.ready');
  }

  footerStatusMessage() {
    return this.canCreateGame() ? this.t('newGame.footer.ready') : this.createGameDisabledReason();
  }

  trackByRosterGroup(_index: number, group: RosterGroup) {
    return group.key;
  }

  private clearInvalidStarterAttempt(playerId?: number) {
    if (playerId === undefined || this.invalidStarterPlayerId() === playerId) {
      this.invalidStarterPlayerId.set(null);
    }
  }

  private setPlayerInlineError(playerId: number, message: string) {
    this.playerInlineError.set({ playerId, message });
  }

  private clearPlayerInlineError(playerId?: number) {
    if (playerId === undefined || this.playerInlineError()?.playerId === playerId) {
      this.playerInlineError.set(null);
    }
  }
}

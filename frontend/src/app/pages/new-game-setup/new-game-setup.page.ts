import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { Player } from '../../core/models';
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
  private readonly teamService = inject(TeamService);
  private readonly playerService = inject(PlayerService);
  private readonly gameService = inject(GameService);

  readonly teams = this.teamService.teams;
  readonly roster = this.playerService.roster;
  readonly errorMessage = signal('');
  readonly selectedTeamId = signal<number | null>(null);
  readonly availablePlayerIds = signal<number[]>([]);
  readonly starterPlayerIds = signal<number[]>([]);
  readonly t = this.i18n.t;

  readonly availablePlayers = computed(() =>
    this.roster().filter((player) => this.availablePlayerIds().includes(player.id))
  );

  gameLabel = '';

  async ngOnInit() {
    try {
      const teams = await this.teamService.loadTeams();
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
  }

  toggleStarter(playerId: number) {
    if (!this.availablePlayerIds().includes(playerId)) {
      return;
    }

    if (this.starterPlayerIds().includes(playerId)) {
      this.starterPlayerIds.update((current) => current.filter((id) => id !== playerId));
      return;
    }

    if (this.starterPlayerIds().length >= 5) {
      this.errorMessage.set(this.t('newGame.error.chooseFiveStarters'));
      return;
    }

    this.starterPlayerIds.update((current) => [...current, playerId]);
    this.errorMessage.set('');
  }

  async createGame() {
    const teamId = this.selectedTeamId();

    if (!teamId) {
      return;
    }

    try {
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
    }
  }

  isAvailable(player: Player) {
    return this.availablePlayerIds().includes(player.id);
  }

  isStarter(player: Player) {
    return this.starterPlayerIds().includes(player.id);
  }

  canCreateGame() {
    return !!this.selectedTeamId() && this.availablePlayerIds().length >= 5 && this.starterPlayerIds().length === 5;
  }

  trackByPlayer(_index: number, player: Player) {
    return player.id;
  }
}

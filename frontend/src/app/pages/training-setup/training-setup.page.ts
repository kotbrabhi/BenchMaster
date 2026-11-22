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
  selector: 'app-training-setup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './training-setup.page.html',
  styleUrl: './training-setup.page.scss'
})
export class TrainingSetupPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly teamsService = inject(TeamService);
  private readonly playersService = inject(PlayerService);
  private readonly gamesService = inject(GameService);
  readonly teams = this.teamsService.teams;
  readonly players = this.playersService.roster;
  readonly selectedTeamId = signal<number | null>(null);
  readonly selectedPlayerIds = signal<number[]>([]);
  readonly defaultName = signal('');
  readonly name = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly t = this.i18n.t;
  readonly selectedCount = computed(() => this.selectedPlayerIds().length);

  async ngOnInit() {
    await this.teamsService.loadTeams();
    const requestedTeam = Number(this.route.snapshot.queryParamMap.get('teamId'));
    this.selectedTeamId.set(this.teams().some((team) => team.id === requestedTeam) ? requestedTeam : this.teams()[0]?.id ?? null);
    this.defaultName.set(`${this.t('training.defaultName')} — ${new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}`);
    await this.loadRoster();
  }

  async changeTeam(teamId: number) {
    this.selectedTeamId.set(teamId);
    await this.loadRoster();
  }

  togglePlayer(player: Player) {
    this.selectedPlayerIds.update((ids) => ids.includes(player.id) ? ids.filter((id) => id !== player.id) : [...ids, player.id]);
  }

  isSelected(playerId: number) { return this.selectedPlayerIds().includes(playerId); }

  async create() {
    if (!this.selectedTeamId() || !this.selectedCount()) {
      this.error.set(this.t('training.setup.empty'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const game = await this.gamesService.createGame({
        teamId: this.selectedTeamId()!,
        label: this.name().trim() || this.defaultName(),
        availablePlayerIds: this.selectedPlayerIds(),
        starterPlayerIds: [],
        sessionType: 'TRAINING'
      });
      await this.router.navigate(['/games', game.id, 'live']);
    } catch (error) {
      this.error.set(getErrorMessage(error, this.t));
    } finally {
      this.busy.set(false);
    }
  }

  private async loadRoster() {
    const teamId = this.selectedTeamId();
    if (!teamId) { this.selectedPlayerIds.set([]); return; }
    await this.playersService.loadPlayers(teamId);
    this.selectedPlayerIds.set(this.players().map((player) => player.id));
  }

}

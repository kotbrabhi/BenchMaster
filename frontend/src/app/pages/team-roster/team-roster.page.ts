import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { Team, TeamGender } from '../../core/models';
import { buildTeamLabelParams } from '../../core/team-labels';
import { TranslationKey } from '../../core/translations';
import { PlayerService } from '../../services/player.service';
import { TeamService } from '../../services/team.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface PositionOption {
  value: string;
  labelKey?: TranslationKey;
  label?: string;
}

interface PendingPlayerDeletion {
  playerId: number;
  title: string;
  message: string;
  details: string;
}

@Component({
  selector: 'app-team-roster-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ConfirmationDialogComponent],
  templateUrl: './team-roster.page.html',
  styleUrl: './team-roster.page.scss'
})
export class TeamRosterPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly teamService = inject(TeamService);
  private readonly playerService = inject(PlayerService);

  readonly roster = this.playerService.roster;
  readonly errorMessage = signal('');
  readonly loadError = signal(false);
  readonly displayErrorMessage = computed(() =>
    this.loadError() ? this.t('teamRoster.errors.loadFailed') : this.errorMessage()
  );
  readonly isSavingTeamName = signal(false);
  readonly isAddingPlayer = signal(false);
  readonly isSavingEditedPlayer = signal(false);
  readonly deletingPlayerId = signal<number | null>(null);
  readonly pendingPlayerDeletion = signal<PendingPlayerDeletion | null>(null);
  readonly t = this.i18n.t;
  readonly teamGenderOptions: Array<{ value: TeamGender; labelKey: TranslationKey }> = [
    { value: 'MIXED', labelKey: 'common.teamGender.mixed' },
    { value: 'FEMININE', labelKey: 'common.teamGender.feminine' },
    { value: 'MASCULINE', labelKey: 'common.teamGender.masculine' }
  ];
  readonly basePositionOptions: PositionOption[] = [
    { value: '', labelKey: 'common.position.none' },
    { value: 'PG', labelKey: 'common.position.pg' },
    { value: 'SG', labelKey: 'common.position.sg' },
    { value: 'SF', labelKey: 'common.position.sf' },
    { value: 'PF', labelKey: 'common.position.pf' },
    { value: 'C', labelKey: 'common.position.c' }
  ];

  readonly teamId = Number(this.route.snapshot.paramMap.get('teamId'));
  readonly team = computed(() => this.teamService.teams().find((team) => team.id === this.teamId) ?? null);

  teamName = '';
  teamGender: TeamGender = 'MIXED';
  editingTeamName = false;
  newPlayerName = '';
  newJerseyNumber = '';
  newPosition = '';
  lastSuggestedJerseyNumber = '';
  editingPlayerId: number | null = null;
  editingPlayerName = '';
  editingJerseyNumber = '';
  editingPosition = '';
  private editingPlayerSnapshot: { id: number; name: string; jerseyNumber: string; position: string | null } | null = null;
  private playerSaveInFlight = false;
  private cancelEditingRequested = false;

  async ngOnInit() {
    await this.refresh();
  }

  async saveTeam() {
    try {
      this.isSavingTeamName.set(true);
      await this.teamService.updateTeam(this.teamId, { name: this.teamName, gender: this.teamGender });
      this.editingTeamName = false;
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error, this.t));
    } finally {
      this.isSavingTeamName.set(false);
    }
  }

  startEditingTeamName() {
    this.teamName = this.team()?.name ?? this.teamName;
    this.teamGender = this.team()?.gender ?? 'MIXED';
    this.editingTeamName = true;
  }

  cancelEditingTeamName() {
    this.teamName = this.team()?.name ?? '';
    this.teamGender = this.team()?.gender ?? 'MIXED';
    this.editingTeamName = false;
  }

  async addPlayer() {
    const jerseyNumber = this.normalizeJerseyNumber(this.newJerseyNumber);

    if (!this.newPlayerName.trim() || jerseyNumber === null) {
      this.errorMessage.set(this.t('common.reasons.playerFormIncomplete'));
      return;
    }

    try {
      this.isAddingPlayer.set(true);
      await this.playerService.createPlayer(this.teamId, {
        name: this.newPlayerName,
        jerseyNumber,
        position: this.newPosition || null
      });
      this.resetNewPlayerForm();
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error, this.t));
    } finally {
      this.isAddingPlayer.set(false);
    }
  }

  editPlayer(player: { id: number; name: string; jerseyNumber: string; position: string | null }) {
    this.cancelEditingRequested = false;
    this.editingPlayerSnapshot = { ...player };
    this.editingPlayerId = player.id;
    this.editingPlayerName = player.name;
    this.editingJerseyNumber = player.jerseyNumber;
    this.editingPosition = player.position || '';
  }

  async saveEditedPlayer() {
    const jerseyNumber = this.normalizeJerseyNumber(this.editingJerseyNumber);

    if (!this.editingPlayerId || !this.editingPlayerName.trim() || jerseyNumber === null) {
      this.errorMessage.set(this.t('common.reasons.playerFormIncomplete'));
      return;
    }

    if (this.playerSaveInFlight) {
      return;
    }

    const playerId = this.editingPlayerId;
    const next = {
      name: this.editingPlayerName.trim(),
      jerseyNumber,
      position: this.editingPosition || null
    };
    const snapshot = this.editingPlayerSnapshot;
    if (snapshot && snapshot.name === next.name && snapshot.jerseyNumber === next.jerseyNumber && snapshot.position === next.position) {
      return;
    }

    try {
      this.playerSaveInFlight = true;
      this.isSavingEditedPlayer.set(true);
      await this.playerService.updatePlayer(this.teamId, playerId, next);
      if (this.editingPlayerId !== playerId) return;
      this.editingPlayerSnapshot = { id: playerId, ...next };
      this.syncSuggestedJerseyNumber();
      this.errorMessage.set('');
      this.resetEditingPlayer();
    } catch (error) {
      const message = getErrorMessage(error, this.t);
      this.errorMessage.set(message);
      if (message === this.t('error.jerseyAlreadyUsed')) {
        this.editingJerseyNumber = this.editingPlayerSnapshot?.jerseyNumber ?? this.editingJerseyNumber;
      }
    } finally {
      this.playerSaveInFlight = false;
      this.isSavingEditedPlayer.set(false);
      if (this.cancelEditingRequested) {
        this.cancelEditingRequested = false;
        this.resetEditingPlayer();
      }
    }
  }

  async saveEditedPlayerIfValid() {
    if (!this.editingPlayerId || this.cancelEditingRequested || !this.canSaveEditedPlayer()) {
      return;
    }
    await this.saveEditedPlayer();
  }

  async saveEditedPlayerOnPositionChange() {
    if (this.editingPlayerId && this.canSaveEditedPlayer()) {
      await this.saveEditedPlayer();
    }
  }

  requestDeletePlayer(player: { id: number; name: string; jerseyNumber: string }) {
    this.pendingPlayerDeletion.set({
      playerId: player.id,
      title: this.t('teamRoster.confirmDeletePlayer.title', {
        playerName: player.name,
        jerseyNumber: player.jerseyNumber
      }),
      message: this.t('teamRoster.confirmDeletePlayer.message', this.labelParams()),
      details: this.t('teamRoster.confirmDeletePlayer.details', this.labelParams())
    });
  }

  closeDeletePlayerDialog() {
    if (!this.deletingPlayerId()) {
      this.pendingPlayerDeletion.set(null);
    }
  }

  async confirmDeletePlayer() {
    const deletion = this.pendingPlayerDeletion();

    if (!deletion) {
      return;
    }

    try {
      this.deletingPlayerId.set(deletion.playerId);
      await this.playerService.deletePlayer(this.teamId, deletion.playerId);
      if (this.editingPlayerId === deletion.playerId) {
        this.resetEditingPlayer();
      }
      this.syncSuggestedJerseyNumber();
      this.errorMessage.set('');
      this.pendingPlayerDeletion.set(null);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error, this.t));
    } finally {
      this.deletingPlayerId.set(null);
    }
  }

  resetNewPlayerForm() {
    this.newPlayerName = '';
    this.newPosition = '';
    this.newJerseyNumber = '';
    this.syncSuggestedJerseyNumber(true);
  }

  resetEditingPlayer() {
    if (this.playerSaveInFlight) {
      this.cancelEditingRequested = true;
      return;
    }
    this.cancelEditingRequested = false;
    this.editingPlayerSnapshot = null;
    this.editingPlayerId = null;
    this.editingPlayerName = '';
    this.editingJerseyNumber = '';
    this.editingPosition = '';
  }

  canAddPlayer() {
    return this.newPlayerName.trim().length > 0 && this.normalizeJerseyNumber(this.newJerseyNumber) !== null;
  }

  canSaveEditedPlayer() {
    return this.editingPlayerName.trim().length > 0 && this.normalizeJerseyNumber(this.editingJerseyNumber) !== null;
  }

  canSaveTeamName() {
    return this.teamName.trim().length > 0;
  }

  labelParams() {
    return buildTeamLabelParams(this.teamGender ?? this.team()?.gender ?? 'MIXED');
  }

  rosterSubtitleParams() {
    return {
      count: this.roster().length,
      ...this.labelParams()
    };
  }

  teamNameDisabledReason() {
    return this.canSaveTeamName() ? '' : this.t('common.reasons.teamNameRequired');
  }

  newPlayerDisabledReason() {
    return this.canAddPlayer() ? '' : this.t('common.reasons.playerFormIncomplete');
  }

  editedPlayerDisabledReason() {
    return this.canSaveEditedPlayer() ? '' : this.t('common.reasons.playerFormIncomplete');
  }

  isJerseyNumberDuplicate() {
    const jerseyNumber = this.editingJerseyNumber.trim();
    return Boolean(jerseyNumber && this.roster().some((player) => player.id !== this.editingPlayerId && player.jerseyNumber === jerseyNumber));
  }

  getPositionOptions(currentPosition?: string | null) {
    if (!currentPosition || this.basePositionOptions.some((option) => option.value === currentPosition)) {
      return this.basePositionOptions;
    }

    return [...this.basePositionOptions, { value: currentPosition, label: currentPosition }];
  }

  getPositionLabel(position?: string | null) {
    const option = this.basePositionOptions.find((entry) => entry.value === (position ?? ''));

    if (option?.labelKey) {
      return this.t(option.labelKey, this.labelParams());
    }

    return position || this.t('common.position.flexibleRole');
  }

  private normalizeJerseyNumber(value: string) {
    const jerseyNumber = value.trim();

    if (!jerseyNumber) {
      return null;
    }

    return /^\d+$/.test(jerseyNumber) ? jerseyNumber : null;
  }

  private async refresh() {
    try {
      const teams = await this.teamService.loadTeams();
      await this.playerService.loadPlayers(this.teamId);

      const team = teams.find((entry) => entry.id === this.teamId) as Team | undefined;
      this.teamName = team?.name ?? '';
      this.teamGender = team?.gender ?? 'MIXED';
      this.syncSuggestedJerseyNumber(true);
      this.loadError.set(false);
      this.errorMessage.set('');
    } catch {
      this.loadError.set(true);
    }
  }

  private syncSuggestedJerseyNumber(force = false) {
    const nextJerseyNumber = this.getNextSuggestedJerseyNumber();

    if (force || !this.newJerseyNumber.trim() || this.newJerseyNumber === this.lastSuggestedJerseyNumber) {
      this.newJerseyNumber = nextJerseyNumber;
    }

    this.lastSuggestedJerseyNumber = nextJerseyNumber;
  }

  private getNextSuggestedJerseyNumber() {
    const highestJerseyNumber = this.roster().reduce((highest, player) => {
      const currentNumber = Number.parseInt(player.jerseyNumber, 10);
      return Number.isNaN(currentNumber) ? highest : Math.max(highest, currentNumber);
    }, 0);

    return String(highestJerseyNumber + 1);
  }
}

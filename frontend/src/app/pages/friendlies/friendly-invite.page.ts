import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { getErrorMessage } from '../../core/api';
import { FriendlyAvailability, PublicFriendlyInvite } from '../../core/models';
import { TranslationKey } from '../../core/translations';
import { I18nService } from '../../core/i18n.service';
import { FriendlyMatchService } from '../../services/friendly-match.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-friendly-invite-page',
  imports: [CommonModule, DatePipe, FormsModule, TranslatePipe],
  templateUrl: './friendly-invite.page.html',
  styleUrl: './friendly-invite.page.scss'
})
export class FriendlyInvitePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FriendlyMatchService);
  private readonly i18n = inject(I18nService);

  readonly invite = signal<PublicFriendlyInvite | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  playerName = '';
  private revision?: number;

  private token = '';

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    try {
      this.invite.set(await this.service.getPublicInvite(this.token));
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.loading.set(false);
    }
  }

  async respond(availability: FriendlyAvailability) {
    const invite = this.invite();
    if (!invite || this.saving() || !this.playerName.trim()) return;
    this.error.set('');
    this.saved.set(false);
    this.saving.set(true);
    try {
      const response = await this.service.setAvailability(this.token, this.playerName, availability, this.revision);
      this.revision = response.revision;
      this.saved.set(true);
    } catch (error) {
      this.error.set(getErrorMessage(error, (key, params) => this.i18n.t(key, params)));
    } finally {
      this.saving.set(false);
    }
  }

  availabilityLabel(value: FriendlyAvailability | null) {
    return (value ? `friendlies.availability.${value}` : 'friendlies.availability.NO_RESPONSE') as TranslationKey;
  }
}

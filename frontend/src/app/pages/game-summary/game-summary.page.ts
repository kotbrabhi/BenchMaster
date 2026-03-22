import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { GameSummary } from '../../core/models';
import { GameService } from '../../services/game.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-game-summary-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './game-summary.page.html',
  styleUrl: './game-summary.page.scss'
})
export class GameSummaryPageComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);

  readonly summary = signal<GameSummary | null>(null);
  readonly errorMessage = signal('');
  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
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

  // TODO(axis-2): Expand this summary with points, rebounds, efficiency, and per-minute comparisons once stat tracking ships.
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayerStatType } from '../../../core/models';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type PlayerCardQuickActionValue = number | PlayerStatType;
export interface PlayerCardQuickAction {
  value: PlayerCardQuickActionValue;
  label: string;
  title?: string;
  disabled?: boolean;
  row?: 'primary' | 'secondary';
}

@Component({
  selector: 'app-player-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './player-card.component.html',
  styleUrl: './player-card.component.scss'
})
export class PlayerCardComponent {
  @Input({ required: true }) playerName!: string;
  @Input({ required: true }) jerseyNumber!: string;
  @Input() position: string | null = null;
  @Input() note = '';
  @Input() timeLabel = '';
  @Input() actionLabel = '';
  @Input() quickActions: PlayerCardQuickAction[] = [];
  @Input() actionDisabled = false;
  @Input() selected = false;
  @Input() tone: 'active' | 'bench' | 'summary' = 'bench';
  @Input() progress = 0;
  @Input() compact = false;

  @Output() actionPressed = new EventEmitter<void>();
  @Output() quickActionPressed = new EventEmitter<PlayerCardQuickActionValue>();

  get primaryQuickActions() {
    return this.quickActions.filter((quickAction) => quickAction.row !== 'secondary');
  }

  get secondaryQuickActions() {
    return this.quickActions.filter((quickAction) => quickAction.row === 'secondary');
  }
}

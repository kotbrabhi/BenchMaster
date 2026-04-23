import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayerStatType } from '../../../core/models';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type PlayerCardQuickActionValue = number | PlayerStatType;
type PlayerCardQuickActionRow = 'primary' | 'secondary' | 'tertiary';

export interface PlayerCardQuickAction {
  value: PlayerCardQuickActionValue;
  label: string;
  title?: string;
  disabled?: boolean;
  row?: PlayerCardQuickActionRow;
}

export interface PlayerCardStat {
  label: string;
  value: string | number;
  highlighted?: boolean;
  clickable?: boolean;
  disabled?: boolean;
  title?: string;
  valueKey?: PlayerCardQuickActionValue;
  tone?: 'default' | 'danger';
}

export interface PlayerCardInlineStat {
  label: string;
  value: string | number;
  title?: string;
  disabled?: boolean;
  highlighted?: boolean;
  clickable?: boolean;
  tone?: 'default' | 'danger';
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
  @Input() stateLabel = '';
  @Input() actionLabel = '';
  @Input() stats: PlayerCardStat[] = [];
  @Input() inlineStat: PlayerCardInlineStat | null = null;
  @Input() quickActions: PlayerCardQuickAction[] = [];
  @Input() quickActionsTone: 'default' | 'danger' = 'default';
  @Input() actionDisabled = false;
  @Input() selected = false;
  @Input() tone: 'active' | 'bench' | 'summary' = 'bench';
  @Input() progress = 0;
  @Input() compact = false;

  @Output() actionPressed = new EventEmitter<void>();
  @Output() inlineStatPressed = new EventEmitter<void>();
  @Output() quickActionPressed = new EventEmitter<PlayerCardQuickActionValue>();
  @Output() statPressed = new EventEmitter<PlayerCardQuickActionValue>();

  get quickActionRows() {
    const orderedRows: PlayerCardQuickActionRow[] = ['primary', 'secondary', 'tertiary'];

    return orderedRows
      .map((row) => ({
        row,
        actions: this.quickActions.filter((quickAction) => (quickAction.row ?? 'primary') === row)
      }))
      .filter((entry) => entry.actions.length > 0);
  }

  handleActionClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionPressed.emit();
  }

  handleInlineStatClick(event: MouseEvent) {
    event.stopPropagation();

    if (!this.inlineStat?.clickable || this.inlineStat.disabled) {
      return;
    }

    this.inlineStatPressed.emit();
  }

  handleQuickActionClick(event: MouseEvent, value: PlayerCardQuickActionValue) {
    event.stopPropagation();
    this.quickActionPressed.emit(value);
  }

  handleStatClick(event: MouseEvent, stat: PlayerCardStat) {
    event.stopPropagation();

    if (!stat.clickable || stat.disabled || stat.valueKey == null) {
      return;
    }

    this.statPressed.emit(stat.valueKey);
  }
}

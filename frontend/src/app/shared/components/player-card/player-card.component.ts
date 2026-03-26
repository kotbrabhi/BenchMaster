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

export interface PlayerCardStat {
  label: string;
  value: string | number;
  highlighted?: boolean;
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
  @Input() quickActionsCollapsible = false;
  @Input() quickActionsExpanded = true;
  @Input() actionDisabled = false;
  @Input() selected = false;
  @Input() tone: 'active' | 'bench' | 'summary' = 'bench';
  @Input() progress = 0;
  @Input() compact = false;

  @Output() actionPressed = new EventEmitter<void>();
  @Output() inlineStatPressed = new EventEmitter<void>();
  @Output() quickActionPressed = new EventEmitter<PlayerCardQuickActionValue>();
  @Output() cardPressed = new EventEmitter<void>();

  get primaryQuickActions() {
    return this.quickActions.filter((quickAction) => quickAction.row !== 'secondary');
  }

  get secondaryQuickActions() {
    return this.quickActions.filter((quickAction) => quickAction.row === 'secondary');
  }

  handleCardPress(event: MouseEvent) {
    if (!this.quickActionsCollapsible || this.quickActions.length === 0) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest('button, a, input, select, textarea, label')) {
      return;
    }

    this.cardPressed.emit();
  }

  handleQuickActionClick(event: MouseEvent, value: PlayerCardQuickActionValue) {
    event.stopPropagation();
    this.quickActionPressed.emit(value);
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
}

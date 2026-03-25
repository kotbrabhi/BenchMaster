import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

let nextDialogId = 0;

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() details = '';
  @Input() eyebrow = '';
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() confirmBusy = false;
  @Input() tone: 'default' | 'danger' = 'default';

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly titleId = `confirmation-dialog-title-${nextDialogId++}`;

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.open && !this.confirmBusy) {
      this.cancelled.emit();
    }
  }
}

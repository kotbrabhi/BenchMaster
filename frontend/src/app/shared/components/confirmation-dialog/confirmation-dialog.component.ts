import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';

let nextDialogId = 0;

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly returnFocusElement = this.document.activeElement as HTMLElement | null;

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLDialogElement>;

  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() details = '';
  @Input() eyebrow = '';
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() confirmBusy = false;
  @Input() tone: 'default' | 'danger' = 'default';

  confirmPending = false;

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly titleId = `confirmation-dialog-title-${nextDialogId++}`;

  @ViewChild('cancelButton') private cancelButtonRef?: ElementRef<HTMLButtonElement>;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['confirmBusy'] && !this.confirmBusy) {
      this.confirmPending = false;
    }
  }

  ngAfterViewInit() {
    const dialog = this.dialogRef?.nativeElement;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
    const cancelButton = this.cancelButtonRef?.nativeElement;
    if (cancelButton && !cancelButton.disabled) {
      cancelButton.focus();
    } else {
      dialog.focus();
    }
  }

  ngOnDestroy() {
    const dialog = this.dialogRef?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }

    queueMicrotask(() => this.restoreFocus());
  }

  handleCancel(event: Event) {
    event.preventDefault();
    if (!this.confirmBusy) {
      this.cancelDialog();
    }
  }

  handleDialogClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !this.confirmBusy) {
      this.cancelDialog();
    }
  }

  cancelDialog() {
    const dialog = this.dialogRef?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
    this.cancelled.emit();
  }

  confirmDialog() {
    if (this.confirmBusy || this.confirmPending) {
      return;
    }

    this.confirmPending = true;
    this.confirmed.emit();
  }

  private restoreFocus() {
    const opener = this.returnFocusElement;
    const target = opener?.isConnected ? opener : this.document.querySelector<HTMLElement>('main');
    if (!target) {
      return;
    }

    if (target.tagName === 'MAIN' && !target.hasAttribute('tabindex')) {
      target.tabIndex = -1;
    }
    target.focus({ preventScroll: true });
  }
}

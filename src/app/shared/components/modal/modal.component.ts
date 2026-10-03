import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

// Design-system modal. Body content is projected; put the buttons in <div modal-footer>.
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onOverlay(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.closed.emit();
  }
}

import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

// Design-system modal. Body content is projected; put the buttons in <div modal-footer>.
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="su-modal-overlay" role="presentation" (click)="onOverlay($event)">
        <div class="su-modal-panel" role="dialog" aria-modal="true" [attr.aria-label]="title()">
          <div class="su-modal-head">
            <h2 class="su-modal-title">{{ title() }}</h2>
            <button type="button" class="su-x" aria-label="ปิด" (click)="closed.emit()">
              <i class="ph ph-x" aria-hidden="true"></i>
            </button>
          </div>
          <div class="su-modal-body"><ng-content /></div>
          <div class="su-modal-foot"><ng-content select="[modal-footer]" /></div>
        </div>
      </div>
    }
  `,
  styles: `
    :host ::ng-deep [modal-footer] {
      display: contents;
    }
  `,
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

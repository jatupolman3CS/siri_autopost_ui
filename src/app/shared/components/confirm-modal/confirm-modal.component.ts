import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ModalComponent } from '../modal/modal.component';

// "Are you sure?" dialog for deleting something. `action` runs when the person confirms; the dialog stays open
// (buttons off) while it runs, closes when it resolves, and stays open with the error text when it rejects.
@Component({
  selector: 'app-confirm-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <p class="fs14">{{ body() }}</p>
      @if (err()) {
        <p class="fs14 bad" role="alert">{{ err() }}</p>
      }
      <div modal-footer>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-secondary"
          [disabled]="busy()"
          (click)="closed.emit()"
        >
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy()"
          (click)="confirm()"
        >
          {{ confirmLabel() || t().common.confirm }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .bad {
      color: var(--color-danger);
      margin-top: 8px;
    }
  `,
})
export class ConfirmModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly body = input('');
  readonly confirmLabel = input('');
  readonly action = input.required<() => Promise<unknown>>();
  readonly closed = output<void>();

  protected readonly t = inject(I18nService).t;
  protected readonly busy = signal(false);
  protected readonly err = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.busy.set(false);
        this.err.set('');
      });
    });
  }

  protected async confirm(): Promise<void> {
    this.busy.set(true);
    this.err.set('');
    try {
      await this.action()();
      this.closed.emit();
    } catch {
      this.err.set(this.t().api.itemActionFailed);
    } finally {
      this.busy.set(false);
    }
  }
}

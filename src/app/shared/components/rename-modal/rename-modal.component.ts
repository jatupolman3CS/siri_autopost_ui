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
import { InputFieldComponent } from '../input-field/input-field.component';
import { ModalComponent } from '../modal/modal.component';

// One-field "rename" dialog shared by every list that has names (media, collections, link sets, schedules...).
// The caller gives the current name and a `save` function; the dialog keeps itself open with a message while the
// function is running or rejects, and closes (emits `closed`) when it resolves.
@Component({
  selector: 'app-rename-modal',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <form class="form" id="rename-form" (submit)="$event.preventDefault(); submit()">
        <app-input-field
          [label]="label() || t().api.itemName"
          [(value)]="name"
          [error]="err()"
          [maxlength]="maxlength()"
        />
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="submit"
          form="rename-form"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy()"
        >
          {{ t().common.save }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class RenameModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly label = input('');
  /** The name the field starts with each time the dialog opens. */
  readonly value = input('');
  readonly maxlength = input(120);
  /** Saves the new (trimmed, non-empty) name; a rejection keeps the dialog open. */
  readonly save = input.required<(name: string) => Promise<unknown>>();
  readonly closed = output<void>();

  protected readonly t = inject(I18nService).t;
  protected readonly name = signal('');
  protected readonly err = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const start = this.value();
      untracked(() => {
        this.name.set(start);
        this.err.set('');
        this.busy.set(false);
      });
    });
  }

  protected async submit(): Promise<void> {
    const name = this.name().trim();
    if (!name) {
      this.err.set(this.t().api.itemErrName);
      return;
    }
    if (name === this.value().trim()) {
      this.closed.emit();
      return;
    }
    this.busy.set(true);
    try {
      await this.save()(name);
      this.closed.emit();
    } catch {
      // The interceptor may have toasted the reason; the field says it too.
      this.err.set(this.t().api.itemSaveFailed);
    } finally {
      this.busy.set(false);
    }
  }
}

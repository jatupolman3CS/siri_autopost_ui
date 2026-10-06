import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollection } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "New collection" dialog (name + description), used by the collections page and by the post editor. It creates the
// collection through CollectionsStore (which opens it on the collections page), toasts, and emits it.
@Component({
  selector: 'app-new-collection-modal',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().col.newCol" (closed)="closed.emit()">
      <form class="form" id="new-collection-form" (submit)="$event.preventDefault(); submit()">
        <app-input-field
          [label]="t().col.colName"
          [placeholder]="t().col.colNamePh"
          [(value)]="name"
          [error]="err()"
          [maxlength]="limits.collectionName"
        />
        <app-input-field
          [label]="t().col.colDesc"
          [(value)]="description"
          [maxlength]="limits.collectionDescription"
        />
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="submit"
          form="new-collection-form"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || !perm.canEdit()"
          [attr.title]="perm.editHint() || null"
        >
          {{ t().col.newCol }}
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
export class NewCollectionModalComponent {
  private readonly store = inject(CollectionsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = INPUT_LIMITS;

  readonly open = input(false);
  /** The new collection (also open on the collections page now). */
  readonly created = output<ApiCollection>();
  readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly err = signal('');
  protected readonly busy = signal(false);

  constructor() {
    // A fresh form every time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      this.name.set('');
      this.description.set('');
      this.err.set('');
    });
  }

  protected async submit(): Promise<void> {
    if (this.busy() || !this.perm.canEdit()) return;
    const name = this.name().trim();
    if (!name) {
      this.err.set(this.t().col.errName);
      return;
    }
    this.busy.set(true);
    try {
      const made = await this.store.create(name, this.description());
      this.notify.success(fmt(this.t().col.created, { c: made.name }));
      this.created.emit(made);
      this.closed.emit();
    } catch {
      // The API's reason was toasted by the error interceptor; the form stays as it is.
    } finally {
      this.busy.set(false);
    }
  }
}

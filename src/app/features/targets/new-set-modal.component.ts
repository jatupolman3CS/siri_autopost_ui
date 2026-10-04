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
import { LINK_LIMITS, LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "New link set": a name, and the set is created empty (the account that posts follows the first connected one).
@Component({
  selector: 'app-new-set-modal',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ts.newSet" (closed)="closed.emit()">
      <div (keydown.enter)="create()">
        <app-input-field
          [label]="t().ts.setName"
          [placeholder]="t().ts.setNamePh"
          [(value)]="name"
          [error]="error()"
          [maxlength]="limits.setName"
        />
      </div>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || perm.readOnly()"
          [attr.title]="perm.editHint() || null"
          (click)="create()"
        >
          {{ t().ts.newSet }}
        </button>
      </div>
    </app-modal>
  `,
})
export class NewSetModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = LINK_LIMITS;
  protected readonly name = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.name.set('');
          this.error.set('');
        });
    });
  }

  protected async create(): Promise<void> {
    if (this.busy() || this.perm.readOnly()) return;
    const name = this.name().trim();
    if (!name) {
      this.error.set(this.t().ts.errName);
      return;
    }
    this.busy.set(true);
    try {
      await this.store.createSet(name);
      this.notify.success(fmt(this.t().ts.created, { s: name }));
      this.closed.emit();
    } catch {
      // The error interceptor has shown why (for example the 100-set limit); the name stays to be fixed.
    } finally {
      this.busy.set(false);
    }
  }
}

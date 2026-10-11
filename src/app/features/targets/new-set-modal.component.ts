import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LINK_LIMITS, LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';

// "New link set": a name and, with two or more extensions connected, the extension that posts it (there is no
// "automatic" any more: the set belongs to the extension picked here). With one extension the API names it for the
// set. The set is created empty.
@Component({
  selector: 'app-new-set-modal',
  imports: [ModalComponent, InputFieldComponent, SelectFieldComponent],
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
        @if (several()) {
          <app-select-field
            [label]="t().api.flow.newSetExt"
            [options]="extensions()"
            [placeholder]="t().api.flow.postAsPick"
            [(value)]="postAs"
            [error]="postAsError()"
          />
        }
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
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = LINK_LIMITS;
  protected readonly name = signal('');
  protected readonly postAs = signal('');
  protected readonly error = signal('');
  protected readonly postAsError = signal('');
  protected readonly busy = signal(false);

  /** Two or more extensions: the person has to say which one posts the set. */
  protected readonly several = computed(() => this.accounts.connected().length >= 2);

  protected readonly extensions = computed<SelectOption[]>(() =>
    this.accounts
      .connected()
      .map((a) => ({ value: a.id, label: extensionNameOf(a, this.devices.list()) })),
  );

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.name.set('');
          this.postAs.set('');
          this.error.set('');
          this.postAsError.set('');
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
    if (this.several() && !this.postAs()) {
      this.postAsError.set(this.t().api.flow.newSetExtErr);
      return;
    }
    this.busy.set(true);
    try {
      await this.store.createSet(name, this.postAs() || null);
      this.notify.success(fmt(this.t().ts.created, { s: name }));
      this.closed.emit();
    } catch {
      // The error interceptor has shown why (for example the 100-set limit); the name stays to be fixed.
    } finally {
      this.busy.set(false);
    }
  }
}

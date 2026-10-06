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
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { parseBulkLinks } from '../../core/flow/group-links';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "Paste links": one Facebook group or page per line, `url | code`. The server reads the lines the same way (a repeated
// address is skipped and its code updated) and answers the counts the toast reports.
@Component({
  selector: 'app-bulk-links-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ts.bulkTitle" (closed)="closed.emit()">
      <p class="hint">{{ t().ts.bulkHint }}</p>
      <textarea
        class="su-textarea"
        rows="7"
        spellcheck="false"
        [value]="text()"
        [placeholder]="t().ts.bulkPh"
        [attr.aria-label]="t().ts.bulkTitle"
        (input)="text.set($any($event.target).value)"
      ></textarea>
      @if (error()) {
        <p class="su-field-err" role="alert">{{ error() }}</p>
      }
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || perm.readOnly()"
          [attr.title]="perm.editHint() || null"
          (click)="confirm()"
        >
          {{ t().ts.bulkAdd }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .hint {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--color-text-muted);
    }
  `,
})
export class BulkLinksModalComponent {
  readonly open = input(false);
  /** The set the links go into. */
  readonly setId = input<string | null>(null);
  readonly closed = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly text = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.text.set('');
          this.error.set('');
        });
    });
  }

  protected async confirm(): Promise<void> {
    const id = this.setId();
    if (!id || this.busy() || this.perm.readOnly()) return;
    if (!parseBulkLinks(this.text()).links.length) {
      this.error.set(this.t().ts.bulkEmpty);
      return;
    }
    this.busy.set(true);
    try {
      const r = await this.store.bulkAdd(id, this.text());
      this.notify.show(
        r.invalid ? 'info' : 'success',
        fmt(this.t().ts.bulkResult, {
          n: r.added,
          d: r.duplicates,
          r: r.recoded,
          i: r.invalid,
        }),
      );
      this.closed.emit();
    } catch {
      // The error interceptor has shown why; the pasted text stays.
    } finally {
      this.busy.set(false);
    }
  }
}

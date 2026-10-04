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
import { BackupStore } from '../../core/data/backup.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiBackup } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService } from '../../core/i18n/i18n.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "Restore from file": the pasted backup (JSON) replaces the workspace's collections, link sets, schedules and
// advanced settings. A text that is not a JSON object is refused here; everything else (an incomplete file, a
// post that cannot be restored) is the API's to refuse, and its Thai reason shows under the box with nothing
// changed.
@Component({
  selector: 'app-restore-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ab.restoreTitle" (closed)="closed.emit()">
      <p class="hint">{{ t().ab.restoreHint }}</p>
      <textarea
        class="su-textarea mono"
        rows="7"
        spellcheck="false"
        [value]="text()"
        placeholder='{ "collections": [ … ] }'
        [attr.aria-label]="t().ab.restoreTitle"
        [attr.aria-invalid]="error() ? true : null"
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
          [disabled]="busy() || !perm.canAdmin()"
          [attr.title]="perm.adminHint() || null"
          (click)="confirm()"
        >
          {{ t().ab.restore }}
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
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
  `,
})
export class RestoreModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly backup = inject(BackupStore);
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

  /** The text as a backup object, or null when it is not a JSON object. */
  private parse(): ApiBackup | null {
    try {
      const data: unknown = JSON.parse(this.text());
      return data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiBackup) : null;
    } catch {
      return null;
    }
  }

  protected async confirm(): Promise<void> {
    if (this.busy() || !this.perm.canAdmin()) return;
    const file = this.parse();
    if (!file) {
      this.error.set(this.t().ab.restoreErr);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.backup.restore(file);
      this.closed.emit();
    } catch (e) {
      // The file stays in the box so it can be fixed; nothing was changed.
      this.error.set(problemMessage(e) ?? this.t().api.serverDown);
    } finally {
      this.busy.set(false);
    }
  }
}

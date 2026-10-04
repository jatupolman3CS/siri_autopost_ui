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
import { parseLinkCsv } from '../../core/flow/group-links';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "Import CSV": rows `set, name, url, code` pasted from Excel or read from a file. Missing sets are created
// by name; the server skips repeated and invalid addresses and counts them.
@Component({
  selector: 'app-csv-links-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ts.csvTitle" (closed)="closed.emit()">
      <p class="hint">{{ t().ts.csvHint }}</p>
      <textarea
        class="su-textarea"
        rows="7"
        spellcheck="false"
        [value]="text()"
        [placeholder]="t().ts.csvPh"
        [attr.aria-label]="t().ts.csvTitle"
        (input)="text.set($any($event.target).value)"
      ></textarea>
      <div class="file">
        <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="picker.click()">
          <i class="ph ph-upload-simple"></i>{{ t().api.flow.csvChooseFile }}
        </button>
        <input
          #picker
          type="file"
          hidden
          accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
          (change)="readFile(picker)"
        />
      </div>
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
          {{ t().ts.csvAdd }}
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
    .file {
      margin-top: 6px;
    }
  `,
})
export class CsvLinksModalComponent {
  readonly open = input(false);
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

  /** Puts the file's text into the box, where it can still be checked and edited before importing. */
  protected async readFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.text.set(await file.text());
      this.error.set('');
    } catch {
      this.error.set(this.t().api.flow.csvFileError);
    }
  }

  protected async confirm(): Promise<void> {
    if (this.busy() || this.perm.readOnly()) return;
    if (!this.text().trim()) {
      this.error.set(this.t().ts.bulkEmpty);
      return;
    }
    const parsed = parseLinkCsv(this.text());
    if (!parsed.rows.length) {
      this.error.set(this.t().api.flow.csvNoRows);
      return;
    }
    this.busy.set(true);
    try {
      const r = await this.store.importCsv(parsed.rows);
      const bad = r.invalid + parsed.invalid;
      this.notify.show(
        bad ? 'info' : 'success',
        fmt(this.t().ts.csvDone, { n: r.links, s: r.sets, i: bad }),
      );
      this.closed.emit();
    } catch {
      // The error interceptor has shown why; the rows stay in the box.
    } finally {
      this.busy.set(false);
    }
  }
}

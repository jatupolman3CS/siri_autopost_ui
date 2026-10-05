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
import { BackupStore } from '../../core/data/backup.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { SchedulesStore } from '../../core/data/schedules.store';
import { BackupSummary, isCompleteBackup, summarizeBackup } from '../../core/flow';
import { ApiBackup } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// "Restore from file" in two steps. First the backup (JSON) is pasted and checked: a text that is not a JSON
// object, or an object without collections, link sets and schedules, is refused on the spot. Then the dialog
// lists what the file contains and what the restore replaces (everything of those kinds in this workspace;
// the posts the old schedules had queued are deleted; sent history stays) and only a second, explicit click
// ("Replace and restore") sends it. Whatever else is wrong with the file is the API's to refuse: its Thai
// reason shows under the box with nothing changed and the text still there to fix.
@Component({
  selector: 'app-restore-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="open()"
      [title]="t().ab.restoreTitle"
      [closable]="!busy()"
      (closed)="closed.emit()"
    >
      @if (summary(); as s) {
        <div class="review" data-testid="restore-review">
          <p class="head">{{ t().api.engine.restoreSumTitle }}</p>
          <ul class="sum">
            <li>
              {{ line(t().api.engine.restoreSumCollections, { n: s.collections, p: s.posts }) }}
            </li>
            @if (s.libraryPosts) {
              <li>{{ line(t().api.engine.restoreSumLibrary, { n: s.libraryPosts }) }}</li>
            }
            <li>{{ line(t().api.engine.restoreSumLinkSets, { n: s.linkSets, l: s.links }) }}</li>
            <li>{{ line(t().api.engine.restoreSumSchedules, { n: s.schedules }) }}</li>
            @if (s.advanced) {
              <li>{{ t().api.engine.restoreSumAdvanced }}</li>
            }
            @if (s.notificationSets !== null) {
              <li>{{ line(t().api.engine.restoreSumNotify, { n: s.notificationSets }) }}</li>
            }
            @if (s.autoReplyRules !== null) {
              <li>{{ line(t().api.engine.restoreSumReply, { n: s.autoReplyRules }) }}</li>
            }
          </ul>
          @if (s.advanced || s.notificationSets !== null || s.autoReplyRules !== null) {
            <p class="small muted plan">{{ t().api.engine.restoreSumPlan }}</p>
          }
          <div class="callout warn" role="alert">
            <i class="ph ph-warning" aria-hidden="true"></i>
            <div class="warn-body">
              <p>{{ t().api.engine.restoreReplaces }}</p>
              @if (now(); as n) {
                <p class="now">{{ n }}</p>
              }
              <p>{{ t().api.engine.restoreQueued }}</p>
              <p>{{ t().api.engine.restoreHistory }}</p>
            </div>
          </div>
        </div>
      } @else {
        <p class="hint">{{ t().ab.restoreHint }}</p>
        <input
          #picker
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="restore-file"
          (change)="pick($event)"
        />
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-secondary pick"
          [disabled]="busy() || !perm.canAdmin()"
          (click)="picker.click()"
        >
          <i class="ph ph-upload-simple" aria-hidden="true"></i>
          {{ t().api.engine.restorePick }}
        </button>
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
      }
      @if (error()) {
        <p class="su-field-err" role="alert">{{ error() }}</p>
      }
      <div modal-footer>
        @if (summary()) {
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-secondary"
            [disabled]="busy()"
            (click)="back()"
          >
            {{ t().api.engine.restoreBack }}
          </button>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-danger"
            [disabled]="busy() || !perm.canAdmin()"
            [attr.title]="perm.adminHint() || null"
            (click)="confirm()"
          >
            {{ t().api.engine.restoreConfirm }}
          </button>
        } @else {
          <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
            {{ t().common.cancel }}
          </button>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-primary"
            [disabled]="busy() || !perm.canAdmin()"
            [attr.title]="perm.adminHint() || null"
            (click)="review()"
          >
            {{ t().api.engine.restoreCheck }}
          </button>
        }
      </div>
    </app-modal>
  `,
  styles: `
    .hint {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--color-text-muted);
    }
    .pick {
      margin: 0 0 8px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .head {
      margin: 0 0 6px;
      font-weight: 600;
    }
    .sum {
      margin: 0 0 8px;
      padding-left: 20px;
      font-size: 14px;
    }
    .plan {
      margin: 0 0 12px;
    }
    .warn-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      p {
        margin: 0;
      }
    }
    .now {
      font-weight: 500;
    }
  `,
})
export class RestoreModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly backup = inject(BackupStore);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly schedules = inject(SchedulesStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly text = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  /** What the checked file holds: set means the second step (the confirmation) is showing. */
  protected readonly summary = signal<BackupSummary | null>(null);
  /** The file that was checked: what the second click sends. */
  private file: ApiBackup | null = null;

  /** What this workspace has right now, which the restore replaces ('' until its lists have arrived). */
  protected readonly now = computed(() =>
    this.collections.loaded() && this.linkSets.loaded() && this.schedules.loaded()
      ? fmt(this.t().api.engine.restoreNow, {
          c: this.collections.collections().length,
          s: this.linkSets.sets().length,
          h: this.schedules.schedules().length,
        })
      : '',
  );

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.text.set('');
          this.error.set('');
          this.summary.set(null);
          this.file = null;
        });
    });
  }

  protected line(template: string, values: Record<string, number>): string {
    return fmt(template, values);
  }

  /** A chosen file replaces the text; it is checked by the same "Check the file" click as pasted text. */
  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.text.set(await file.text());
      this.error.set('');
    } catch {
      this.error.set(this.t().ab.restoreErr);
    }
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

  /** First click: checks the text and, when it is a backup, shows what it holds and what it replaces. */
  protected review(): void {
    if (this.busy() || !this.perm.canAdmin()) return;
    const file = this.parse();
    if (!file) {
      this.error.set(this.t().ab.restoreErr);
      return;
    }
    if (!isCompleteBackup(file)) {
      this.error.set(this.t().api.engine.restoreIncomplete);
      return;
    }
    this.error.set('');
    this.file = file;
    this.summary.set(summarizeBackup(file));
  }

  /** Back to the box with the text as it was. */
  protected back(): void {
    if (this.busy()) return;
    this.file = null;
    this.summary.set(null);
    this.error.set('');
  }

  /** Second click: sends the file that was checked. */
  protected async confirm(): Promise<void> {
    const file = this.file;
    if (!file || this.busy() || !this.perm.canAdmin()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.backup.restore(file);
      this.closed.emit();
    } catch (e) {
      // Back to the box with the file still in it so it can be fixed; nothing was changed.
      this.file = null;
      this.summary.set(null);
      this.error.set(problemMessage(e) ?? this.t().api.serverDown);
    } finally {
      this.busy.set(false);
    }
  }
}

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
import { AccountsStore } from '../../core/data/accounts.store';
import { CHAT_RECENT_DAYS, LineChatList } from '../../core/data/line-chats.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { chatLabel, lineChatKey } from '../../core/flow/line-chats';
import { ownerOfSet } from '../../core/flow/link-ownership';
import { ApiImportLineChats } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';

/** Chats shown on a page of the dialog: the roster may hold thousands, so the list is narrowed by searching and paged. */
const SHOWN = 50;

// "Import from LINE chats": picks customers from the roster of the Official Account the set's machine syncs, by name,
// label and how recently they chatted, and puts them into a chat set in one request: the ticked ones (50 shown a page), or
// everything that matches the filters ("pick everything that matches", which the server expands itself, so thousands of
// chats need not be ticked). Chats marked do-not-send cannot be picked and chats the set already has are marked. The page
// shows this component only while it is open, so the roster is read only when somebody asks; it has its own list
// (`LineChatList`, provided here), so its filters never touch the roster page's.
@Component({
  selector: 'app-import-line-chats-modal',
  imports: [
    CheckboxComponent,
    FeatureLockComponent,
    InputFieldComponent,
    ModalComponent,
    PagerComponent,
    SelectFieldComponent,
  ],
  providers: [LineChatList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" [title]="t().api.line.chatImportTitle" (closed)="closed.emit()">
      <p class="small muted hint">{{ t().api.line.chatImportHint }}</p>
      @if (locked()) {
        <app-feature-lock [heading]="lockTitle()" [body]="t().api.line.chatLockedBody" />
      } @else if (!owner()) {
        <p class="su-field-err" role="alert">{{ t().api.line.chatImportNoOwner }}</p>
      } @else if (!list.loaded()) {
        <p class="muted">—</p>
      } @else {
        <div class="find">
          <app-input-field
            [label]="t().api.line.chatSearch"
            [placeholder]="t().api.line.chatSearchPh"
            [value]="list.q()"
            (valueChange)="list.setSearch($event)"
            (keydown.enter)="list.applySearch()"
          />
          <app-select-field
            [label]="t().api.line.chatLabelFilter"
            [options]="labelOptions()"
            [value]="list.label()"
            (valueChange)="list.setLabel($event)"
          />
          <app-select-field
            [label]="t().api.line.chatRecent"
            [options]="recentOptions()"
            [value]="recentValue()"
            (valueChange)="setRecent($event)"
          />
        </div>
        <app-checkbox
          [label]="allLabel()"
          [checked]="all()"
          [disabled]="!list.total()"
          (checkedChange)="all.set($event)"
        />
        @if (all()) {
          <p class="small muted">{{ t().api.line.chatImportAllHint }}</p>
        }
        <div class="list" role="group" [attr.aria-label]="t().api.line.chatImportTitle">
          @for (c of list.chats(); track c.id) {
            <div class="item">
              <app-checkbox
                [ariaLabel]="nameOf(c)"
                [checked]="all() ? !blocked(c) : picked().has(c.id)"
                [disabled]="all() || blocked(c)"
                (checkedChange)="toggle(c.id, $event)"
              />
              <span class="text">{{ nameOf(c) }}</span>
              @for (l of c.labels; track l) {
                <span class="small muted">{{ l }}</span>
              }
              @if (inSet().has(key(c.url))) {
                <span class="small muted">{{ t().api.line.chatImportInSet }}</span>
              } @else if (c.doNotSend) {
                <span class="small muted">{{ t().api.line.chatDoNotSend }}</span>
              }
            </div>
          } @empty {
            <p class="small muted">{{ t().api.line.chatNoMatch }}</p>
          }
        </div>
        <app-pager [pager]="list.pager" />
      }
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
          [disabled]="busy() || !count() || !owner() || locked() || !perm.canEdit()"
          [attr.title]="perm.editHint() || null"
          (click)="add()"
        >
          {{ goLabel() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .hint {
      margin: 0 0 12px;
    }
    .find {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
      gap: 12px;
    }
    .list {
      display: flex;
      flex-direction: column;
      max-height: 320px;
      overflow-y: auto;
      margin-top: 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--color-border);
    }
    .text {
      min-width: 0;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
})
export class ImportLineChatsModalComponent {
  /** The chat set the customers go into. */
  readonly setId = input.required<string>();
  readonly closed = output<void>();

  protected readonly list = inject(LineChatList);
  private readonly sets = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  /** "Pick everything that matches the filters": the server expands it, the ticks are ignored. */
  protected readonly all = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly locked = computed(
    () => this.workspaces.lineChatLocked() || this.list.locked(),
  );
  protected readonly lockTitle = computed(() =>
    fmt(this.t().api.line.chatLockedTitle, { plan: this.t().plans.pro.name }),
  );

  private readonly set = computed(() => this.sets.byId(this.setId()));
  /** The LINE account whose chats can go into the set: the one that posts it (null while it has no choice). */
  protected readonly owner = computed(() => {
    const set = this.set();
    return set ? ownerOfSet(set, this.accounts.list()) : null;
  });
  /** The chats the set already holds, by address. */
  protected readonly inSet = computed(
    () => new Set((this.set()?.links ?? []).map((l) => lineChatKey(l.url))),
  );
  protected readonly key = lineChatKey;

  protected readonly labelOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatLabelAll },
    ...this.list.labels().map((l) => ({ value: l, label: l })),
  ]);
  protected readonly recentOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatRecentAny },
    ...CHAT_RECENT_DAYS.map((n) => ({
      value: String(n),
      label: fmt(this.t().api.line.chatRecentDays, { n }),
    })),
  ]);
  protected readonly recentValue = computed(() => {
    const days = this.list.activeWithinDays();
    return days === null ? '' : String(days);
  });

  /** Chats that will be added: everything that matches, or the ticked ones. */
  protected readonly count = computed(() => (this.all() ? this.list.total() : this.picked().size));
  protected readonly allLabel = computed(() =>
    fmt(this.t().api.line.chatImportAll, { n: this.list.total() }),
  );
  protected readonly goLabel = computed(() =>
    this.all()
      ? this.t().api.line.chatImportGoAll
      : fmt(this.t().api.line.chatImportGo, { n: this.picked().size }),
  );

  constructor() {
    this.list.pager.setSize(SHOWN);
    // The list is the one account that posts the set: the API refuses chats of any other. Nothing is asked until that
    // account is known (a set with no machine chosen has no list to show).
    this.list.enabled.set(false);
    effect(() => {
      const owner = this.owner();
      untracked(() => {
        if (owner && this.list.accountId() !== owner) this.list.setAccount(owner);
        this.list.enabled.set(!!owner);
      });
    });
  }

  /** What a customer is called: the name LINE shows, else "customer". */
  protected nameOf(c: { name: string }): string {
    return chatLabel(c, this.t().api.line.chatCustomer);
  }

  /** A chat that cannot be picked: marked do-not-send, or already in the set. */
  protected blocked(c: { url: string; doNotSend: boolean }): boolean {
    return c.doNotSend || this.inSet().has(lineChatKey(c.url));
  }

  protected setRecent(value: string): void {
    this.list.setActiveWithinDays(value === '' ? null : Number(value));
  }

  protected toggle(id: string, on: boolean): void {
    this.picked.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected async add(): Promise<void> {
    const owner = this.owner();
    if (this.busy() || !owner || !this.count() || !this.perm.canEdit()) return;
    const body: ApiImportLineChats = this.all()
      ? {
          accountId: owner,
          allMatching: true,
          filter: {
            q: this.list.sentQuery().trim() || null,
            label: this.list.label() || null,
            activeWithinDays: this.list.activeWithinDays(),
          },
        }
      : { accountId: owner, allMatching: false, chatIds: [...this.picked()] };
    this.busy.set(true);
    this.error.set('');
    try {
      const line = this.t().api.line;
      const r = await this.sets.importChats(this.setId(), body);
      this.notify.show(
        r.added ? 'success' : 'info',
        fmt(line.chatImportDone, { n: r.added, d: r.duplicates, s: r.skippedDoNotSend }),
      );
      // One chat, one extension: customers another machine's set already holds were left out.
      if (r.conflicts)
        this.notify.show(
          'warning',
          fmt(line.chatImportConflicts, { n: r.conflicts, note: r.conflictNote ?? '' }),
          9000,
        );
      this.closed.emit();
    } catch (e) {
      this.error.set(problemMessage(e) ?? this.t().api.line.chatImportFailed);
    } finally {
      this.busy.set(false);
    }
  }
}

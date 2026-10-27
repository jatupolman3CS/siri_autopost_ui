import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  ApiBulkLinksResult,
  ApiImportLineChats,
  ApiLineChat,
  ApiLineChatAccount,
  ApiLineChatPage,
  ApiService,
} from '../http/api.service';
import { Pager } from '../../shared/components/pager/pager';
import { DeviceEventsService } from './device-events.service';
import { LinkSetsStore } from './link-sets.store';
import { loadWithRetry } from './loading';
import { WorkspaceStore } from './workspace.store';

/** "Last chat within N days" choices of the filters (the API takes any whole number of days). */
export const CHAT_RECENT_DAYS: readonly number[] = [1, 3, 7, 30, 90];
/** How long after the last keystroke the search is sent. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Events after which the chats are read again: the browser synced its list. */
const CHAT_EVENTS = ['device.line_chats'];
/** A burst of events is answered by one read. */
const EVENT_REFRESH_MS = 1500;

/** The body of an import: the chats picked, or every chat of the account that matches a filter. */
export type ChatImport = Partial<Pick<ApiImportLineChats, 'chatIds' | 'filter' | 'allMatching'>> &
  Pick<ApiImportLineChats, 'accountId'>;

// One filtered, paged list of the customers (chats) a LINE Official Account has, as the API serves them (20 a page by
// default; the account's browser fills the list by syncing the chat list, the list never holds message text). The roster
// page uses the root `LineChatsStore` below; a dialog that needs its own filters provides `LineChatList` itself, so it does
// not disturb the page's. It reads by itself whenever a filter or the page changes (a typed search is sent
// `SEARCH_DEBOUNCE_MS` after the last keystroke), empties itself when the workspace changes, and never asks the API
// while the owner's plan has no LINE chats (`locked`; a 403 from the API says it too).
@Injectable()
export class LineChatList {
  protected readonly api = inject(ApiService);
  protected readonly ws = inject(WorkspaceStore);

  /** The current page of chats. */
  readonly chats = signal<ApiLineChat[]>([]);
  /** Chats that match the filters, over every page. */
  readonly total = signal(0);
  /** Every label any chat of the workspace has (for the label chips). */
  readonly labels = signal<string[]>([]);
  /** The workspace's LINE accounts (one for each browser logged in to LINE OA Manager). */
  readonly accounts = signal<ApiLineChatAccount[]>([]);
  /**
   * Reads only while on. A dialog that needs a choice first (which account's customers) switches it off until it
   * has made it, so the list never asks for the wrong question and then for the right one.
   */
  readonly enabled = signal(true);
  /** The first answer for the current workspace has arrived. */
  readonly loaded = signal(false);
  /** The owner's plan has no LINE chats: nothing is asked. */
  readonly locked = signal(false);
  /** The list could not be read (after the retries); the page says so. */
  readonly failed = signal(false);

  /** What the person typed in the search box (shown at once). */
  readonly q = signal('');
  /** The search that is applied (`q` after the debounce). */
  private readonly qApplied = signal('');
  /** The search the list is read with now (what an "import everything that matches" must send too). */
  readonly sentQuery = this.qApplied.asReadonly();
  readonly label = signal('');
  /** Only chats whose last message is newer than this many days (null = any; a chat with no known time is left out). */
  readonly activeWithinDays = signal<number | null>(null);
  /** Only chats marked "do not send" (true), only the others (false), or both (null). */
  readonly doNotSend = signal<boolean | null>(null);
  /** The Official Account ('' = all of them). */
  readonly accountId = signal('');
  /** Paging: the pager's page and size drive the query; the answer's `total` feeds it back. */
  readonly pager = new Pager(20);

  /** Some filter is on (so an empty list may only mean nothing matches). */
  readonly filtered = computed(
    () =>
      this.qApplied().trim() !== '' ||
      this.label() !== '' ||
      this.activeWithinDays() !== null ||
      this.doNotSend() !== null,
  );

  private seq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWs: string | null = null;
  /** The question that was last sent (workspace and filters): the same one is not sent twice. */
  private lastAsked = '';

  /** What the API is asked: the filters and the page. */
  private readonly query = computed(() => ({
    accountId: this.accountId() || undefined,
    q: this.qApplied().trim() || undefined,
    label: this.label() || undefined,
    activeWithinDays: this.activeWithinDays() ?? undefined,
    doNotSend: this.doNotSend() ?? undefined,
    page: this.pager.page(),
    pageSize: this.pager.size(),
  }));

  constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.seq++;
    });
    // Reads when the workspace or the question changes. A new workspace starts from nothing, filters included.
    effect(() => {
      const id = this.ws.id();
      // The owner's plan has no LINE chats (read from the workspace itself: `lineChatLocked` waits for the whole list).
      const current = this.ws.current();
      const locked = !!current && !current.lineChat;
      this.query();
      const enabled = this.enabled();
      untracked(() => {
        if (id !== this.lastWs) {
          this.lastWs = id;
          this.reset();
        }
        if (!id || !enabled) return;
        if (locked) {
          this.locked.set(true);
          this.loaded.set(true);
          return;
        }
        this.locked.set(false);
        // Read after a reset: the new workspace's question, not the filters the old one had.
        const query = this.query();
        const asked = id + JSON.stringify(query);
        if (asked === this.lastAsked) return;
        this.lastAsked = asked;
        void this.load(id, query);
      });
    });
  }

  /** Types in the search box: shown at once, sent shortly after the last keystroke (and from the first page). */
  setSearch(text: string): void {
    this.q.set(text);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.applySearch();
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Sends the search now (Enter). */
  applySearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    if (this.qApplied() === this.q()) return;
    this.qApplied.set(this.q());
    this.pager.go(1);
  }

  /** Changes a filter and goes back to the first page. */
  setLabel(label: string): void {
    this.label.set(label);
    this.pager.go(1);
  }
  setActiveWithinDays(days: number | null): void {
    this.activeWithinDays.set(days);
    this.pager.go(1);
  }
  setDoNotSendFilter(value: boolean | null): void {
    this.doNotSend.set(value);
    this.pager.go(1);
  }
  setAccount(id: string): void {
    this.accountId.set(id);
    this.pager.go(1);
  }

  /** Clears every filter (the account choice stays: it is not a filter of the list but whose list it is). */
  clearFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.q.set('');
    this.qApplied.set('');
    this.label.set('');
    this.activeWithinDays.set(null);
    this.doNotSend.set(null);
    this.pager.go(1);
  }

  /** Reads the current page again after a failure (the same question is otherwise not asked twice). */
  retry(): void {
    const id = this.ws.id();
    if (!id || this.locked()) return;
    const query = this.query();
    this.lastAsked = id + JSON.stringify(query);
    void this.load(id, query);
  }

  /** A quiet re-read of the current page for live updates: a failure leaves the list as it is. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.locked()) return;
    const seq = ++this.seq;
    try {
      const page = await this.api.lineChats(wsId, this.query(), true);
      if (this.ws.id() === wsId && seq === this.seq) this.apply(page);
    } catch (e) {
      if (isForbidden(e) && this.ws.id() === wsId) this.locked.set(true);
      // Otherwise the next event or filter change tries again.
    }
  }

  /**
   * Marks a chat "do not send" (or takes the mark off). The switch shows at once; the answer replaces the row and a
   * refusal puts it back. Answers whether the server took it. Editors.
   */
  async setDoNotSend(id: string, on: boolean): Promise<boolean> {
    const wsId = this.ws.id();
    if (!wsId) return false;
    const before = this.chats().find((c) => c.id === id)?.doNotSend;
    this.patch(id, (c) => ({ ...c, doNotSend: on }));
    try {
      const saved = await this.api.setLineChatDoNotSend(wsId, id, on);
      if (this.ws.id() === wsId) this.patch(id, () => saved);
      return true;
    } catch {
      if (this.ws.id() === wsId && before !== undefined)
        this.patch(id, (c) => ({ ...c, doNotSend: before }));
      return false;
    }
  }

  private patch(id: string, change: (c: ApiLineChat) => ApiLineChat): void {
    this.chats.update((list) => list.map((c) => (c.id === id ? change(c) : c)));
  }

  private reset(): void {
    this.seq++;
    this.lastAsked = '';
    this.chats.set([]);
    this.total.set(0);
    this.labels.set([]);
    this.accounts.set([]);
    this.loaded.set(false);
    this.locked.set(false);
    this.failed.set(false);
    this.q.set('');
    this.qApplied.set('');
    this.label.set('');
    this.activeWithinDays.set(null);
    this.doNotSend.set(null);
    this.accountId.set('');
    this.pager.go(1);
  }

  private async load(wsId: string, query: ReturnType<LineChatList['query']>): Promise<void> {
    const seq = ++this.seq;
    const wanted = () => this.ws.id() === wsId && seq === this.seq;
    const ok = await loadWithRetry(async () => {
      try {
        const page = await this.api.lineChats(wsId, query, true);
        if (wanted()) this.apply(page);
      } catch (e) {
        // The owner's plan has no LINE chats: not a failure to retry, the page shows its lock.
        if (isForbidden(e)) {
          if (wanted()) this.locked.set(true);
          return;
        }
        throw e;
      }
    }, wanted);
    if (!wanted()) return;
    this.failed.set(!ok);
    if (ok) this.loaded.set(true);
  }

  private apply(page: ApiLineChatPage): void {
    this.chats.set(page.items);
    this.total.set(page.total);
    this.labels.set(page.labels);
    this.accounts.set(page.accounts);
    this.failed.set(false);
    // Tells the pager how many chats there are; it clamps the page when the list shrank.
    this.pager.slice(new Array<null>(page.total));
  }
}

const isForbidden = (e: unknown): boolean => e instanceof HttpErrorResponse && e.status === 403;

// The roster of the current workspace's LINE chats (`/app/line-chats`), kept live: the browser's chat sync arrives as
// a `device.line_chats` event, and the list is read again after a reconnect of the event stream. Reading is for every
// role; "do not send" and importing into a link set are an editor's.
@Injectable({ providedIn: 'root' })
export class LineChatsStore extends LineChatList {
  private readonly linkSets = inject(LinkSetsStore);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (CHAT_EVENTS.includes(e.type)) this.scheduleRefresh();
    });
    events.onResume(() => void this.refresh());
    inject(DestroyRef).onDestroy(() => {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
    });
  }

  /**
   * Puts chats into a LINE link set: the picked ones, or every chat of the account that matches a filter. Rejects when the
   * API refuses (the dialog shows why); the roster is read again after it, because every chat now sits in one more set.
   */
  async importIntoSet(setId: string, body: ChatImport): Promise<ApiBulkLinksResult> {
    const result = await this.linkSets.importChats(setId, { allMatching: false, ...body });
    void this.refresh();
    return result;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, EVENT_REFRESH_MS);
  }
}

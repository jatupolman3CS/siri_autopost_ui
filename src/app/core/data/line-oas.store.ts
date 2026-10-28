import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiLineOa, ApiService } from '../http/api.service';
import { problemMessage } from '../http/problem-details';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** Events after which the list is read again: a browser read customers, came online or went away, or accounts changed. */
const OA_EVENTS = [
  'device.line_chats',
  'device.online',
  'device.updated',
  'device.revoked',
  'device.paired',
];
/** A burst of events is answered by one read. */
const EVENT_REFRESH_MS = 1500;
/** The event stream keeps the list fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;

// The master list of the workspace's LINE Official Accounts (`/app/line-oas`): the owner pastes an OA address
// (chat.line.biz/<id>), the API makes the account and asks a browser to read the OA's customers, which then show under
// that OA. The link-set dialog picks its OA from this list. Reading is for every role; adding and "read again" are an
// editor's, removing an admin's. A workspace whose owner's plan has no LINE chats gets a 403 and `locked`.
@Injectable({ providedIn: 'root' })
export class LineOasStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<ApiLineOa[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly locked = signal(false);
  /** The OAs a link set can post through: the ones a browser reads. */
  readonly usable = computed(() => this.list().filter((o) => !!o.deviceId));

  private seq = 0;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    whenWorkspaceChanges((id) => {
      this.seq++;
      this.list.set([]);
      this.loaded.set(false);
      this.failed.set(false);
      this.locked.set(false);
      if (id) void this.load(id);
    });
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (OA_EVENTS.includes(e.type)) this.scheduleRefresh();
    });
    events.onResume(() => void this.refresh());
    const poll = setInterval(() => {
      if (!events.connected()) void this.refresh();
    }, FALLBACK_POLL_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
    });
  }

  /** The first read, with the usual retries; a plan without LINE chats is a lock, not a failure. */
  async load(wsId: string): Promise<void> {
    const seq = ++this.seq;
    const wanted = () => this.ws.id() === wsId && seq === this.seq;
    const ok = await loadWithRetry(async () => {
      try {
        const rows = await this.api.lineOas(wsId, true);
        if (wanted()) this.list.set(rows);
      } catch (e) {
        if (e instanceof HttpErrorResponse && e.status === 403) {
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

  /** A quiet re-read for live updates: a failure leaves the list as it is. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.locked() || !this.loaded()) return;
    const seq = ++this.seq;
    try {
      const rows = await this.api.lineOas(wsId, true);
      if (this.ws.id() === wsId && seq === this.seq) this.list.set(rows);
    } catch {
      // The next event or poll tries again.
    }
  }

  /** Adds an OA by its address; rejects when the API refuses (the form shows why). `deviceId` only with several browsers. */
  async add(url: string, deviceId?: string | null, name?: string): Promise<ApiLineOa> {
    const wsId = this.ws.id();
    if (!wsId) throw new Error('no workspace');
    const row = await this.api.addLineOa(wsId, {
      url,
      deviceId: deviceId || null,
      name: name?.trim() || null,
    });
    if (this.ws.id() === wsId) this.list.update((l) => [...l, row]);
    return row;
  }

  /** Asks the OA's browser to read its customers again. Answers '' when the API took it, else why not. */
  async sync(id: string): Promise<string> {
    return this.send(id, (wsId) => this.api.syncLineOa(wsId, id));
  }

  /** Tells the OA's browser to work for that OA from now on. Answers '' when the API took it, else why not. */
  async use(id: string): Promise<string> {
    return this.send(id, (wsId) => this.api.useLineOa(wsId, id));
  }

  // The requests are quiet (no toast of their own), so the reason of a refusal is handed back for the page to show.
  private async send(id: string, call: (wsId: string) => Promise<unknown>): Promise<string> {
    const wsId = this.ws.id();
    if (!wsId) return 'no workspace';
    try {
      await call(wsId);
      return '';
    } catch (e) {
      return problemMessage(e) ?? (e instanceof HttpErrorResponse ? `HTTP ${e.status}` : String(e));
    }
  }

  /** Removes an OA. Rejects with the API's reason (a link set uses it, posts are queued). */
  async remove(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    await this.api.removeLineOa(wsId, id);
    if (this.ws.id() === wsId) this.list.update((l) => l.filter((o) => o.id !== id));
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, EVENT_REFRESH_MS);
  }
}

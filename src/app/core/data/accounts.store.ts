import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { Health, SocialAccount } from './models';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** Events that change an account: its groups or name, its device, or a post that may have asked for a new login. */
const ACCOUNT_EVENTS = [
  'device.groups',
  'device.updated',
  'device.paired',
  'device.revoked',
  'post',
];
/** The event stream keeps the list fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;

// Social accounts connected to the current workspace.
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<SocialAccount[]>([]);
  /** The list for the current workspace has arrived (the composer and the overview wait for it). */
  readonly loaded = signal(false);
  /** Every Facebook group any account posts to, in account order. */
  readonly allGroups = computed(() => [...new Set(this.list().flatMap((a) => a.groups))]);

  constructor() {
    whenWorkspaceChanges((id) => {
      this.list.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
    // Live: a device syncing its groups, being renamed, paired or unbound, or a post settling.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (ACCOUNT_EVENTS.includes(e.type)) void this.refresh();
    });
    events.onResume(() => void this.refresh());
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => {
        if (!events.connected()) void this.refresh();
      }, FALLBACK_POLL_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  /** Loads the list (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.accounts(wsId);
        if (this.ws.id() === wsId) this.list.set(list);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** A quiet re-read for live updates: a failure leaves the list as it is. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    try {
      const list = await this.api.accounts(wsId, true);
      if (this.ws.id() === wsId) {
        this.list.set(list);
        this.loaded.set(true);
      }
    } catch {
      // The next event or poll tries again.
    }
  }

  byId(id: string): SocialAccount | undefined {
    return this.list().find((a) => a.id === id);
  }

  health(id: string): Health {
    return this.byId(id)?.health ?? 'ok';
  }

  /** Marks the account signed in again (the extension refreshes the session). */
  async reconnect(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const updated = await this.api.reconnect(wsId, id);
    this.list.update((l) => l.map((a) => (a.id === id ? updated : a)));
  }
}

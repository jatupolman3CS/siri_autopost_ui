import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiDevice, ApiService } from '../http/api.service';
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
  // A browser that syncs its LINE chats has a LINE account by then.
  'device.line_chats',
];
/** The event stream keeps the list fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;

/** Prefix of the Facebook account a paired browser brings (SocialAccount.ForDevice in the API). */
const DEVICE_ACCOUNT_PREFIX = 'Facebook · ';
/** Prefix of the LINE Official Account a browser reports ("LINE · <OA name>"). */
export const LINE_ACCOUNT_PREFIX = 'LINE · ';

/** The device list entry (a browser) that brings an account: its Facebook account, or the LINE account in its `line`. */
export function deviceOfAccount<D extends Pick<ApiDevice, 'accountId' | 'line'>>(
  accountId: string,
  devices: readonly D[],
): D | undefined {
  return devices.find((d) => d.accountId === accountId || d.line?.accountId === accountId);
}

/**
 * What a person calls the extension an account belongs to: the name of its browser ("Shop PC"), not the
 * account's "Facebook · Shop PC" or "LINE · Shop OA". The device list is asked first (a rename shows there at once,
 * for the browser's LINE account too); the account's own name, without its prefix, stands in while the devices have
 * not arrived or the browser was unbound.
 */
export function extensionNameOf(
  account: Pick<SocialAccount, 'id' | 'name'>,
  devices: readonly Pick<ApiDevice, 'accountId' | 'name' | 'line'>[],
): string {
  const device = deviceOfAccount(account.id, devices);
  if (device) return device.name;
  for (const prefix of [DEVICE_ACCOUNT_PREFIX, LINE_ACCOUNT_PREFIX])
    if (account.name.startsWith(prefix)) return account.name.slice(prefix.length);
  return account.name;
}

/** The Official Account's own name: the account's name without "LINE · " ("" when it has none). */
export function lineOaName(account: Pick<SocialAccount, 'name'>): string {
  return account.name.startsWith(LINE_ACCOUNT_PREFIX)
    ? account.name.slice(LINE_ACCOUNT_PREFIX.length)
    : account.name;
}

// The accounts of the current workspace: the Facebook account of each paired browser (its sign-in health, the groups it
// synced), which stays in the list with its history after the browser is unbound, and the LINE Official Account a
// browser reports when it is logged in to LINE (platform 'line', named "LINE · <OA name>").
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<SocialAccount[]>([]);
  /**
   * The FACEBOOK accounts a browser posts for: the only ones that can post a Facebook link set or take a Facebook test
   * post, and what every "extension" select lists. LINE accounts are NOT in it (see `connectedLine`): a browser's LINE
   * account is not another extension.
   */
  readonly connected = computed(() =>
    this.list().filter((a) => a.connected && a.platform === 'fb'),
  );
  /** The LINE Official Accounts of the workspace (one per browser that is logged in to LINE), even when unbound. */
  readonly lineAccounts = computed(() => this.list().filter((a) => a.platform === 'line'));
  /** The LINE accounts a browser posts chats for: the only ones that can post a LINE link set. */
  readonly connectedLine = computed(() => this.lineAccounts().filter((a) => a.connected));
  /** The list for the current workspace has arrived (the schedules page waits for it). */
  readonly loaded = signal(false);

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

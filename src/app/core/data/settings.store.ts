import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiAntiBan, ApiEngine, ApiService } from '../http/api.service';
import { AccountsStore } from './accounts.store';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { PlatformKey } from './models';
import { PostsStore } from './posts.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

export interface AntiBanSettings {
  min: number;
  max: number;
  limits: Record<PlatformKey, number>;
  typing: boolean;
  scroll: boolean;
  shuffle: boolean;
  autopause: boolean;
  warmup: boolean;
  /** Workspace-wide rules over every schedule (Pro and above; the server keeps the old values below Pro). */
  advanced: AdvancedAntiBan;
}

/** The advanced anti-ban rules of the engine (hours, minutes, counts; 0 = off where a count). */
export type AdvancedAntiBan = ApiAntiBan['advanced'];

export type OfflinePolicy = 'skip' | 'queue' | 'notify';

export interface OfflineSettings {
  policy: OfflinePolicy;
  window: '30m' | '2h' | 'day';
  line: boolean;
  email: boolean;
  push: boolean;
}

/** Which billing cycle the plan cards price (the customer's own cycle comes from /api/billing). */
export interface BillingSettings {
  cycle: 'month' | 'year';
}

const PLATFORMS: PlatformKey[] = ['fb', 'x', 'ig', 'tt', 'line', 'th'];
const PRESENCE_POLL_MS = 60_000;
const DAY_MS = 864e5;
/** Events after which the connection state (online, paired devices) is read again. */
const PRESENCE_EVENTS = ['device.online', 'device.paired', 'device.revoked'];

/** The server's defaults, shown until the workspace's own settings arrive. */
export function defaultAntiBan(): AntiBanSettings {
  return {
    min: 3,
    max: 12,
    limits: { fb: 40, x: 20, ig: 10, tt: 5, line: 3, th: 10 },
    typing: true,
    scroll: true,
    shuffle: true,
    autopause: true,
    warmup: false,
    advanced: defaultAdvanced(),
  };
}

/** The server's defaults for the advanced rules. */
export function defaultAdvanced(): AdvancedAntiBan {
  return {
    minGap: 2,
    dailyAll: 0,
    blockMin: 24,
    blockMax: 48,
    failStreak: 4,
    recentAvoid: 10,
    cooldown: 0,
    focus: true,
    autoOffFails: 3,
    stopFailPct: 30,
  };
}

/** The server's default offline policy, shown until the workspace's own settings arrive. */
export function defaultOffline(): OfflineSettings {
  return { policy: 'queue', window: '2h', line: true, email: true, push: false };
}

// The posting engine's settings of the current workspace (anti-ban, offline policy) from
// /engine, edited locally and sent with saveAb()/saveOff() once they have loaded. The billing cycle toggle
// of the plan cards is local too; everything about the customer's real billing is in BillingStore.
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly posts = inject(PostsStore);
  private readonly accounts = inject(AccountsStore);

  readonly ab = signal<AntiBanSettings>(defaultAntiBan());
  readonly off = signal<OfflineSettings>(defaultOffline());
  readonly bill = signal<BillingSettings>({ cycle: 'month' });
  /** The workspace's own settings have arrived (until then `ab`/`off` hold defaults and cannot be saved). */
  readonly loaded = signal(false);
  /** Whether the workspace's extension is connected (a paired device called in, and no simulated outage). */
  readonly extensionOnline = signal(true);
  /** "Simulate offline" is on (as opposed to every paired device being offline). */
  readonly simulatedOffline = signal(false);
  readonly devices = signal(0);
  readonly devicesOnline = signal(0);

  /**
   * Posts that went out in the last 24 hours per platform on the accounts a device posts for: what the
   * server counts against the daily limits (success and posts waiting for a group admin). The sample
   * accounts and their history never count.
   */
  readonly used24h = computed(() => {
    const used = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<PlatformKey, number>;
    const connected = new Set(
      this.accounts
        .list()
        .filter((a) => a.connected)
        .map((a) => a.id),
    );
    const since = this.posts.now().getTime() - DAY_MS;
    for (const p of this.posts.posts()) {
      if (p.status !== 'success' && p.status !== 'pending') continue;
      if (!connected.has(p.accountId) || !p.publishedAt || p.publishedAt.getTime() < since)
        continue;
      used[p.platform]++;
    }
    return used;
  });

  constructor() {
    whenWorkspaceChanges((id) => {
      // Nothing of the previous workspace stays: its settings must never be saved into this one.
      this.loaded.set(false);
      this.ab.set(defaultAntiBan());
      this.off.set(defaultOffline());
      this.extensionOnline.set(true);
      this.simulatedOffline.set(false);
      this.devices.set(0);
      this.devicesOnline.set(0);
      if (id) void this.load(id);
    });
    // Devices call in every 30 s and post in the background: every minute, refresh the connection
    // state (not the settings being edited) and, when a device is paired, the posts.
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => {
        this.refreshPresence(true)
          .then(() => (this.devices() > 0 ? this.posts.refresh() : undefined))
          .catch(() => undefined);
      }, PRESENCE_POLL_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
    // Live, between those polls: a device coming online, pairing or unpairing refreshes the presence at once,
    // and a post that went out (or failed) refreshes the posts.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (PRESENCE_EVENTS.includes(e.type)) this.refreshPresence(true).catch(() => undefined);
      else if (e.type === 'post') this.posts.refresh().catch(() => undefined);
    });
    events.onResume(() => this.refreshPresence(true).catch(() => undefined));
  }

  /** Loads the workspace's settings (transient failures are retried); a stale answer is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const e = await this.api.engine(wsId);
        if (this.ws.id() === wsId) this.apply(e);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  async refreshPresence(quiet = false): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const e = await this.api.engine(wsId, quiet);
    if (this.ws.id() === wsId) this.applyPresence(e);
  }

  patchAb(patch: Partial<AntiBanSettings>): void {
    this.ab.update((v) => ({ ...v, ...patch }));
  }

  /** Changes some of the advanced rules (the others keep their values). */
  patchAdvanced(patch: Partial<AdvancedAntiBan>): void {
    this.ab.update((v) => ({ ...v, advanced: { ...v.advanced, ...patch } }));
  }

  patchOff(patch: Partial<OfflineSettings>): void {
    this.off.update((v) => ({ ...v, ...patch }));
  }

  patchBill(patch: Partial<BillingSettings>): void {
    this.bill.update((v) => ({ ...v, ...patch }));
  }

  async saveAb(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    const { autopause, ...rest } = this.ab();
    const e = await this.api.saveAntiBan(wsId, { ...rest, autoPause: autopause });
    if (this.ws.id() === wsId) this.apply(e);
  }

  async saveOff(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    const e = await this.api.saveOffline(wsId, this.off());
    if (this.ws.id() === wsId) this.apply(e);
  }

  private apply(e: ApiEngine): void {
    const { autoPause, ...rest } = e.antiBan;
    // The advanced rules always come with the settings; the defaults only guard an answer that lacks them.
    this.ab.set({
      ...rest,
      autopause: autoPause,
      advanced: { ...defaultAdvanced(), ...rest.advanced },
    });
    this.off.set({ ...e.offline, window: e.offline.window as OfflineSettings['window'] });
    this.applyPresence(e);
  }

  private applyPresence(e: ApiEngine): void {
    this.extensionOnline.set(e.extensionOnline);
    this.simulatedOffline.set(e.simulatedOffline);
    this.devices.set(e.devices);
    this.devicesOnline.set(e.devicesOnline);
  }
}

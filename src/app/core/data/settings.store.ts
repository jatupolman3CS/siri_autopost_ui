import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiEngine, ApiService } from '../http/api.service';
import { DeviceEventsService } from './device-events.service';
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
}

export type OfflinePolicy = 'skip' | 'queue' | 'notify';

export interface OfflineSettings {
  policy: OfflinePolicy;
  window: '30m' | '2h' | 'day';
  line: boolean;
  email: boolean;
  push: boolean;
}

export interface BillingSettings {
  cycle: 'month' | 'year';
  nFail: boolean;
  nExpire: boolean;
  nRenew: boolean;
  card: { last4: string; exp: string };
}

const PLATFORMS: PlatformKey[] = ['fb', 'x', 'ig', 'tt', 'line', 'th'];
const PRESENCE_POLL_MS = 60_000;

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
  };
}

// The posting engine's settings of the current workspace (anti-ban, offline policy) from
// /engine, edited locally and sent with saveAb()/saveOff(). Billing preferences stay local:
// payments are not part of the API yet.
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly posts = inject(PostsStore);

  readonly ab = signal<AntiBanSettings>(defaultAntiBan());
  readonly off = signal<OfflineSettings>({
    policy: 'queue',
    window: '2h',
    line: true,
    email: true,
    push: false,
  });
  readonly bill = signal<BillingSettings>({
    cycle: 'month',
    nFail: true,
    nExpire: true,
    nRenew: false,
    card: { last4: '4242', exp: '11/26' },
  });
  /** Whether the workspace's extension is connected (a paired device called in, and no simulated outage). */
  readonly extensionOnline = signal(true);
  /** "Simulate offline" is on (as opposed to every paired device being offline). */
  readonly simulatedOffline = signal(false);
  readonly devices = signal(0);
  readonly devicesOnline = signal(0);

  /** Posts sent today per platform, for the daily-limit bars. */
  readonly usedToday = computed(() => {
    const used = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<PlatformKey, number>;
    for (const p of this.posts.today()) if (p.status === 'success') used[p.platform]++;
    return used;
  });

  constructor() {
    whenWorkspaceChanges((id) => {
      if (id) void this.load(id);
    });
    // Devices call in every 30 s and post in the background: every minute, refresh the connection
    // state (not the settings being edited) and, when a device is paired, the posts.
    if (typeof window !== 'undefined')
      setInterval(() => {
        this.refreshPresence(true)
          .then(() => (this.devices() > 0 ? this.posts.refresh() : undefined))
          .catch(() => undefined);
      }, PRESENCE_POLL_MS);
    // Live, between those polls: a device coming online, pairing or unpairing refreshes the presence at once,
    // and a post that went out (or failed) refreshes the posts.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (['device.online', 'device.paired', 'device.revoked'].includes(e.type))
        this.refreshPresence(true).catch(() => undefined);
      else if (e.type === 'post') this.posts.refresh().catch(() => undefined);
    });
  }

  async load(wsId = this.ws.id()): Promise<void> {
    if (wsId) this.apply(await this.api.engine(wsId));
  }

  async refreshPresence(quiet = false): Promise<void> {
    const wsId = this.ws.id();
    if (wsId) this.applyPresence(await this.api.engine(wsId, quiet));
  }

  patchAb(patch: Partial<AntiBanSettings>): void {
    this.ab.update((v) => ({ ...v, ...patch }));
  }

  patchOff(patch: Partial<OfflineSettings>): void {
    this.off.update((v) => ({ ...v, ...patch }));
  }

  patchBill(patch: Partial<BillingSettings>): void {
    this.bill.update((v) => ({ ...v, ...patch }));
  }

  async saveAb(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const { autopause, ...rest } = this.ab();
    this.apply(await this.api.saveAntiBan(wsId, { ...rest, autoPause: autopause }));
  }

  async saveOff(): Promise<void> {
    const wsId = this.ws.id();
    if (wsId) this.apply(await this.api.saveOffline(wsId, this.off()));
  }

  private apply(e: ApiEngine): void {
    const { autoPause, ...rest } = e.antiBan;
    this.ab.set({ ...rest, autopause: autoPause });
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

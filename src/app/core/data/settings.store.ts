import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiAntiBan, ApiEngine, ApiService } from '../http/api.service';
import { AccountsStore } from './accounts.store';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { PostsStore } from './posts.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** How fast the extension types a post into Facebook's box (it applies the choice to every job it takes). */
export type TypingSpeed = 'slow' | 'normal' | 'fast';
export const TYPING_SPEEDS: readonly TypingSpeed[] = ['slow', 'normal', 'fast'];

/** The pause between two LINE chats, in seconds: a random time between the two numbers (the API accepts 1 to 3600 each). */
export type LineChatGap = NonNullable<ApiAntiBan['lineChat']>;

/** The platforms that have a daily limit: Facebook posts and LINE chats (each counted on its own). */
export type LimitPlatform = 'fb' | 'line';

export interface AntiBanSettings {
  min: number;
  max: number;
  /** Posts (Facebook) and chats (LINE) per 24 hours; the API's range is 1 to 500 for each. */
  limits: Record<LimitPlatform, number>;
  /** LINE chats: how long the extension waits between two chats (the minutes above are for Facebook posts). */
  lineChat: LineChatGap;
  typing: boolean;
  /** Typing speed, a Pro setting like the other behaviour switches (the server keeps the old value below Pro). */
  typingSpeed: TypingSpeed;
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

const PRESENCE_POLL_MS = 60_000;
const DAY_MS = 864e5;
/** Events after which the connection state (online, paired devices) is read again. */
const PRESENCE_EVENTS = ['device.online', 'device.paired', 'device.revoked'];

/** The server's defaults, shown until the workspace's own settings arrive. */
export function defaultAntiBan(): AntiBanSettings {
  return {
    min: 3,
    max: 12,
    limits: { fb: 40, line: 100 },
    lineChat: defaultLineChat(),
    typing: true,
    typingSpeed: 'normal',
    scroll: true,
    shuffle: true,
    autopause: true,
    warmup: false,
    advanced: defaultAdvanced(),
  };
}

/** The server's defaults for the pause between two LINE chats (45 to 120 seconds). */
export function defaultLineChat(): LineChatGap {
  return { minGapSeconds: 45, maxGapSeconds: 120 };
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
   * What went out in the last 24 hours on the accounts a device posts for, per platform: what the server counts
   * against each daily limit (success and posts waiting for a group admin). Facebook posts and LINE chats are counted
   * apart, each against its own limit.
   */
  readonly usedByPlatform = computed<Record<LimitPlatform, number>>(() => {
    const used: Record<LimitPlatform, number> = { fb: 0, line: 0 };
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
      used[p.platform === 'line' ? 'line' : 'fb']++;
    }
    return used;
  });
  /** Facebook posts of the last 24 hours (`usedByPlatform().fb`): what the Facebook limit counts. */
  readonly used24h = computed(() => this.usedByPlatform().fb);

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
    const { autoPause, typingSpeed, lineChat, limits, ...rest } = e.antiBan;
    // The advanced rules always come with the settings; the defaults only guard an answer that lacks them (and
    // a typing speed this app does not know). A server without LINE chats sends neither the LINE limit nor the gap.
    this.ab.set({
      ...rest,
      limits: { fb: limits.fb, line: limits.line ?? defaultAntiBan().limits.line },
      lineChat: { ...defaultLineChat(), ...lineChat },
      autopause: autoPause,
      typingSpeed: TYPING_SPEEDS.find((s) => s === typingSpeed) ?? 'normal',
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

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiDeviceLive, ApiDeviceLog, ApiService } from '../http/api.service';
import { applyImport, imageIdsOf, ParsedBackup } from '../ext/lib/backup.js';
import {
  Campaign,
  MediaRecord,
  Settings,
  campaignImageIds,
  migrateSettings,
  newCampaign,
  uid,
} from '../ext/lib/shared.js';
import { dataUrlToBlob, processMedia, readAsDataURL } from '../ext/media';
import { DeviceEvent, DeviceEventsService } from './device-events.service';
import { DevicesStore } from './devices.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** One campaign's run, as the extension reports it (DEFAULT_CSTATE in client/background.js). */
export interface CampaignRun {
  round?: number;
  queue?: string[];
  pos?: number;
  nextAt?: number | null;
  nextKind?: string | null;
  busy?: boolean;
  finished?: boolean;
  stats?: { ok?: number; fail?: number; skip?: number };
}

/** The extension's "state" storage key (DEFAULT_STATE in client/background.js). */
export interface RunState {
  running?: boolean;
  testing?: boolean;
  current?: { campaignId: string | null; url: string; cloud?: boolean } | null;
  campaigns?: Record<string, CampaignRun>;
  groupPostTimes?: Record<string, number[]>;
  daily?: { date?: string; count?: number; cap?: number; base?: number };
  pausedUntil?: number;
  pauseReason?: string;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** What a command sent to the device answered; error 'expired' / 'timeout' when it never ran. */
export interface CommandResult {
  ok: boolean;
  error?: string;
  [k: string]: unknown;
}

const DEVICE_KEY = 'ap-ext-device';
const CAMPAIGN_KEY = 'ap-ext-campaign';
const SAVE_DELAY_MS = 800;
/** The event stream carries state, log and commands live; this poll is only the safety net behind it. */
const FALLBACK_POLL_MS = 60_000;
const RETRY_MS = 5000;
/** While waiting for a command's answer, ask the server this often in case the stream is down. */
const COMMAND_POLL_MS = 5000;
const COMMAND_TIMEOUT_MS = 120_000;
/** Log lines kept on the page (what /live returns). */
const LOG_LINES = 200;
/** Error message of importParsed when the imported settings could not be saved yet. */
export const SAVE_FAILED = 'save-failed';

// The extension's own campaigns of one paired browser (the same settings as its settings page),
// edited here and synced by the extension within ~30 s. Edits save on their own a moment after the
// last change, against the revision they started from: when the device (or another page) saved in
// between, the server answers 409 and the newer settings are loaded instead (the same "server wins"
// rule the extension follows). Media is stored on the server under the extension's own ids.
@Injectable({ providedIn: 'root' })
export class CampaignsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly devices = inject(DevicesStore);
  private readonly events = inject(DeviceEventsService);

  /** The browser whose campaigns are shown; null when none is paired. */
  readonly deviceId = signal<string | null>(readStored(DEVICE_KEY));
  readonly device = computed(
    () => this.devices.list().find((d) => d.id === this.deviceId()) ?? null,
  );
  readonly settings = signal<Settings | null>(null);
  readonly revision = signal(0);
  readonly updatedByDevice = signal(false);
  readonly loading = signal(false);
  readonly saveState = signal<SaveState>('idle');
  /** Set when a save hit 409 and newer settings were loaded instead. */
  readonly reloadedAt = signal<number | null>(null);
  readonly live = signal<ApiDeviceLive | null>(null);
  readonly currentId = signal<string | null>(readStored(CAMPAIGN_KEY));

  /** Bumped on every in-place edit, so views re-read the mutable settings object. */
  private readonly tick = signal(0);
  readonly campaigns = computed(
    () => {
      this.tick();
      return this.settings()?.campaigns ?? [];
    },
    { equal: () => false },
  );
  readonly campaign = computed(
    () => {
      const list = this.campaigns();
      return list.find((c) => c.id === this.currentId()) ?? list[0] ?? null;
    },
    { equal: () => false },
  );
  readonly global = computed(
    () => {
      this.tick();
      return this.settings()?.global ?? null;
    },
    { equal: () => false },
  );
  readonly state = computed<RunState>(() => (this.live()?.state as RunState | null) ?? {});
  readonly logs = computed<ApiDeviceLog[]>(() => this.live()?.logs ?? []);
  readonly running = computed(() => !!this.state().running);
  readonly busy = computed(() => !!this.state().current);

  /** imageId -> object URL; and which of them are videos. */
  readonly thumbs = signal<Record<string, string>>({});
  readonly videos = signal<Record<string, boolean>>({});
  private readonly thumbLoads = new Set<string>();

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private watchers = 0;
  private unsubEvents: (() => void) | null = null;
  private unsubResume: (() => void) | null = null;
  /** Commands sent from this page, waiting for the device's answer (by command id). */
  private readonly commandWaits = new Map<
    string,
    (status: string, result: CommandResult | null) => void
  >();

  constructor() {
    whenWorkspaceChanges(() => this.reset());
  }

  // ---------- device and loading ----------

  /** Picks the remembered device, or the first one, once the device list is in. */
  ensureDevice(): void {
    const list = this.devices.list();
    if (!list.length) return;
    const id = this.deviceId();
    if (!id || !list.some((d) => d.id === id)) void this.selectDevice(list[0].id);
    else if (!this.settings() && !this.loading()) void this.load();
  }

  async selectDevice(id: string): Promise<void> {
    await this.flush();
    this.deviceId.set(id);
    store(DEVICE_KEY, id);
    this.settings.set(null);
    this.live.set(null);
    await Promise.all([this.load(), this.refreshLive()]);
  }

  async load(): Promise<void> {
    const ws = this.ws.id();
    const device = this.deviceId();
    if (!ws || !device) return;
    this.loading.set(true);
    try {
      const cfg = await this.api.extConfig(ws, device);
      if (this.ws.id() !== ws || this.deviceId() !== device) return;
      const s = migrateSettings(cfg.settings ?? null);
      if (!s.campaigns.length) s.campaigns.push(newCampaign(1));
      this.settings.set(s);
      this.revision.set(cfg.revision);
      this.updatedByDevice.set(cfg.updatedByDevice);
      this.saveState.set('idle');
      if (!s.campaigns.some((c) => c.id === this.currentId())) this.select(s.campaigns[0].id);
      this.bump();
      for (const c of s.campaigns) this.loadThumbs(campaignImageIds(c));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Follows the device's state and log while a page shows them; returns the stop function. The workspace's
   * event stream delivers changes as they happen (and a reconnect reloads everything); a slow poll stays
   * behind it in case the stream is down.
   */
  watch(): () => void {
    this.watchers++;
    if (!this.liveTimer) {
      void this.refreshLive();
      this.liveTimer = setInterval(() => void this.refreshLive(), FALLBACK_POLL_MS);
      this.unsubEvents = this.events.subscribe((e) => this.onEvent(e));
      this.unsubResume = this.events.onResume(() => void this.refreshLive());
    }
    return () => {
      if (--this.watchers > 0) return;
      if (this.liveTimer) clearInterval(this.liveTimer);
      this.liveTimer = null;
      this.unsubEvents?.();
      this.unsubEvents = null;
      this.unsubResume?.();
      this.unsubResume = null;
      void this.flush();
    };
  }

  /** Applies one event of the shown device to the live view (DeviceEventType in the API for the payloads). */
  private onEvent(e: DeviceEvent): void {
    if (e.deviceId !== this.deviceId()) return;
    const p = e.payload;
    const seen = <T extends ApiDeviceLive>(l: T): T => ({ ...l, online: true, lastSeenAt: e.at });
    switch (e.type) {
      case 'device.state':
        this.live.update(
          (l) =>
            l && {
              ...seen(l),
              state: p['state'] as ApiDeviceLive['state'],
              stateAt: p['at'] as string,
            },
        );
        break;
      case 'device.log': {
        if (p['truncated']) {
          void this.refreshLive();
          break;
        }
        const lines = (p['lines'] as ApiDeviceLog[] | undefined) ?? [];
        this.live.update((l) => l && { ...seen(l), logs: [...l.logs, ...lines].slice(-LOG_LINES) });
        break;
      }
      case 'device.log_cleared':
        this.live.update((l) => l && { ...l, logs: [] });
        break;
      case 'device.online':
        this.live.update((l) => l && seen(l));
        break;
      case 'device.config': {
        const revision = p['revision'] as number;
        this.live.update((l) => l && { ...l, revision });
        // The device (or another page) saved newer settings: show them unless edits are on the way.
        if (revision > this.revision() && !this.unsaved() && !this.saving) void this.load();
        break;
      }
      case 'device.command': {
        const wait = this.commandWaits.get(p['id'] as string);
        if (wait) wait(p['status'] as string, (p['result'] as CommandResult | null) ?? null);
        break;
      }
    }
  }

  async refreshLive(): Promise<void> {
    const ws = this.ws.id();
    const device = this.deviceId();
    if (!ws || !device) return;
    try {
      const live = await this.api.deviceLive(ws, device, true);
      if (this.ws.id() !== ws || this.deviceId() !== device) return;
      this.live.set(live);
      // The device (or another page) saved newer settings: show them unless edits are on the way.
      if (live.revision > this.revision() && !this.unsaved() && !this.saving) await this.load();
    } catch {
      // Shown as offline by the page; the next poll tries again.
    }
  }

  // ---------- editing ----------

  select(id: string | null): void {
    this.currentId.set(id);
    store(CAMPAIGN_KEY, id ?? '');
  }

  /** Runs an in-place edit of the settings and saves it shortly after. */
  change(edit?: (s: Settings) => void): void {
    const s = this.settings();
    if (!s) return;
    edit?.(s);
    this.bump();
    this.saveState.set('dirty');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.later(SAVE_DELAY_MS);
  }

  /** Saves pending edits now (waits for a save in progress). */
  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    while (this.saving) await this.saving;
    if (this.saveState() !== 'dirty') return;
    this.saving = this.save().finally(() => (this.saving = null));
    await this.saving;
  }

  private async save(): Promise<void> {
    const ws = this.ws.id();
    const device = this.deviceId();
    const s = this.settings();
    if (!ws || !device || !s) return;
    this.saveState.set('saving');
    try {
      const r = await this.api.saveExtConfig(ws, device, s, this.revision());
      this.revision.set(r.revision);
      this.updatedByDevice.set(false);
      // Edited again while saving: another save follows.
      if (this.saveState() === 'saving') this.saveState.set('saved');
      else if (!this.saveTimer) this.later(SAVE_DELAY_MS);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        this.saveState.set('idle');
        await this.load();
        this.reloadedAt.set(Date.now());
        return;
      }
      // Server unreachable or refused: the page shows it, and the edits go up again shortly.
      this.saveState.set('error');
      this.saveTimer = setTimeout(() => {
        if (this.saveState() !== 'error') return;
        this.saveState.set('dirty');
        void this.flush();
      }, RETRY_MS);
    }
  }

  /** Edits not on the server yet (waiting, or a failed save waiting for its retry). */
  readonly unsaved = computed(() => ['dirty', 'error'].includes(this.saveState()));

  private later(ms: number): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), ms);
  }

  addCampaign(): Campaign {
    const c = newCampaign(this.campaigns().length + 1);
    this.change((s) => s.campaigns.push(c));
    this.select(c.id);
    return c;
  }

  /** A copy with new ids, switched off (media is shared, so nothing is copied on the server). */
  duplicateCampaign(src: Campaign): Campaign {
    const copy: Campaign = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.enabled = false;
    for (const p of copy.posts) p.id = uid();
    this.change((s) => s.campaigns.splice(s.campaigns.indexOf(src) + 1, 0, copy));
    this.select(copy.id);
    return copy;
  }

  deleteCampaign(c: Campaign): void {
    let next: string | null = null;
    this.change((s) => {
      const i = s.campaigns.indexOf(c);
      s.campaigns.splice(i, 1);
      next = s.campaigns[Math.max(0, i - 1)]?.id ?? null;
    });
    this.select(next);
  }

  /** Replaces all settings (import), keeping the revision the page started from. */
  replaceSettings(next: Settings): void {
    this.change((s) => {
      s.global = next.global;
      s.campaigns = next.campaigns;
      if (!s.campaigns.length) s.campaigns.push(newCampaign(1));
    });
    for (const c of next.campaigns) this.loadThumbs(campaignImageIds(c));
  }

  // ---------- media ----------

  /** Processes and uploads files; returns the new ids in order (failed files are skipped and counted). */
  async addMedia(files: File[]): Promise<{ ids: string[]; failed: string[] }> {
    const ws = this.ws.id();
    const ids: string[] = [];
    const failed: string[] = [];
    if (!ws) return { ids, failed };
    for (const f of files) {
      try {
        const rec = await processMedia(f);
        const id = uid();
        await this.api.putExtImage(ws, id, rec);
        this.setThumb(id, dataUrlToBlob(rec.data));
        ids.push(id);
      } catch {
        failed.push(f.name);
      }
    }
    return { ids, failed };
  }

  /** Uploads records under the given ids (imports). */
  async putMedia(records: Record<string, MediaRecord>): Promise<number> {
    const ws = this.ws.id();
    if (!ws) return 0;
    let n = 0;
    for (const [id, rec] of Object.entries(records)) {
      await this.api.putExtImage(ws, id, rec);
      this.setThumb(id, dataUrlToBlob(rec.data));
      n++;
    }
    return n;
  }

  /** The stored records of these ids (exports); ids the server lacks are left out. */
  async mediaRecords(ids: string[]): Promise<Record<string, MediaRecord>> {
    const ws = this.ws.id();
    const out: Record<string, MediaRecord> = {};
    if (!ws) return out;
    for (const id of ids) {
      try {
        const blob = await this.api.extImage(ws, id);
        out[id] = { name: id, type: blob.type, data: await readAsDataURL(blob) };
      } catch {
        // Missing on the server: the export goes without it.
      }
    }
    return out;
  }

  loadThumbs(ids: string[]): void {
    const ws = this.ws.id();
    if (!ws) return;
    for (const id of ids) {
      if (this.thumbLoads.has(id)) continue;
      this.thumbLoads.add(id);
      this.api.extImage(ws, id).then(
        (blob) => this.setThumb(id, blob),
        () => this.thumbLoads.delete(id),
      );
    }
  }

  private setThumb(id: string, blob: Blob): void {
    this.thumbLoads.add(id);
    const old = this.thumbs()[id];
    if (old) URL.revokeObjectURL(old);
    this.thumbs.update((t) => ({ ...t, [id]: URL.createObjectURL(blob) }));
    this.videos.update((v) => ({ ...v, [id]: blob.type.startsWith('video/') }));
  }

  // ---------- import ----------

  /**
   * Applies an uploaded backup or SIRI export (client/lib/backup.js applyImport): 'replace' swaps everything
   * (keeping this device's Telegram when the file has no Bot Token), 'merge' adds the file's campaigns with
   * new ids. Media is uploaded first; returns the counts for the message.
   */
  async importParsed(
    parsed: Pick<ParsedBackup, 'settings' | 'images'>,
    mode: 'replace' | 'merge',
  ): Promise<{ missingImages: number; firstId: string | null }> {
    const current = this.settings();
    if (!current) return { missingImages: 0, firstId: null };
    const existing = new Set(imageIdsOf(current.campaigns));
    const res = applyImport(current, parsed, mode, existing);
    if (res.copyImages.length) {
      const have = await this.mediaRecords(res.copyImages.map(([from]) => from));
      for (const [from, to] of res.copyImages) if (have[from]) res.writeImages[to] = have[from];
    }
    await this.putMedia(res.writeImages);
    const added = parsed.settings.campaigns.length;
    this.replaceSettings(res.settings);
    const list = this.campaigns();
    const first = mode === 'merge' && added ? list[list.length - added] : list[0];
    this.select(first?.id ?? null);
    await this.flush();
    // Kept on the page and retried, but the caller must not report success.
    if (this.saveState() === 'error') throw new Error(SAVE_FAILED);
    return { missingImages: res.missingImages, firstId: first?.id ?? null };
  }

  // ---------- commands ----------

  /**
   * Sends a button press to the device and waits (up to ~2 minutes) for its answer. The device holds a sync
   * open on the server, so it usually answers within seconds; the answer comes back on the event stream, with
   * a slow poll behind it. One nobody takes within 10 minutes expires.
   */
  async command(cmd: string, args: object = {}): Promise<CommandResult> {
    const ws = this.ws.id();
    const device = this.deviceId();
    if (!ws || !device) return { ok: false, error: 'no-device' };
    await this.flush();
    const sent = await this.api.sendDeviceCommand(ws, device, cmd, args);
    return new Promise<CommandResult>((resolve) => {
      let done = false;
      const finish = (r: CommandResult): void => {
        if (done) return;
        done = true;
        this.commandWaits.delete(sent.id);
        clearInterval(poll);
        clearTimeout(limit);
        resolve(r);
      };
      const settle = (status: string, result: CommandResult | null): void => {
        if (status === 'done') {
          void this.refreshLive(); // the state after the command (the stream brings it too)
          finish(result ?? { ok: true });
        } else if (status === 'expired') finish({ ok: false, error: 'expired' });
      };
      this.commandWaits.set(sent.id, settle);
      const poll = setInterval(() => {
        void this.api
          .deviceCommand(ws, device, sent.id)
          .then((c) => settle(c.status, (c.result as CommandResult | null) ?? null))
          .catch(() => undefined);
      }, COMMAND_POLL_MS);
      const limit = setTimeout(() => finish({ ok: false, error: 'timeout' }), COMMAND_TIMEOUT_MS);
    });
  }

  async clearLogs(): Promise<void> {
    const ws = this.ws.id();
    const device = this.deviceId();
    if (!ws || !device) return;
    await this.api.clearDeviceLogs(ws, device);
    this.live.update((l) => (l ? { ...l, logs: [] } : l));
  }

  private bump(): void {
    this.tick.update((n) => n + 1);
  }

  private reset(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    for (const url of Object.values(this.thumbs())) URL.revokeObjectURL(url);
    this.thumbs.set({});
    this.videos.set({});
    this.thumbLoads.clear();
    this.settings.set(null);
    this.live.set(null);
    this.revision.set(0);
    this.saveState.set('idle');
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembered for this visit only.
  }
}

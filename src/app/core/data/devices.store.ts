import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiDevice, ApiPairingCode, ApiService } from '../http/api.service';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** Events that change what the device list shows: presence, pairing, a rename or a pause. */
const DEVICE_EVENTS = ['device.online', 'device.paired', 'device.revoked', 'device.updated'];
/** The event stream keeps the list fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;
/** An automatic pause ends without any event: the clock it is compared with moves this often. */
const CLOCK_MS = 30_000;

/** The engine's own pause of a browser while it lasts (Facebook blocked it, or its posts kept failing), else null. */
export function autoPauseOf(
  d: Pick<ApiDevice, 'autoPausedUntil' | 'autoPauseReason'>,
  now: Date,
): { until: Date; reason: string } | null {
  if (!d.autoPausedUntil) return null;
  const until = new Date(d.autoPausedUntil);
  return until.getTime() > now.getTime() ? { until, reason: d.autoPauseReason ?? '' } : null;
}

// Browsers with the extension paired to the current workspace, and the pairing code flow.
@Injectable({ providedIn: 'root' })
export class DevicesStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<ApiDevice[]>([]);
  readonly loaded = signal(false);
  /** The current time, moved every 30 s (a pause the engine put on a browser runs out by itself). */
  readonly now = signal(new Date());
  /** The browsers the engine has paused itself right now (a Facebook block, posts that kept failing). */
  readonly autoPaused = computed(() =>
    this.list().flatMap((device) => {
      const pause = autoPauseOf(device, this.now());
      return pause ? [{ device, ...pause }] : [];
    }),
  );

  constructor() {
    whenWorkspaceChanges((id) => {
      this.list.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
    // Live: online dots, new and removed devices follow the event stream.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (DEVICE_EVENTS.includes(e.type)) void this.refresh();
    });
    events.onResume(() => void this.refresh());
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => {
        if (!events.connected()) void this.refresh();
      }, FALLBACK_POLL_MS);
      const clock = setInterval(() => this.now.set(new Date()), CLOCK_MS);
      inject(DestroyRef).onDestroy(() => {
        clearInterval(timer);
        clearInterval(clock);
      });
    }
  }

  /** Loads the list (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.devices(wsId);
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
      const list = await this.api.devices(wsId, true);
      if (this.ws.id() === wsId) {
        this.list.set(list);
        this.loaded.set(true);
      }
    } catch {
      // The next event or poll tries again.
    }
  }

  /** A 10-minute code for the extension to trade (fails when the plan has no device left). */
  async createPairingCode(): Promise<ApiPairingCode | null> {
    const wsId = this.ws.id();
    return wsId ? this.api.createPairingCode(wsId) : null;
  }

  /** Renames a browser (its Facebook account follows) or pauses the posts it takes from the web. */
  async update(id: string, patch: { name?: string; jobsPaused?: boolean }): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const d = await this.api.updateDevice(wsId, id, patch);
    this.list.update((l) => l.map((x) => (x.id === id ? d : x)));
  }

  async revoke(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    await this.api.revokeDevice(wsId, id);
    this.list.update((l) => l.filter((d) => d.id !== id));
  }
}

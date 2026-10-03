import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiDevice, ApiDeviceLive, ApiDeviceLog, ApiService } from '../http/api.service';
import { DeviceEvent, DeviceEventsService } from './device-events.service';
import { DevicesStore } from './devices.store';
import { WorkspaceStore } from './workspace.store';

/** Log lines kept (what /live returns). */
const LOG_LINES = 200;
/** The event stream delivers changes as they happen; this poll is only the safety net behind it. */
const FALLBACK_POLL_MS = 60_000;

// What one paired browser is doing right now: its reported state and log lines (/devices/{id}/live), kept
// current by the workspace's event stream while a page watches it. The extension popup preview shows it.
@Injectable({ providedIn: 'root' })
export class DeviceLiveStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly devices = inject(DevicesStore);
  private readonly events = inject(DeviceEventsService);

  /** The browser picked on a page; until then the first one that is online (else the first). */
  readonly chosen = signal<string | null>(null);
  readonly device = computed<ApiDevice | null>(() => {
    const list = this.devices.list();
    return (
      list.find((d) => d.id === this.chosen()) ?? list.find((d) => d.online) ?? list[0] ?? null
    );
  });
  readonly live = signal<ApiDeviceLive | null>(null);
  readonly logs = computed<ApiDeviceLog[]>(() => this.live()?.logs ?? []);

  private watchers = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsubResume: (() => void) | null = null;

  constructor() {
    // Another browser (or workspace) shown: start from nothing, then fetch it.
    effect(() => {
      const id = this.device()?.id ?? null;
      untracked(() => {
        this.live.set(null);
        if (id && this.watchers > 0) void this.refresh();
      });
    });
  }

  select(id: string): void {
    this.chosen.set(id);
  }

  /** Follows the shown browser until the returned function is called (several pages may watch at once). */
  watch(): () => void {
    if (this.watchers++ === 0) {
      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), FALLBACK_POLL_MS);
      this.unsubscribe = this.events.subscribe((e) => this.onEvent(e));
      this.unsubResume = this.events.onResume(() => void this.refresh());
    }
    return () => {
      if (--this.watchers > 0) return;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.unsubscribe?.();
      this.unsubResume?.();
      this.unsubscribe = this.unsubResume = null;
    };
  }

  async refresh(): Promise<void> {
    const ws = this.ws.id();
    const id = this.device()?.id;
    if (!ws || !id) return;
    try {
      const live = await this.api.deviceLive(ws, id, true);
      if (this.device()?.id === id) this.live.set(live);
    } catch {
      // Shown as nothing yet; the next poll tries again.
    }
  }

  /** Applies one event of the shown browser (DeviceEventType in the API describes the payloads). */
  private onEvent(e: DeviceEvent): void {
    if (e.deviceId !== this.device()?.id) return;
    const p = e.payload;
    const seen = (l: ApiDeviceLive): ApiDeviceLive => ({ ...l, online: true, lastSeenAt: e.at });
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
          void this.refresh();
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
    }
  }
}

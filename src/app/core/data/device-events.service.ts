import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { tokenStorage } from '../auth/token';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** One event of the workspace's stream (DeviceEventDto; types and payloads in DeviceEventType). */
export interface DeviceEvent {
  seq: number;
  deviceId: string;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

export type DeviceEventHandler = (e: DeviceEvent) => void;

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;
/** The server pings every 15 s; this long without a byte means the connection is dead. */
const STALL_MS = 45_000;

// The workspace's live event stream (Server-Sent Events over fetch, so the bearer token travels in a header).
// Stores subscribe while a page shows a device; the service keeps one connection per workspace, reconnects
// with backoff and jitter when it drops, and asks the server for everything after the last Seq it saw, so a
// lost connection loses no event. Stores keep a slow poll as a fallback and refresh when `connected` flips.
@Injectable({ providedIn: 'root' })
export class DeviceEventsService {
  private readonly ws = inject(WorkspaceStore);

  /** True while the stream is open. Flips to false on a drop; stores refetch when it comes back. */
  readonly connected = signal(false);
  /** Seq of the last event received (0 before the first). */
  readonly lastSeq = signal(0);
  /** How many times the stream has been (re)opened; for the admin health view and debugging. */
  readonly reconnects = signal(0);

  private readonly handlers = new Set<DeviceEventHandler>();
  private readonly resumeHandlers = new Set<() => void>();
  private wsId: string | null = null;
  private abort: AbortController | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private generation = 0;

  constructor() {
    whenWorkspaceChanges((id) => this.switchTo(id));
    if (typeof document !== 'undefined') {
      const onVisible = (): void => {
        // A tab coming back may have had its stream killed silently: reconnect now instead of at the next ping.
        if (document.visibilityState === 'visible' && this.handlers.size && !this.connected())
          this.reconnectNow();
      };
      document.addEventListener('visibilitychange', onVisible);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisible);
        this.handlers.clear();
        this.stop();
      });
    }
  }

  /** Receives every event of the current workspace; returns the unsubscribe function. */
  subscribe(handler: DeviceEventHandler): () => void {
    this.handlers.add(handler);
    this.ensure();
    return () => {
      this.handlers.delete(handler);
      if (!this.handlers.size) this.stop();
    };
  }

  /** Called after the stream (re)connects: the subscriber should refetch what it shows. */
  onResume(fn: () => void): () => void {
    this.resumeHandlers.add(fn);
    return () => this.resumeHandlers.delete(fn);
  }

  private switchTo(id: string | null): void {
    if (id === this.wsId) return;
    this.stop();
    this.wsId = id;
    this.lastSeq.set(0);
    this.ensure();
  }

  private ensure(): void {
    if (!this.handlers.size || !this.wsId || this.abort || this.retryTimer) return;
    void this.run(++this.generation);
  }

  private stop(): void {
    this.generation++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.abort?.abort();
    this.abort = null;
    this.connected.set(false);
  }

  private reconnectNow(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.abort?.abort();
    this.abort = null;
    this.ensure();
  }

  private async run(gen: number): Promise<void> {
    const wsId = this.wsId;
    if (!wsId) return;
    const ctrl = new AbortController();
    this.abort = ctrl;
    let gotAnything = false;
    try {
      const token = tokenStorage.get();
      const after = this.lastSeq();
      const url = `/api/workspaces/${wsId}/events/stream${after ? `?after=${after}` : ''}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(after ? { 'Last-Event-ID': String(after) } : {}),
        },
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) return; // not ours: stop for good
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      this.attempt = 0;
      this.reconnects.update((n) => n + 1);
      this.connected.set(true);
      // Anything that happened while we were away: reload, the stream fills in the rest from `after`.
      if (after === 0 || this.reconnects() > 1) for (const fn of this.resumeHandlers) fn();
      await this.read(res.body, ctrl, gen, () => (gotAnything = true));
    } catch {
      // dropped, or aborted below
    } finally {
      if (this.abort === ctrl) this.abort = null;
    }
    if (gen !== this.generation) return; // stopped or switched workspace meanwhile
    this.connected.set(false);
    if (!this.handlers.size) return;
    // A stream that lived a while reconnects at once; one that failed right away backs off.
    const delay = gotAnything
      ? RETRY_MIN_MS
      : Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** Math.min(this.attempt++, 5)) *
        (0.7 + Math.random() * 0.6);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ensure();
    }, delay);
  }

  private async read(
    body: ReadableStream<Uint8Array>,
    ctrl: AbortController,
    gen: number,
    touched: () => void,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stall = setTimeout(() => ctrl.abort(), STALL_MS);
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done || gen !== this.generation) return;
        clearTimeout(stall);
        stall = setTimeout(() => ctrl.abort(), STALL_MS);
        touched();
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          if (this.dispatch(block) === 'reconnect') return; // server asks us to come back (rotate/shutdown/backlog)
        }
      }
    } finally {
      clearTimeout(stall);
      reader.releaseLock();
    }
  }

  /** Parses one SSE block; returns 'reconnect' when the server ends the stream on purpose. */
  private dispatch(block: string): 'event' | 'reconnect' | 'other' {
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!event) return 'other'; // ping or retry hint
    if (event === 'reconnect') return 'reconnect';
    if (event === 'ready') {
      try {
        const head = (JSON.parse(data) as { head?: number }).head;
        if (typeof head === 'number' && !this.lastSeq()) this.lastSeq.set(head);
      } catch {
        // ignore
      }
      return 'other';
    }
    let e: DeviceEvent;
    try {
      e = JSON.parse(data) as DeviceEvent;
    } catch {
      return 'other';
    }
    if (e.seq <= this.lastSeq()) return 'other'; // a repeat around a reconnect
    this.lastSeq.set(e.seq);
    for (const h of this.handlers) {
      try {
        h(e);
      } catch (err) {
        console.warn('[events] handler', err);
      }
    }
    return 'event';
  }
}

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { dkey, hm } from '../i18n/format';
import { Dict } from '../i18n/i18n.service';
import { ApiPost, ApiScheduleRequest, ApiService } from '../http/api.service';
import { loadWithRetry } from './loading';
import { ErrorItem, PostItem, STATUS_DOT } from './models';
import { PLATFORMS } from './platforms';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** What a queue/list row shows for one post. */
export interface PostRow {
  id: string;
  time: string;
  icon: string;
  platformName: string;
  text: string;
  target: string;
  dot: string;
  statusLabel: string;
}

/** A post or an error report as one calendar/queue item. */
export interface QueueItem extends PostItem {
  key: string;
  time: string;
}

export function toItem(p: ApiPost): PostItem {
  return {
    id: p.id,
    dt: new Date(p.scheduledAt),
    accountId: p.accountId,
    platform: p.platform,
    target: p.target,
    text: p.content,
    mediaIds: p.mediaIds,
    status: p.status,
    code: p.failureCode ?? null,
    detail: p.failureDetail,
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
  };
}

export function withDay(p: PostItem): QueueItem {
  return { ...p, key: dkey(p.dt), time: hm(p.dt) };
}

export function postRow(p: PostItem, t: Dict): PostRow {
  const platform = PLATFORMS[p.platform];
  return {
    id: p.id,
    time: hm(p.dt),
    icon: platform.icon,
    platformName: platform.name,
    text: p.text,
    target: p.target,
    dot: STATUS_DOT[p.status],
    statusLabel: t.status[p.status],
  };
}

/** Posts grouped by local day key, each day sorted by time. */
export function groupByDay(items: QueueItem[]): Map<string, QueueItem[]> {
  const map = new Map<string, QueueItem[]>();
  for (const p of items) {
    const list = map.get(p.key) ?? [];
    list.push(p);
    map.set(p.key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.dt.getTime() - b.dt.getTime());
  return map;
}

const monthKey = (y: number, m: number) => `${y}-${m}`;

// Posting tasks (queue and history) and open error reports of the current workspace.
// Posts load a calendar month at a time: the months around today first, then whichever
// month the calendar shows (ensureMonth). Every change re-reads the loaded months.
@Injectable({ providedIn: 'root' })
export class PostsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  /** The current minute; ticks so "next post in N min" and today's queue stay fresh. */
  readonly now = signal(minuteNow());
  readonly todayKey = computed(() => dkey(this.now()));

  private readonly _posts = signal<PostItem[]>([]);
  private readonly _errors = signal<ErrorItem[]>([]);
  private monthsLoaded = new Set<string>();

  /** The months around today and the error reports of the current workspace have arrived. */
  readonly loaded = signal(false);
  readonly posts = this._posts.asReadonly();
  /** Open error reports (failed, or held for group approval), newest first. */
  readonly errors = this._errors.asReadonly();
  /** Errors that need action (approval-pending posts are only waiting on admins). */
  readonly openErrors = computed(() => this._errors().filter((e) => e.code !== 'pending_approval'));

  readonly items = computed<QueueItem[]>(() => this._posts().map(withDay));
  readonly byDay = computed(() => groupByDay(this.items()));
  readonly today = computed(() => this.byDay().get(this.todayKey()) ?? []);
  readonly waiting = computed(() =>
    this._posts()
      .filter((p) => p.status === 'waiting')
      .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
  );
  /** Next queued post after now. */
  readonly next = computed(() =>
    this.today().find((p) => p.status === 'queued' && p.dt > this.now()),
  );

  constructor() {
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => this.now.set(minuteNow()), 30_000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
    whenWorkspaceChanges((id) => {
      this.monthsLoaded = new Set();
      this._posts.set([]);
      this._errors.set([]);
      this.loaded.set(false);
      if (id) void this.loadInitial(id);
    });
  }

  /** The months around today and the errors; transient failures are retried, then `loaded` is set. */
  private async loadInitial(wsId: string): Promise<void> {
    const n = this.now();
    const ok = await loadWithRetry(
      async () => {
        await Promise.all([
          ...[-1, 0, 1].map((d) => this.ensureMonth(n.getFullYear(), n.getMonth() + d)),
          this.loadErrors(),
        ]);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  row(p: PostItem, t: Dict): PostRow {
    return postRow(p, t);
  }

  /** Loads one calendar month (m may be out of 0..11; it is normalized). Rejects when the API does. */
  async ensureMonth(y: number, m: number, force = false): Promise<void> {
    const wsId = this.ws.id();
    const from = new Date(y, m, 1);
    const key = monthKey(from.getFullYear(), from.getMonth());
    if (!wsId || (!force && this.monthsLoaded.has(key))) return;
    this.monthsLoaded.add(key);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    try {
      const list = (await this.api.posts(wsId, from, to)).map(toItem);
      if (this.ws.id() !== wsId) return;
      this._posts.update((ps) =>
        ps
          .filter((p) => p.dt < from || p.dt >= to)
          .concat(list)
          .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
      );
    } catch (e) {
      this.monthsLoaded.delete(key);
      throw e;
    }
  }

  /** Re-reads every loaded month and the error reports; a failure leaves what is shown (and is toasted). */
  async refresh(): Promise<void> {
    const months = [...this.monthsLoaded].map((k) => k.split('-').map(Number));
    await Promise.allSettled([
      ...months.map(([y, m]) => this.ensureMonth(y, m, true)),
      this.loadErrors(),
    ]);
  }

  async schedule(body: ApiScheduleRequest): Promise<number> {
    const wsId = this.requireWs();
    const r = await this.api.schedule(wsId, body);
    await this.refresh();
    return r.created;
  }

  async remove(id: string): Promise<void> {
    await this.api.deletePost(this.requireWs(), id);
    this._posts.update((ps) => ps.filter((p) => p.id !== id));
  }

  /** Puts a failed post back in the queue, 15 minutes from now. */
  async retryError(id: string): Promise<void> {
    await this.api.retry(this.requireWs(), id);
    await this.refresh();
  }

  /** Closes an error report (a failed post becomes skipped). */
  async skipError(id: string): Promise<void> {
    await this.api.dismiss(this.requireWs(), id);
    await this.refresh();
  }

  private async loadErrors(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const list = await this.api.errors(wsId);
    if (this.ws.id() !== wsId) return;
    this._errors.set(
      list.map((p) => {
        const item = toItem(p);
        return { ...item, code: item.code ?? 'network' };
      }),
    );
  }

  private requireWs(): string {
    const id = this.ws.id();
    if (!id) throw new Error('No workspace selected');
    return id;
  }
}

function minuteNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

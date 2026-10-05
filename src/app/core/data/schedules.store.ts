import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { normalizeTimes, utcOffsetMinutes } from '../flow/schedule-math';
import { ApiSaveSchedule, ApiSchedule, ApiScheduleCreated, ApiService } from '../http/api.service';
import { CollectionsStore } from './collections.store';
import { DeviceEventsService } from './device-events.service';
import { LinkSetsStore } from './link-sets.store';
import { loadWithRetry } from './loading';
import { PostsStore } from './posts.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** Events after which the figures of a schedule (today's posts, its next run) have moved. */
const SCHEDULE_EVENTS = ['post'];
/** A burst of events (several posts settling together) is answered by one read. */
const EVENT_REFRESH_MS = 1500;
/** The event stream keeps the schedules fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;
/** Best hours read this recently are not asked for again (they move slowly: they come from 30 days). */
const BEST_FRESH_MS = 10 * 60_000;

// Schedules ("ตารางโพสต์") of the current workspace: a collection paired with a link set and posting times. The
// server turns each active schedule into ordinary queued posts 14 days ahead, so everything that changes a
// schedule also changes the queue (PostsStore) and the "used by N schedules" counts of the collections and link
// sets; those are read again after every change. Reading is for every role, every change is an editor's.
//
// Nothing here is optimistic: creating, pausing and resuming make the server write or drop posts, so the list
// shows what the server answered. A button that is busy (`isBusy`) is disabled until its request ends.
@Injectable({ providedIn: 'root' })
export class SchedulesStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly posts = inject(PostsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);

  readonly schedules = signal<ApiSchedule[]>([]);
  /** The workspace's schedules have arrived (pages show "—" until then). */
  readonly loaded = signal(false);
  /** Schedules with a pause, resume or delete on its way. */
  readonly busy = signal<ReadonlySet<string>>(new Set());

  /** Schedules that are switched on (a paused one, or a "once" that has run, is not). */
  readonly activeCount = computed(() => this.schedules().filter((s) => s.active).length);
  /** Posts the schedules have today, in each schedule's own local day. */
  readonly todayCount = computed(() => this.schedules().reduce((n, s) => n + s.todayCount, 0));

  /**
   * The hours that went best in this workspace (`HH:00`, at most three; null: not asked yet, [] none or still
   * asking). They come from this workspace's posts, so they empty with it and never show in another one.
   */
  readonly best = signal<string[] | null>(null);
  private bestAt = 0;
  /** Counts the reads and workspace changes: an answer that is not the latest read is dropped. */
  private bestSeq = 0;

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    whenWorkspaceChanges((id) => {
      this.clearTimer();
      this.schedules.set([]);
      this.busy.set(new Set());
      this.loaded.set(false);
      this.best.set(null);
      this.bestAt = 0;
      this.bestSeq++;
      if (id) void this.load(id);
    });
    // Live: a post settling moves today's count and the next run.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (SCHEDULE_EVENTS.includes(e.type)) this.scheduleRefresh();
    });
    events.onResume(() => void this.refresh());
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => this.clearTimer());
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => {
        if (!events.connected()) void this.refresh();
      }, FALLBACK_POLL_MS);
      destroy.onDestroy(() => clearInterval(timer));
    }
  }

  // ---------- reading ----------

  /** Loads the schedules (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.schedules(wsId);
        if (this.ws.id() === wsId) this.schedules.set(list);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** A quiet re-read for live updates and page visits: a failure leaves the list as it is. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    try {
      const list = await this.api.schedules(wsId, true);
      if (this.ws.id() === wsId) {
        this.schedules.set(list);
        this.loaded.set(true);
      }
    } catch {
      // The next event, poll or visit tries again.
    }
  }

  byId(id: string | null | undefined): ApiSchedule | undefined {
    return id ? this.schedules().find((s) => s.id === id) : undefined;
  }

  /** The schedules that post from a collection. */
  usingCollection(collectionId: string): ApiSchedule[] {
    return this.schedules().filter((s) => s.collectionId === collectionId);
  }

  /** The schedules that post to a link set. */
  usingLinkSet(linkSetId: string): ApiSchedule[] {
    return this.schedules().filter((s) => s.linkSetId === linkSetId);
  }

  namesUsingCollection(collectionId: string): string[] {
    return this.usingCollection(collectionId).map((s) => s.name);
  }

  namesUsingLinkSet(linkSetId: string): string[] {
    return this.usingLinkSet(linkSetId).map((s) => s.name);
  }

  isBusy(id: string): boolean {
    return this.busy().has(id);
  }

  /**
   * The hours (`HH:00`, at most three) with the most posts that went out in the last 30 days, in this browser's
   * time zone. A failure gives none (and shows no toast): the suggestion is a hint, not something to stop for.
   */
  async bestTimes(): Promise<string[]> {
    return (await this.readBest(this.ws.id())) ?? [];
  }

  /**
   * Fills `best` for the current workspace unless it was read lately (the schedule builder calls this each time
   * it opens). A failed read leaves `best` empty and is tried again the next time. An answer that arrives after
   * the workspace changed is dropped.
   */
  async askBest(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    if (this.best() !== null && Date.now() - this.bestAt < BEST_FRESH_MS) return;
    const seq = ++this.bestSeq;
    this.bestAt = Date.now();
    if (this.best() === null) this.best.set([]);
    const hours = await this.readBest(wsId);
    if (seq !== this.bestSeq || this.ws.id() !== wsId) return;
    if (hours === null) this.bestAt = 0;
    this.best.set(hours ?? []);
  }

  /** The hours the API gives, or null when it could not be read. */
  private async readBest(wsId: string | null): Promise<string[] | null> {
    if (!wsId) return null;
    try {
      return normalizeTimes(await this.api.bestTimes(wsId, utcOffsetMinutes()));
    } catch {
      return null;
    }
  }

  // ---------- changes ----------

  /**
   * Creates the schedule; the server queues its posts (14 days ahead, one day for "once"). Rejects when the API
   * refuses (no connected Facebook account, nothing to post, no usable group: 422 with the reason).
   */
  async create(body: ApiSaveSchedule): Promise<ApiScheduleCreated> {
    const wsId = this.requireWs();
    const created = await this.api.createSchedule(wsId, body);
    if (this.ws.id() === wsId) {
      this.schedules.update((l) => [
        ...l.filter((s) => s.id !== created.schedule.id),
        created.schedule,
      ]);
      await this.changed();
    }
    return created;
  }

  /**
   * Pauses (the server drops its future queued posts) or resumes (it queues them again) a schedule. Resolves to
   * the schedule as the server has it now; rejects when the API refuses and leaves the schedule as it was.
   */
  async setActive(id: string, active: boolean): Promise<ApiSchedule | null> {
    const wsId = this.requireWs();
    this.mark(id, true);
    try {
      const saved = await this.api.setScheduleActive(wsId, id, active);
      if (this.ws.id() !== wsId) return saved;
      this.schedules.update((l) => l.map((s) => (s.id === id ? saved : s)));
      await this.changed();
      return saved;
    } finally {
      this.mark(id, false);
    }
  }

  /** Renames a schedule; nothing else about it changes. Rejects when the API refuses. */
  async rename(id: string, name: string): Promise<void> {
    const wsId = this.requireWs();
    this.mark(id, true);
    try {
      const saved = await this.api.renameSchedule(wsId, id, name);
      if (this.ws.id() !== wsId) return;
      this.schedules.update((l) => l.map((s) => (s.id === id ? saved : s)));
    } finally {
      this.mark(id, false);
    }
  }

  /** Deletes a schedule and its future queued posts (posts already sent stay in the history). */
  async remove(id: string): Promise<void> {
    const wsId = this.requireWs();
    this.mark(id, true);
    try {
      await this.api.deleteSchedule(wsId, id);
      if (this.ws.id() !== wsId) return;
      this.schedules.update((l) => l.filter((s) => s.id !== id));
      await this.changed();
    } finally {
      this.mark(id, false);
    }
  }

  // ---------- internals ----------

  /** What a change to a schedule moves elsewhere: the queue and the "used by" counts. None of these rejects. */
  private changed(): Promise<unknown> {
    return Promise.all([this.posts.refresh(), this.collections.refresh(), this.linkSets.refresh()]);
  }

  private mark(id: string, on: boolean): void {
    this.busy.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, EVENT_REFRESH_MS);
  }

  private clearTimer(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private requireWs(): string {
    const id = this.ws.id();
    if (!id) throw new Error('No workspace selected');
    return id;
  }
}

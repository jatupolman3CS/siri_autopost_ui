import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { composeFull, linkLabel, postComposeSettings, seededRandom } from '../flow';
import { ApiPost, ApiService, ApiTestPost } from '../http/api.service';
import { problemMessage } from '../http/problem-details';
import '../i18n/i18n.engine';
import { I18nService } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
import { AccountsStore } from './accounts.store';
import { CollectionsStore } from './collections.store';
import { DevicesStore, autoPauseOf } from './devices.store';
import { DeviceEventsService } from './device-events.service';
import { LinkSetsStore, isActiveLink } from './link-sets.store';
import { ErrorCode } from './models';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** The post is read again this often while it is followed (events wake it earlier). */
export const TEST_POLL_MS = 3000;
/** After this long the page stops following and says the extension has not answered. */
export const TEST_FOLLOW_MS = 180_000;

/** What the progress log can say about the test post. */
export type TestLogKind =
  'queued' | 'waiting' | 'posting' | 'success' | 'pending' | 'failed' | 'skipped' | 'late';

export interface TestLogEntry {
  kind: TestLogKind;
  /** When the page saw it (the time it went out for a success). */
  at: Date;
  /** Why it failed (failed only). */
  code: ErrorCode | null;
  /** What the extension or the server reported (failed and skipped). */
  detail: string | null;
}

/** Why the test cannot start ('' = it can). */
export type TestBlock = '' | 'offline' | 'noAccount' | 'needPick' | 'noPosts';

/** One target of a link set the test can go to: a group link (with its code) or another account of the set. */
export interface TestMember {
  key: string;
  label: string;
  linkId: string | null;
  accountId: string | null;
  code: string;
}

/** Statuses after which nothing changes any more. */
const FINAL: ReadonlySet<TestLogKind> = new Set<TestLogKind>([
  'success',
  'pending',
  'failed',
  'skipped',
]);

/** The states of a post that get a line in the log (the others, none, never reach a test post). */
const LOGGED: ReadonlySet<string> = new Set<TestLogKind>([
  'queued',
  'waiting',
  'posting',
  'success',
  'pending',
  'failed',
  'skipped',
]);

const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The test post page: one real post to a group, due now, and the real story of that post. The form (link set,
// group, collection, post, optional text) is kept here so a run that takes minutes survives leaving the page.
// "Random" picks the post here (a seeded random, so the preview shows the text that will be sent) and the
// request names it. After the API accepts the post, it is followed by id: a `post` event of the stream wakes
// a re-read of its day, a 3 s poll covers a missed event, and the log gets a line for every state change
// (queued, posting, posted / failed / awaiting approval / skipped). Nothing is invented: the extension
// reports the result, and after 3 minutes without one the log says it is still waiting.
@Injectable({ providedIn: 'root' })
export class TestPostStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly settings = inject(SettingsStore);
  private readonly devices = inject(DevicesStore);
  private readonly posts = inject(PostsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  // ---------- the form ----------
  private readonly setPick = signal('');
  private readonly groupPick = signal('');
  private readonly colPick = signal('');
  private readonly postPick = signal('');
  /** The text that replaces the post's own (blank = the post's). */
  readonly text = signal('');
  /** Seeds the spintax of the preview and the "random" pick; "reshuffle" and every finished run move it. */
  readonly seed = signal(1);

  /** The link set tested: the chosen one, else the first with a group to post to, else the first. */
  readonly setId = computed(() => {
    const sets = this.linkSets.sets();
    return (
      sets.find((s) => s.id === this.setPick())?.id ??
      (sets.find((s) => s.links.some(isActiveLink)) ?? sets[0])?.id ??
      ''
    );
  });
  private readonly set = computed(() => this.linkSets.sets().find((s) => s.id === this.setId()));

  /** The groups of the set a test can go to (switched on, a real address), then its other connected accounts. */
  readonly members = computed<TestMember[]>(() => {
    const set = this.set();
    if (!set) return [];
    const links = set.links.filter(isActiveLink).map((l) => {
      const code = l.code.trim();
      return {
        key: 'link:' + l.id,
        label: linkLabel(l) + (code ? ` (${code})` : ''),
        linkId: l.id,
        accountId: null,
        code,
      };
    });
    const others = set.accountIds.flatMap((id) => {
      const a = this.accounts.byId(id);
      return a?.connected
        ? [
            {
              key: 'account:' + id,
              label: `${a.name} · ${a.defaultTarget}`,
              linkId: null,
              accountId: id,
              code: '',
            },
          ]
        : [];
    });
    return [...links, ...others];
  });
  readonly member = computed(
    () => this.members().find((m) => m.key === this.groupPick()) ?? this.members()[0] ?? null,
  );

  /** The collection tested: the chosen one, else the first with a post to use, else the first. */
  readonly collectionId = computed(() => {
    const list = this.collectionsStore.collections();
    return (
      list.find((c) => c.id === this.colPick())?.id ??
      (list.find((c) => this.collectionsStore.usablePosts(c).length) ?? list[0])?.id ??
      ''
    );
  });
  readonly collection = computed(() => this.collectionsStore.byId(this.collectionId()));
  /** The posts a test can use (approved ones when the collection asks for approval). */
  readonly usablePosts = computed(() => {
    const c = this.collection();
    return c ? this.collectionsStore.usablePosts(c) : [];
  });
  /** The post picked in the list, or '' for "random". */
  readonly postId = computed(() => {
    const id = this.postPick();
    return this.usablePosts().some((p) => p.id === id) ? id : '';
  });
  /** The post that will be sent: the picked one, else a random one (the same until the seed moves). */
  readonly post = computed(() => {
    const list = this.usablePosts();
    const id = this.postId();
    if (id) return list.find((p) => p.id === id) ?? null;
    if (!list.length) return null;
    const rnd = seededRandom(this.seed() * 7919 + 13);
    rnd();
    return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
  });

  /** What the test says: the typed text, else the post's. */
  readonly body = computed(() => this.text().trim() || this.post()?.text || '');
  /** The text as the engine writes it for the chosen group (code, footer, hashtags, spintax resolved). */
  readonly composed = computed(() => {
    const body = this.body();
    const member = this.member();
    if (!body || !member) return body;
    // The picked post's own footer, hashtags and footer position win over the collection's.
    const settings = postComposeSettings(this.collection()?.settings, this.post()?.settings);
    return composeFull(body, member.code, settings, seededRandom(this.seed()));
  });
  /** Files that go with it: the chosen post's media (the server attaches them whatever text is typed). */
  readonly files = computed(() => this.post()?.mediaIds.length ?? 0);

  /** Why the run button is off ('' = it is on). */
  readonly block = computed<TestBlock>(() => {
    if (!this.settings.extensionOnline()) return 'offline';
    if (
      this.accounts.loaded() &&
      !this.accounts.list().some((a) => a.connected && a.platform === 'fb')
    )
      return 'noAccount';
    if (!this.member()) return 'needPick';
    if (!this.body()) return 'noPosts';
    return '';
  });
  /** Every paired browser has its jobs paused (by hand or by the engine): a test post waits for it. */
  readonly paused = computed(() => {
    const now = this.devices.now();
    const list = this.devices.list();
    return list.length > 0 && list.every((d) => d.jobsPaused || autoPauseOf(d, now) !== null);
  });

  // ---------- the run ----------
  /** The post is sent or followed: the button says "posting…" and stays off. */
  readonly running = signal(false);
  /** The API refused the test (the Thai reason). */
  readonly runError = signal('');
  readonly log = signal<TestLogEntry[]>([]);
  /** The workspace's test posts, newest first (the history card shows the latest five). */
  readonly history = computed(() =>
    this.posts
      .items()
      .filter((p) => p.isTest)
      .sort((a, b) => b.dt.getTime() - a.dt.getTime())
      .slice(0, 5),
  );

  private target: { wsId: string; id: string; day: Date } | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private reading = false;
  private readAgain = false;

  constructor() {
    whenWorkspaceChanges(() => {
      this.stop();
      this.setPick.set('');
      this.groupPick.set('');
      this.colPick.set('');
      this.postPick.set('');
      this.text.set('');
      this.seed.set(1);
      this.running.set(false);
      this.runError.set('');
      this.log.set([]);
    });
    // The extension reports through the stream: a `post` event of the test post wakes a re-read at once.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (e.type === 'post' && this.target && e.payload['postId'] === this.target.id)
        void this.check();
    });
    events.onResume(() => void this.check());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  // ---------- picking ----------
  pickSet(id: string): void {
    this.setPick.set(id);
    this.groupPick.set('');
  }
  pickGroup(key: string): void {
    this.groupPick.set(key);
  }
  pickCollection(id: string): void {
    this.colPick.set(id);
    this.postPick.set('');
  }
  pickPost(id: string): void {
    this.postPick.set(id);
  }
  /** Picks other spintax words and, for "random", another post. */
  reshuffle(): void {
    this.seed.update((n) => n + 1);
  }

  // ---------- running ----------
  /** Sends the test post and follows it until the extension reports (or three minutes pass). */
  async run(): Promise<void> {
    const wsId = this.ws.id();
    const member = this.member();
    if (!wsId || !member || this.running() || this.block()) return;
    const body: ApiTestPost = {
      linkSetId: this.setId(),
      linkId: member.linkId,
      accountId: member.accountId,
      collectionId: this.collectionId(),
      collectionPostId: this.post()?.id ?? null,
      text: this.text().trim() || null,
    };
    this.stop();
    this.running.set(true);
    this.runError.set('');
    this.log.set([]);
    let post: ApiPost;
    try {
      post = await this.api.testPost(wsId, body);
    } catch (e) {
      if (this.ws.id() === wsId) {
        this.runError.set(problemMessage(e) ?? this.i18n.t().api.serverDown);
        this.running.set(false);
      }
      return;
    }
    if (this.ws.id() !== wsId) return;
    // The new post shows in the history (and the calendar) at once.
    void this.posts.refresh();
    this.target = { wsId, id: post.id, day: dayOf(new Date(post.scheduledAt)) };
    this.deadline = setTimeout(() => this.giveUp(), TEST_FOLLOW_MS);
    this.pollTimer = setInterval(() => void this.check(), TEST_POLL_MS);
    this.apply(post);
  }

  /** Reads the followed post's day again (one read at a time; one more when an event came meanwhile). */
  private async check(): Promise<void> {
    const target = this.target;
    if (!target) return;
    if (this.reading) {
      this.readAgain = true;
      return;
    }
    this.reading = true;
    try {
      const to = new Date(
        target.day.getFullYear(),
        target.day.getMonth(),
        target.day.getDate() + 1,
      );
      const list = await this.api.posts(target.wsId, target.day, to, true);
      if (this.target !== target) return;
      const post = list.find((p) => p.id === target.id);
      if (post) this.apply(post);
    } catch {
      // The next tick or event reads again; the timeout ends it when the API stays away.
    } finally {
      this.reading = false;
    }
    if (this.readAgain && this.target === target) {
      this.readAgain = false;
      void this.check();
    }
  }

  /** Adds a log line when the post's state changed, and ends the run on a final state. */
  private apply(post: ApiPost): void {
    if (!LOGGED.has(post.status)) return;
    const kind = post.status as TestLogKind;
    const last = this.log().at(-1);
    if (last?.kind !== kind) {
      this.log.update((l) => [
        ...l,
        {
          kind,
          at: kind === 'success' && post.publishedAt ? new Date(post.publishedAt) : new Date(),
          code: kind === 'failed' ? (post.failureCode ?? 'network') : null,
          detail: kind === 'failed' || kind === 'skipped' ? post.failureDetail : null,
        },
      ]);
    }
    if (FINAL.has(kind)) this.finish(this.log().at(-1)!);
  }

  private finish(last: TestLogEntry): void {
    const wsId = this.target?.wsId;
    this.stop();
    this.running.set(false);
    // Another random post (and other spintax words) for "test again".
    this.reshuffle();
    if (wsId && this.ws.id() === wsId) void this.posts.refresh();
    const t = this.i18n.t();
    const a = t.api.engine;
    if (last.kind === 'success') this.notify.success(t.test.done);
    else if (last.kind === 'pending') this.notify.info(a.testPending);
    else if (last.kind === 'skipped') this.notify.info(a.testSkipped);
    else if (last.kind === 'failed')
      this.notify.error(`${a.testFailed}: ${t.reasons[last.code ?? 'network'].title}`);
  }

  /** Three minutes and no report: stop following; the result still shows in the history when it comes. */
  private giveUp(): void {
    if (!this.target) return;
    this.stop();
    this.running.set(false);
    this.log.update((l) => [...l, { kind: 'late', at: new Date(), code: null, detail: null }]);
    this.notify.info(this.i18n.t().api.engine.testStillWaiting);
  }

  private stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.deadline) clearTimeout(this.deadline);
    this.pollTimer = null;
    this.deadline = null;
    this.target = null;
    this.reading = false;
    this.readAgain = false;
  }
}

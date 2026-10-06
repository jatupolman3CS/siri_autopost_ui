import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { composeFull, facebookTarget, linkLabel, postComposeSettings, seededRandom } from '../flow';
import {
  ApiDevice,
  ApiManualTestPost,
  ApiPost,
  ApiService,
  ApiTestPost,
} from '../http/api.service';
import { problemMessage } from '../http/problem-details';
import '../i18n/i18n.engine';
import { I18nService } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
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
/** The API takes at most this many library images on a hand-made test post. */
export const TEST_MAX_MEDIA = 10;

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

/** The two ways to test: from a collection and a link set, or by hand (a link, a text and images typed in). */
export type TestPanel = 'set' | 'manual';

/**
 * Why the test cannot start ('' = it can): no extension is connected (`noDevice`), none is online (`offline`), the
 * chosen one is offline while others are not (`deviceDown`); the link set form has no group (`needPick`) or no post
 * (`noPosts`); the hand-made one has no link (`needUrl`), a link that is no group or page (`badUrl`) or no text.
 */
export type TestBlock =
  | ''
  | 'noDevice'
  | 'offline'
  | 'deviceDown'
  | 'needPick'
  | 'noPosts'
  | 'needUrl'
  | 'badUrl'
  | 'needText';

/** One place of a link set the test can go to: a group or page link (with its code). */
export interface TestMember {
  key: string;
  label: string;
  linkId: string;
  code: string;
  kind: 'group' | 'page';
}

/** How an extension is doing: what the picker shows next to its name. */
export type DeviceState = 'online' | 'offline' | 'paused';

/** Online, offline, or online but taking no jobs (paused by hand or by the engine). */
export function deviceStateOf(d: ApiDevice, now: Date): DeviceState {
  if (!d.online) return 'offline';
  return d.jobsPaused || autoPauseOf(d, now) !== null ? 'paused' : 'online';
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

// The test post page: one real post to a group or page, due now, through one extension, and the real story of that
// post. Two ways to start it share the log and the follow-up: from a link set + collection (`run`: the set, group or
// page, collection, post and an optional text) or by hand (`runManual`: a link, a text and library images typed in,
// no collection or link set). The form is kept here so a run that takes minutes survives leaving the page.
// "Random" picks the post here (a seeded random, so the preview shows the text that will be sent) and the request
// names it. The extension that receives the test is chosen too (`deviceId`): by default the one the link set posts
// as, else the first one that is online. After the API accepts the post, it is followed by id: a `post` event of
// the stream wakes a re-read of its day, a 3 s poll covers a missed event, and the log gets a line for every state
// change (queued, posting, posted / failed / awaiting approval / skipped). Nothing is invented: the extension
// reports the result, and after 3 minutes without one the log says it is still waiting.
@Injectable({ providedIn: 'root' })
export class TestPostStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly settings = inject(SettingsStore);
  private readonly devices = inject(DevicesStore);
  private readonly posts = inject(PostsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  /** Which of the two forms is shown (and which one `block` speaks about). */
  readonly panel = signal<TestPanel>('set');

  // ---------- the extension that receives the test ----------
  private readonly devicePick = signal('');
  /** Every extension of the workspace, for the picker. */
  readonly deviceList = this.devices.list;
  /** The extension list has arrived (until then nothing can be said about "no extension"). */
  readonly devicesLoaded = this.devices.loaded;
  /**
   * The extension the test goes through: the chosen one; else (link set panel) the one the link set posts as; else
   * the first one that is online; else the first one. '' when no extension is connected.
   */
  readonly deviceId = computed(() => {
    const list = this.devices.list();
    const picked = list.find((d) => d.id === this.devicePick());
    if (picked) return picked.id;
    const account = this.panel() === 'set' ? this.set()?.postAsAccountId : null;
    const named = account ? list.find((d) => d.accountId === account) : undefined;
    return (named ?? list.find((d) => d.online) ?? list[0])?.id ?? '';
  });
  readonly device = computed(
    () => this.devices.list().find((d) => d.id === this.deviceId()) ?? null,
  );
  /** Online, offline or paused for every extension (by id), as the picker shows them. */
  readonly deviceStates = computed(() => {
    const now = this.devices.now();
    return new Map(this.devices.list().map((d) => [d.id, deviceStateOf(d, now)]));
  });

  // ---------- the form of the link set panel ----------
  /** The link sets and collections have arrived (until then the preview says "—"). */
  readonly setsLoaded = computed(() => this.linkSets.loaded() && this.collectionsStore.loaded());
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

  /** The groups and pages of the set a test can go to (switched on, a real address). */
  readonly members = computed<TestMember[]>(() => {
    const set = this.set();
    if (!set) return [];
    return set.links.filter(isActiveLink).map((l) => {
      const code = l.code.trim();
      return {
        key: 'link:' + l.id,
        label: linkLabel(l) + (code ? ` (${code})` : ''),
        linkId: l.id,
        code,
        kind: l.kind === 'page' ? ('page' as const) : ('group' as const),
      };
    });
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

  // ---------- the form of the hand-made panel ----------
  /** The group or page address typed in. */
  readonly manualUrl = signal('');
  /** The text typed in (the server resolves its spintax and `{{code}}`; no footer or hashtags are added). */
  readonly manualText = signal('');
  /** Library files picked to go with it (at most `TEST_MAX_MEDIA`). */
  readonly manualMedia = signal<string[]>([]);
  /** What the typed address is: a group or a page and its standard address, or null when it is neither. */
  readonly manualTarget = computed(() => {
    const t = facebookTarget(this.manualUrl());
    return t ? { kind: t.kind, url: t.url } : null;
  });
  /** The typed text as the server will write it (one possible spin; no code, no footer, no hashtags). */
  readonly manualComposed = computed(() => {
    const text = this.manualText().trim();
    return text ? composeFull(text, '', null, seededRandom(this.seed())) : '';
  });

  // ---------- what keeps a test from starting ----------
  /** The extension side of it, the same for both panels. */
  private readonly deviceBlock = computed<TestBlock>(() => {
    if (this.devices.loaded() && this.devices.list().length === 0) return 'noDevice';
    if (!this.settings.extensionOnline()) return 'offline';
    const d = this.device();
    if (d && !d.online) return 'deviceDown';
    return '';
  });
  /** Why the link set test cannot start. */
  readonly blockSet = computed<TestBlock>(() => {
    const device = this.deviceBlock();
    if (device) return device;
    if (!this.member()) return 'needPick';
    if (!this.body()) return 'noPosts';
    return '';
  });
  /** Why the hand-made test cannot start. */
  readonly blockManual = computed<TestBlock>(() => {
    const device = this.deviceBlock();
    if (device) return device;
    if (!this.manualUrl().trim()) return 'needUrl';
    if (!this.manualTarget()) return 'badUrl';
    if (!this.manualText().trim()) return 'needText';
    return '';
  });
  /** Why the run button of the panel being shown is off ('' = it is on). */
  readonly block = computed<TestBlock>(() =>
    this.panel() === 'set' ? this.blockSet() : this.blockManual(),
  );
  /** The chosen extension has its jobs paused (by hand or by the engine): a test post waits for it. */
  readonly paused = computed(() => {
    const d = this.device();
    return !!d && this.deviceStates().get(d.id) === 'paused';
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
      this.panel.set('set');
      this.devicePick.set('');
      this.setPick.set('');
      this.groupPick.set('');
      this.colPick.set('');
      this.postPick.set('');
      this.text.set('');
      this.manualUrl.set('');
      this.manualText.set('');
      this.manualMedia.set([]);
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
  pickPanel(panel: TestPanel): void {
    if (panel === this.panel()) return;
    this.panel.set(panel);
    this.runError.set('');
  }
  pickDevice(id: string): void {
    this.devicePick.set(id);
  }
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
  /** Puts a library file in or out of the hand-made test (at most `TEST_MAX_MEDIA`). */
  toggleManualMedia(id: string): void {
    this.manualMedia.update((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < TEST_MAX_MEDIA
          ? [...ids, id]
          : ids,
    );
  }
  /** Picks files that were just uploaded (as many as still fit). */
  addManualMedia(ids: readonly string[]): void {
    this.manualMedia.update((list) =>
      [...list, ...ids.filter((id) => !list.includes(id))].slice(0, TEST_MAX_MEDIA),
    );
  }

  // ---------- running ----------
  /** Sends the test from the link set form and follows it until the extension reports (or three minutes pass). */
  async run(): Promise<void> {
    const wsId = this.ws.id();
    const member = this.member();
    if (!wsId || !member || this.running() || this.blockSet()) return;
    const body: ApiTestPost = {
      linkSetId: this.setId(),
      linkId: member.linkId,
      accountId: null,
      collectionId: this.collectionId(),
      collectionPostId: this.post()?.id ?? null,
      text: this.text().trim() || null,
      deviceId: this.deviceId() || null,
    };
    await this.send(wsId, () => this.api.testPost(wsId, body));
  }

  /** Sends the hand-made test (a link, a text, library images) and follows it exactly like `run`. */
  async runManual(): Promise<void> {
    const wsId = this.ws.id();
    const target = this.manualTarget();
    if (!wsId || !target || this.running() || this.blockManual()) return;
    const body: ApiManualTestPost = {
      url: target.url,
      text: this.manualText().trim(),
      mediaIds: [...this.manualMedia()],
      deviceId: this.deviceId() || null,
    };
    await this.send(wsId, () => this.api.testPostManual(wsId, body));
  }

  /** Sends one test post and follows it: the log starts with what the API answered. */
  private async send(wsId: string, request: () => Promise<ApiPost>): Promise<void> {
    this.stop();
    this.running.set(true);
    this.runError.set('');
    this.log.set([]);
    let post: ApiPost;
    try {
      post = await request();
    } catch (e) {
      if (this.ws.id() === wsId) {
        this.runError.set(problemMessage(e) ?? this.i18n.t().api.serverDown);
        this.running.set(false);
      }
      return;
    }
    this.follow(wsId, post);
  }

  /** Follows a test post the API accepted: events and a poll read it again until it ends or three minutes pass. */
  private follow(wsId: string, post: ApiPost): void {
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

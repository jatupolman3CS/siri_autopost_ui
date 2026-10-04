import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ACCOUNTS,
  WS,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { apiCollection } from '../../testing/collection-fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  APPROVAL_COLLECTION,
  FB,
  OTHER_ACCOUNT,
  POSTS_URL,
  TEST_COLLECTION,
  TEST_POST_URL,
  TEST_SET,
  device,
  flushBackground,
  testPostDto,
} from '../../testing/test-post.fixtures';
import { ApiPost } from '../http/api.service';
import { I18nService } from '../i18n/i18n.service';
import '../i18n/i18n.engine';
import { NotificationService } from '../services/notification.service';
import { AccountsStore } from './accounts.store';
import { DeviceEventsService } from './device-events.service';
import { SettingsStore } from './settings.store';
import { TEST_FOLLOW_MS, TEST_POLL_MS, TestPostStore } from './test-post.store';
import { WorkspaceStore } from './workspace.store';

const HOUR = 3600e3;
const span = (r: HttpRequest<unknown>) =>
  new Date(r.params.get('to')!).getTime() - new Date(r.params.get('from')!).getTime();

describe('TestPostStore', () => {
  let http: HttpTestingController;
  let store: TestPostStore;
  let events: FakeDeviceEvents;
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const t = () => TestBed.inject(I18nService).t();

  async function start(
    opts: {
      collections?: (typeof TEST_COLLECTION)[];
      sets?: (typeof TEST_SET)[];
      accounts?: typeof ACCOUNTS;
      posts?: ApiPost[];
      devices?: ReturnType<typeof device>[];
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(TestPostStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, {
      linkSets: opts.sets ?? [TEST_SET],
      collections: opts.collections ?? [TEST_COLLECTION, APPROVAL_COLLECTION],
      devices: opts.devices ?? [device()],
      posts: opts.posts ?? [],
    });
    TestBed.inject(AccountsStore).list.set(opts.accounts ?? [...ACCOUNTS, FB, OTHER_ACCOUNT]);
  }

  /** Reads of one day (the followed post) and of whole months (the posts store refreshing). */
  const dayReads = () => http.match((r) => r.url === POSTS_URL && span(r) <= 26 * HOUR);
  function refreshReads(posts: ApiPost[] = []): void {
    for (const r of http.match((x) => x.url === POSTS_URL && span(x) > 26 * HOUR)) {
      const from = new Date(r.request.params.get('from')!);
      const to = new Date(r.request.params.get('to')!);
      r.flush(posts.filter((p) => new Date(p.scheduledAt) >= from && new Date(p.scheduledAt) < to));
    }
    for (const r of http.match((x) => x.url.endsWith('/errors'))) r.flush([]);
  }
  const kinds = () => store.log().map((e) => e.kind);

  /** Lets promises run, answers the background reads, and lets their answers land. */
  async function quiet(): Promise<void> {
    await settle();
    flushBackground(http);
    await settle();
  }

  /** Sends the test (the API accepts it as `dto`) and lets the page-side follow-up begin. */
  async function run(dto: ApiPost = testPostDto()): Promise<void> {
    const sent = store.run();
    http.expectOne(TEST_POST_URL).flush(dto);
    await sent;
    await settle();
    refreshReads([dto]);
    await quiet();
  }

  /** Answers the next read of the followed post's day with the post in `status`. */
  async function answer(over: Partial<ApiPost>): Promise<void> {
    const reads = dayReads();
    expect(reads.length).toBeGreaterThan(0);
    for (const r of reads) r.flush([testPostDto(over)]);
    await settle();
    refreshReads([testPostDto(over)]);
    await quiet();
  }

  afterEach(() => {
    vi.useRealTimers();
    try {
      refreshReads();
      flushBackground(http);
      dayReads().forEach((r) => r.flush([]));
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  describe('the form', () => {
    beforeEach(() => start());

    it('starts on the first set with a group to post to and lists its usable groups, with codes', () => {
      expect(store.setId()).toBe('s1');
      // Switched-off and wrongly addressed links are left out; the set's other connected account follows.
      expect(store.members().map((m) => m.label)).toEqual([
        'Condo BKK (#Jan24)',
        'Condo rent',
        'Facebook · Laptop · โปรไฟล์',
      ]);
      expect(store.members().map((m) => m.key)).toEqual(['link:a', 'link:b', 'account:acc-other']);
      expect(store.member()?.key).toBe('link:a');
    });

    it('leaves out other accounts of the set that no browser posts for', async () => {
      TestBed.inject(AccountsStore).list.set([...ACCOUNTS, FB]);
      expect(store.members().map((m) => m.key)).toEqual(['link:a', 'link:b']);
    });

    it('goes back to the first group when another set is picked', () => {
      store.pickGroup('link:b');
      expect(store.member()?.key).toBe('link:b');
      store.pickSet('s1');
      expect(store.member()?.key).toBe('link:a');
    });

    it('offers only the posts a schedule could use, and "random" counts them', () => {
      expect(store.collectionId()).toBe('c1');
      expect(store.usablePosts().map((p) => p.id)).toEqual(['p1', 'p2']);
      store.pickCollection('c2');
      expect(store.usablePosts().map((p) => p.id)).toEqual(['t2']);
    });

    it('starts on the first collection that has a post to use', async () => {
      TestBed.resetTestingModule();
      await start({ collections: [apiCollection({ id: 'empty' }), TEST_COLLECTION] });
      expect(store.collectionId()).toBe('c1');
    });

    it('composes the picked post for the picked group: code, footer and hashtags', () => {
      store.pickPost('p1');
      expect(store.composed()).toBe('ขายคอนโด #Jan24\n\nLINE @shop\n#condo');
      expect(store.files()).toBe(2);
      // A group without a code gets the text as it is.
      store.pickGroup('link:b');
      expect(store.composed()).toBe('ขายคอนโด \n\nLINE @shop\n#condo');
    });

    it('lets typed text replace the post text, and still attaches the post media (as the server does)', () => {
      store.pickPost('p1');
      store.pickGroup('link:b');
      store.text.set('  ทดสอบ  ');
      expect(store.composed()).toBe('ทดสอบ\n\nLINE @shop\n#condo');
      expect(store.files()).toBe(2);
    });

    it('picks one random post and keeps it until the person reshuffles', () => {
      const first = store.post()!.id;
      expect(['p1', 'p2']).toContain(first);
      expect(store.post()!.id).toBe(first);
      const seen = new Set([first]);
      for (let i = 0; i < 30; i++) {
        store.reshuffle();
        seen.add(store.post()!.id);
      }
      expect([...seen].sort()).toEqual(['p1', 'p2']);
      expect(store.files()).toBe(store.post()!.mediaIds.length);
    });

    it('says why a test cannot start', () => {
      expect(store.block()).toBe('');
      TestBed.inject(SettingsStore).extensionOnline.set(false);
      expect(store.block()).toBe('offline');
      TestBed.inject(SettingsStore).extensionOnline.set(true);
      TestBed.inject(AccountsStore).list.set(ACCOUNTS);
      expect(store.block()).toBe('noAccount');
      TestBed.inject(AccountsStore).list.set([...ACCOUNTS, FB]);
      expect(store.block()).toBe('');
    });

    it('needs a post or a typed text', async () => {
      TestBed.resetTestingModule();
      await start({ collections: [apiCollection({ id: 'empty' })] });
      expect(store.block()).toBe('noPosts');
      store.text.set('hello');
      expect(store.block()).toBe('');
    });

    it('needs a group', async () => {
      TestBed.resetTestingModule();
      await start({ sets: [] });
      expect(store.block()).toBe('needPick');
    });

    it('knows when every paired browser has its jobs paused, by hand or by the engine', async () => {
      expect(store.paused()).toBe(false);
      TestBed.resetTestingModule();
      await start({ devices: [device({ jobsPaused: true })] });
      expect(store.paused()).toBe(true);
      TestBed.resetTestingModule();
      await start({
        devices: [
          device({
            autoPausedUntil: new Date(Date.now() + HOUR).toISOString(),
            autoPauseReason: 'x',
          }),
        ],
      });
      expect(store.paused()).toBe(true);
      TestBed.resetTestingModule();
      await start({
        devices: [
          device({ autoPausedUntil: new Date(Date.now() - HOUR).toISOString() }),
          device({ id: 'd2' }),
        ],
      });
      expect(store.paused()).toBe(false);
    });
  });

  describe('running', () => {
    beforeEach(async () => {
      await start();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });

    it('sends the chosen group, collection and post, and starts the log with "queued"', async () => {
      store.pickGroup('link:b');
      store.pickPost('p2');
      const sent = store.run();
      expect(store.running()).toBe(true);
      const req = http.expectOne(TEST_POST_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        linkSetId: 's1',
        linkId: 'b',
        accountId: null,
        collectionId: 'c1',
        collectionPostId: 'p2',
        text: null,
      });
      req.flush(testPostDto());
      await sent;
      await settle();
      refreshReads();
      expect(kinds()).toEqual(['queued']);
      expect(store.running()).toBe(true);
      expect(store.runError()).toBe('');
    });

    it('names the client-picked random post and a typed text, and posts to another account with its id', async () => {
      store.pickGroup('account:acc-other');
      store.text.set(' my text ');
      const picked = store.post()!.id;
      const sent = store.run();
      const req = http.expectOne(TEST_POST_URL);
      expect(req.request.body).toEqual({
        linkSetId: 's1',
        linkId: null,
        accountId: 'acc-other',
        collectionId: 'c1',
        collectionPostId: picked,
        text: 'my text',
      });
      req.flush(testPostDto());
      await sent;
      await settle();
      refreshReads();
    });

    it('does nothing while a test is running, when it is blocked, or before anything is chosen', async () => {
      TestBed.inject(SettingsStore).extensionOnline.set(false);
      await store.run();
      http.expectNone(TEST_POST_URL);
      TestBed.inject(SettingsStore).extensionOnline.set(true);
      const sent = store.run();
      void store.run();
      http.expectOne(TEST_POST_URL).flush(testPostDto());
      await sent;
      await settle();
      refreshReads();
    });

    it('follows the post: a post event reads its day again and the log gets posting, then posted', async () => {
      await run();
      expect(dayReads()).toHaveLength(0);
      events.emit('post', { postId: 'tp1', status: 'posting' });
      await settle();
      await answer({ status: 'posting' });
      expect(kinds()).toEqual(['queued', 'posting']);
      expect(store.running()).toBe(true);

      events.emit('post', { postId: 'tp1', status: 'success' });
      await settle();
      await answer({ status: 'success', publishedAt: new Date().toISOString() });
      expect(kinds()).toEqual(['queued', 'posting', 'success']);
      expect(store.running()).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().test.done);
      // Finished: no more reads, even after the poll interval.
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS * 3);
      expect(dayReads()).toHaveLength(0);
    });

    it('ignores the events of other posts', async () => {
      await run();
      events.emit('post', { postId: 'someone-else', status: 'posting' });
      events.emit('device.online', {});
      await settle();
      expect(dayReads()).toHaveLength(0);
    });

    it('polls every 3 seconds when no event comes', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'queued' });
      // Still queued: nothing new in the log.
      expect(kinds()).toEqual(['queued']);
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'posting' });
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'success' });
      expect(kinds()).toEqual(['queued', 'posting', 'success']);
      expect(store.running()).toBe(false);
    });

    it('reads the day of the post (one day), quietly, and answers events that came during a read with one more', async () => {
      await run();
      events.emit('post', { postId: 'tp1' });
      events.emit('post', { postId: 'tp1' });
      events.emit('post', { postId: 'tp1' });
      await settle();
      const first = dayReads();
      expect(first).toHaveLength(1);
      expect(first[0].request.method).toBe('GET');
      const day = new Date(testPostDto().scheduledAt);
      const from = new Date(first[0].request.params.get('from')!);
      expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
      ]);
      first[0].flush([testPostDto({ status: 'posting' })]);
      await settle();
      // The events that came meanwhile are answered by one more read.
      const again = dayReads();
      expect(again).toHaveLength(1);
      again[0].flush([testPostDto({ status: 'posting' })]);
      await settle();
      expect(dayReads()).toHaveLength(0);
      expect(kinds()).toEqual(['queued', 'posting']);
    });

    it('keeps following when a poll fails', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      dayReads()[0].flush('boom', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(store.running()).toBe(true);
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'success' });
      expect(kinds()).toEqual(['queued', 'success']);
    });

    it('shows a failure with its reason and what the extension reported', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({
        status: 'failed',
        failureCode: 'session',
        failureDetail: 'ไม่พบการเข้าสู่ระบบ',
      });
      const last = store.log().at(-1)!;
      expect(last.kind).toBe('failed');
      expect(last.code).toBe('session');
      expect(last.detail).toBe('ไม่พบการเข้าสู่ระบบ');
      expect(store.running()).toBe(false);
      expect(
        toasts().some((x) => x.type === 'error' && x.message.includes(t().reasons.session.title)),
      ).toBe(true);
    });

    it('treats a failure with no code as a network failure', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'failed' });
      expect(store.log().at(-1)!.code).toBe('network');
    });

    it('ends on "awaiting approval" and on "skipped"', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'pending' });
      expect(kinds()).toEqual(['queued', 'pending']);
      expect(store.running()).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().api.engine.testPending);

      await run(testPostDto({ id: 'tp2' }));
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      for (const r of dayReads())
        r.flush([
          testPostDto({ id: 'tp2', status: 'skipped', failureDetail: 'กลุ่มถูกปิดหรือถูกลบแล้ว' }),
        ]);
      await settle();
      refreshReads();
      expect(kinds()).toEqual(['queued', 'skipped']);
      expect(store.log().at(-1)!.detail).toBe('กลุ่มถูกปิดหรือถูกลบแล้ว');
    });

    it('logs a held test post as waiting and goes on', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'waiting' });
      expect(kinds()).toEqual(['queued', 'waiting']);
      expect(store.running()).toBe(true);
    });

    it('gives up after three minutes: says the extension has not answered and stops reading', async () => {
      await run();
      await vi.advanceTimersByTimeAsync(TEST_FOLLOW_MS - 1);
      // The polls that ran meanwhile saw it queued (a read waits for the one before it, so answer until none is open).
      for (let i = 0; i < 3; i++) {
        for (const r of dayReads()) r.flush([testPostDto()]);
        await settle();
      }
      refreshReads();
      await quiet();
      expect(store.running()).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(kinds()).toEqual(['queued', 'late']);
      expect(store.running()).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().api.engine.testStillWaiting);
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS * 4);
      await quiet();
      expect(dayReads()).toHaveLength(0);
      // The test can be run again.
      await run(testPostDto({ id: 'tp3' }));
      expect(kinds()).toEqual(['queued']);
    });

    it('shows the reason when the API refuses the test, and does not follow anything', async () => {
      const sent = store.run();
      http
        .expectOne(TEST_POST_URL)
        .flush(
          { title: 'ผูกเครื่องก่อนจึงจะโพสต์ได้', status: 422 },
          { status: 422, statusText: 'Unprocessable' },
        );
      await sent;
      await settle();
      expect(store.runError()).toBe('ผูกเครื่องก่อนจึงจะโพสต์ได้');
      expect(store.running()).toBe(false);
      expect(store.log()).toEqual([]);
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS * 2);
      expect(dayReads()).toHaveLength(0);
      // No toast either: the page shows the reason beside the button.
      expect(toasts()).toEqual([]);
    });

    it('reads the post again when the stream comes back', async () => {
      await run();
      events.resume();
      await settle();
      await answer({ status: 'posting' });
      expect(kinds()).toEqual(['queued', 'posting']);
    });

    it('empties the form and the log when the workspace changes', async () => {
      await run();
      store.text.set('x');
      TestBed.inject(WorkspaceStore).id.set(null);
      await settle();
      expect(store.log()).toEqual([]);
      expect(store.running()).toBe(false);
      expect(store.text()).toBe('');
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS * 2);
      expect(dayReads()).toHaveLength(0);
    });

    it('moves the random pick after a run so "test again" tries another post', async () => {
      await run();
      const seed = store.seed();
      await vi.advanceTimersByTimeAsync(TEST_POLL_MS);
      await answer({ status: 'success' });
      expect(store.seed()).toBeGreaterThan(seed);
    });
  });

  describe('history', () => {
    it("lists the workspace's test posts, newest first, up to five", async () => {
      const at = (h: number) => new Date(Date.now() - h * HOUR).toISOString();
      const tests = [1, 2, 3, 4, 5, 6].map((h) =>
        testPostDto({ id: 'h' + h, scheduledAt: at(h), status: 'success' }),
      );
      await start({ posts: [...tests, apiPost({ id: 'normal', scheduledAt: at(0.5) })] });
      expect(store.history().map((p) => p.id)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    });
  });
});

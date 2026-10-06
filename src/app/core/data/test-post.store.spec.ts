import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiPost, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiCollection } from '../../testing/collection-fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  APPROVAL_COLLECTION,
  MANUAL_POST_URL,
  PAGE_SET,
  POSTS_URL,
  TEST_COLLECTION,
  TEST_POST_URL,
  TEST_SET,
  device,
  flushBackground,
  laptop,
  manualPostDto,
  testPostDto,
} from '../../testing/test-post.fixtures';
import { ApiPost } from '../http/api.service';
import { I18nService } from '../i18n/i18n.service';
import '../i18n/i18n.engine';
import { NotificationService } from '../services/notification.service';
import { CollectionsStore } from './collections.store';
import { DevicesStore } from './devices.store';
import { DeviceEventsService } from './device-events.service';
import { SettingsStore } from './settings.store';
import {
  TEST_FOLLOW_MS,
  TEST_MAX_MEDIA,
  TEST_POLL_MS,
  TestPostStore,
  deviceStateOf,
} from './test-post.store';
import { WorkspaceStore } from './workspace.store';

const HOUR = 3600e3;
const span = (r: HttpRequest<unknown>) =>
  new Date(r.params.get('to')!).getTime() - new Date(r.params.get('from')!).getTime();

describe('TestPostStore', () => {
  let http: HttpTestingController;
  let store: TestPostStore;
  let events: FakeDeviceEvents;
  /** What the background reads are answered with (the devices a spec has, for one). */
  let background: Record<string, object> = {};
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const t = () => TestBed.inject(I18nService).t();

  async function start(
    opts: {
      collections?: (typeof TEST_COLLECTION)[];
      sets?: (typeof TEST_SET)[];
      posts?: ApiPost[];
      devices?: ReturnType<typeof device>[];
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(TestPostStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    const sets = opts.sets ?? [TEST_SET];
    const devices = opts.devices ?? [device()];
    background = { 'link-sets': sets, devices };
    await signIn(http, {
      linkSets: sets,
      collections: opts.collections ?? [TEST_COLLECTION, APPROVAL_COLLECTION],
      devices,
      posts: opts.posts ?? [],
    });
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
    flushBackground(http, background);
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

  /** The same for the hand-made test. */
  async function runManual(dto: ApiPost = manualPostDto()): Promise<void> {
    const sent = store.runManual();
    http.expectOne(MANUAL_POST_URL).flush(dto);
    await sent;
    await settle();
    refreshReads([dto]);
    await quiet();
  }

  /** Fills the hand-made form with a valid test. */
  function fillManual(): void {
    store.pickPanel('manual');
    store.manualUrl.set('https://www.facebook.com/baandee.shop');
    store.manualText.set('ทดสอบ');
  }

  /** Answers the next read of the followed post's day with the post in `status`. */
  async function answer(
    over: Partial<ApiPost>,
    dto: () => ApiPost = () => testPostDto(over),
  ): Promise<void> {
    const reads = dayReads();
    expect(reads.length).toBeGreaterThan(0);
    for (const r of reads) r.flush([dto()]);
    await settle();
    refreshReads([dto()]);
    await quiet();
  }

  afterEach(() => {
    vi.useRealTimers();
    try {
      refreshReads();
      flushBackground(http, background);
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
      // Switched-off and wrongly addressed links are left out.
      expect(store.members().map((m) => m.label)).toEqual(['Condo BKK (#Jan24)', 'Condo rent']);
      expect(store.members().map((m) => m.key)).toEqual(['link:a', 'link:b']);
      expect(store.members().map((m) => m.kind)).toEqual(['group', 'group']);
      expect(store.member()?.key).toBe('link:a');
    });

    it('lists the pages of a set next to its groups, and says which is which', async () => {
      TestBed.resetTestingModule();
      await start({ sets: [PAGE_SET] });
      expect(store.members().map((m) => [m.key, m.kind])).toEqual([
        ['link:g1', 'group'],
        ['link:baandee.shop', 'page'],
      ]);
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

    it("lays the post's own footer, hashtags and footer position over the collection's", () => {
      store.pickPost('p1');
      const collections = TestBed.inject(CollectionsStore);
      collections.collections.update((l) =>
        l.map((c) => ({
          ...c,
          posts: c.posts.map((p) =>
            p.id === 'p1'
              ? {
                  ...p,
                  settings: {
                    ...p.settings,
                    hashtags: '#own',
                    footer: null,
                    footerPos: 'top' as const,
                  },
                }
              : p,
          ),
        })),
      );
      // The footer of the collection stays (the post leaves it null) but goes first; the tags are its own.
      expect(store.composed()).toBe('LINE @shop\nขายคอนโด #Jan24\n#own');
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
  });

  describe('the extension that receives the test', () => {
    it('is the only one when there is one, and nothing is blocked', async () => {
      await start();
      expect(store.deviceId()).toBe('dev-1');
      expect(store.device()?.name).toBe('Shop PC');
      expect(store.block()).toBe('');
    });

    it('is the one the link set posts as, when there are several', async () => {
      await start({ sets: [PAGE_SET], devices: [device(), laptop()] });
      expect(store.deviceId()).toBe('dev-2');
    });

    it('is the first one that is online when the link set names none', async () => {
      await start({ devices: [device({ online: false }), laptop(), device({ id: 'dev-3' })] });
      expect(store.deviceId()).toBe('dev-2');
    });

    it('is the first one when none is online', async () => {
      await start({ devices: [device({ online: false }), laptop({ online: false })] });
      expect(store.deviceId()).toBe('dev-1');
    });

    it('is the one the person picked, whatever the link set says, and is kept when the set changes', async () => {
      await start({ sets: [PAGE_SET], devices: [device(), laptop()] });
      store.pickDevice('dev-1');
      expect(store.deviceId()).toBe('dev-1');
      store.pickSet('s2');
      expect(store.deviceId()).toBe('dev-1');
      // A pick that is no extension of the workspace (gone meanwhile) falls back to the default.
      store.pickDevice('gone');
      expect(store.deviceId()).toBe('dev-2');
    });

    it('does not follow the link set on the hand-made panel: the first online one', async () => {
      await start({ sets: [PAGE_SET], devices: [device(), laptop()] });
      expect(store.deviceId()).toBe('dev-2');
      store.pickPanel('manual');
      expect(store.deviceId()).toBe('dev-1');
    });

    it('is nothing when no extension is connected, and says so once the list has arrived', async () => {
      await start({ devices: [] });
      expect(store.deviceId()).toBe('');
      expect(store.device()).toBeNull();
      expect(store.block()).toBe('noDevice');
      store.pickPanel('manual');
      expect(store.block()).toBe('noDevice');
    });

    it('does not say "no extension" before the list has arrived', () => {
      http = provideApiTesting({
        providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
      });
      store = TestBed.inject(TestPostStore);
      expect(store.devicesLoaded()).toBe(false);
      expect(store.block()).toBe('needPick');
      background = {};
    });

    it('says why a test cannot start: none online, or the chosen one is offline', async () => {
      await start({ devices: [device({ online: false }), laptop()] });
      store.pickDevice('dev-1');
      expect(store.block()).toBe('deviceDown');
      store.pickDevice('dev-2');
      expect(store.block()).toBe('');
      TestBed.inject(SettingsStore).extensionOnline.set(false);
      expect(store.block()).toBe('offline');
    });

    it('tells online, offline and paused apart for every extension, a pause by the engine too', async () => {
      const inAnHour = new Date(Date.now() + HOUR).toISOString();
      await start({
        devices: [
          device(),
          laptop({ online: false }),
          device({ id: 'dev-3', jobsPaused: true }),
          device({ id: 'dev-4', autoPausedUntil: inAnHour, autoPauseReason: 'x' }),
          device({ id: 'dev-5', autoPausedUntil: new Date(Date.now() - HOUR).toISOString() }),
        ],
      });
      const states = store.deviceStates();
      expect([...states.entries()]).toEqual([
        ['dev-1', 'online'],
        ['dev-2', 'offline'],
        ['dev-3', 'paused'],
        ['dev-4', 'paused'],
        ['dev-5', 'online'],
      ]);
      expect(deviceStateOf(device({ online: false, jobsPaused: true }), new Date())).toBe(
        'offline',
      );
    });

    it('knows when the chosen extension has its jobs paused, by hand or by the engine', async () => {
      await start({ devices: [device({ jobsPaused: true }), laptop()] });
      expect(store.deviceId()).toBe('dev-1');
      expect(store.paused()).toBe(true);
      store.pickDevice('dev-2');
      expect(store.paused()).toBe(false);
      TestBed.inject(DevicesStore).list.update((l) =>
        l.map((d) =>
          d.id === 'dev-2'
            ? { ...d, autoPausedUntil: new Date(Date.now() + HOUR).toISOString() }
            : d,
        ),
      );
      expect(store.paused()).toBe(true);
    });
  });

  describe('running', () => {
    beforeEach(async () => {
      await start();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });

    it('sends the chosen group, collection, post and extension, and starts the log with "queued"', async () => {
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
        deviceId: 'dev-1',
      });
      req.flush(testPostDto());
      await sent;
      await settle();
      refreshReads();
      expect(kinds()).toEqual(['queued']);
      expect(store.running()).toBe(true);
      expect(store.runError()).toBe('');
    });

    it('names the client-picked random post and a typed text', async () => {
      store.text.set(' my text ');
      const picked = store.post()!.id;
      const sent = store.run();
      const req = http.expectOne(TEST_POST_URL);
      expect(req.request.body).toEqual({
        linkSetId: 's1',
        linkId: 'a',
        accountId: null,
        collectionId: 'c1',
        collectionPostId: picked,
        text: 'my text',
        deviceId: 'dev-1',
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

    it('empties both forms, the extension choice and the log when the workspace changes', async () => {
      await run();
      store.text.set('x');
      store.pickPanel('manual');
      store.pickDevice('dev-1');
      store.manualUrl.set('https://www.facebook.com/baandee.shop');
      store.manualText.set('y');
      store.addManualMedia(['m1']);
      TestBed.inject(WorkspaceStore).id.set(null);
      await settle();
      expect(store.log()).toEqual([]);
      expect(store.running()).toBe(false);
      expect(store.text()).toBe('');
      expect(store.panel()).toBe('set');
      expect(store.manualUrl()).toBe('');
      expect(store.manualText()).toBe('');
      expect(store.manualMedia()).toEqual([]);
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

    it('sends the chosen extension of several', async () => {
      TestBed.inject(DevicesStore).list.set([device(), laptop()]);
      background = { ...background, devices: [device(), laptop()] };
      store.pickDevice('dev-2');
      const sent = store.run();
      const req = http.expectOne(TEST_POST_URL);
      expect(req.request.body.deviceId).toBe('dev-2');
      req.flush(testPostDto());
      await sent;
      await settle();
      refreshReads();
    });
  });

  describe('the hand-made test', () => {
    beforeEach(async () => {
      await start();
    });

    it('reads the typed address: a group or a page, in its standard form', () => {
      store.manualUrl.set('fb.com/groups/AbC/permalink/1');
      expect(store.manualTarget()).toEqual({
        kind: 'group',
        url: 'https://www.facebook.com/groups/AbC',
      });
      store.manualUrl.set('https://m.facebook.com/baandee.shop?ref=x');
      expect(store.manualTarget()).toEqual({
        kind: 'page',
        url: 'https://www.facebook.com/baandee.shop',
      });
      store.manualUrl.set('https://www.facebook.com/profile.php?id=1000123456');
      expect(store.manualTarget()?.kind).toBe('page');
      store.manualUrl.set('https://example.com/groups/abc');
      expect(store.manualTarget()).toBeNull();
      store.manualUrl.set('https://www.facebook.com/watch');
      expect(store.manualTarget()).toBeNull();
    });

    it('needs a link that is a group or a page, a text, and an extension', async () => {
      store.pickPanel('manual');
      expect(store.block()).toBe('needUrl');
      store.manualUrl.set('hello');
      expect(store.block()).toBe('badUrl');
      store.manualUrl.set('https://www.facebook.com/groups/abc');
      expect(store.block()).toBe('needText');
      store.manualText.set('  ');
      expect(store.block()).toBe('needText');
      store.manualText.set('ทดสอบ');
      expect(store.block()).toBe('');
      TestBed.inject(SettingsStore).extensionOnline.set(false);
      expect(store.block()).toBe('offline');
      // The other panel is not affected by what was typed here.
      store.pickPanel('set');
      expect(store.blockSet()).toBe('offline');
    });

    it('previews the text as the server writes it: spintax resolved, no code, footer or hashtags', () => {
      store.manualText.set('สวัสดี {{code}}{ครับ|ค่ะ}');
      expect(['สวัสดี ครับ', 'สวัสดี ค่ะ']).toContain(store.manualComposed());
      store.manualText.set('   ');
      expect(store.manualComposed()).toBe('');
    });

    it('picks library images up to the API maximum, takes them out again, and ignores repeats', () => {
      for (let i = 0; i < TEST_MAX_MEDIA + 3; i++) store.toggleManualMedia('m' + i);
      expect(store.manualMedia()).toHaveLength(TEST_MAX_MEDIA);
      expect(store.manualMedia()[0]).toBe('m0');
      store.toggleManualMedia('m3');
      expect(store.manualMedia()).not.toContain('m3');
      expect(store.manualMedia()).toHaveLength(TEST_MAX_MEDIA - 1);
      // Uploaded files are added as far as they fit, once each.
      store.addManualMedia(['m0', 'new1', 'new2']);
      expect(store.manualMedia()).toHaveLength(TEST_MAX_MEDIA);
      expect(store.manualMedia().filter((id) => id === 'm0')).toHaveLength(1);
      expect(store.manualMedia()).toContain('new1');
      expect(store.manualMedia()).not.toContain('new2');
    });

    it('sends the address, the text, the images and the extension, and follows the post like the other test', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      fillManual();
      store.manualUrl.set('  fb.com/baandee.shop  ');
      store.manualText.set('  ทดสอบ  ');
      store.addManualMedia(['m1', 'm2']);
      const sent = store.runManual();
      expect(store.running()).toBe(true);
      const req = http.expectOne(MANUAL_POST_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        url: 'https://www.facebook.com/baandee.shop',
        text: 'ทดสอบ',
        mediaIds: ['m1', 'm2'],
        deviceId: 'dev-1',
      });
      req.flush(manualPostDto());
      await sent;
      await settle();
      refreshReads([manualPostDto()]);
      await quiet();
      expect(kinds()).toEqual(['queued']);
      // The same follow-up: an event of the post reads its day again.
      events.emit('post', { postId: 'mp1', status: 'posting' });
      await settle();
      await answer({}, () => manualPostDto({ status: 'posting' }));
      expect(kinds()).toEqual(['queued', 'posting']);
      events.emit('post', { postId: 'mp1', status: 'success' });
      await settle();
      await answer({}, () =>
        manualPostDto({ status: 'success', publishedAt: new Date().toISOString() }),
      );
      expect(kinds()).toEqual(['queued', 'posting', 'success']);
      expect(store.running()).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().test.done);
    });

    it('sends the extension that was picked', async () => {
      TestBed.inject(DevicesStore).list.set([device(), laptop()]);
      background = { ...background, devices: [device(), laptop()] };
      fillManual();
      store.pickDevice('dev-2');
      const sent = store.runManual();
      const req = http.expectOne(MANUAL_POST_URL);
      expect(req.request.body.deviceId).toBe('dev-2');
      req.flush(manualPostDto());
      await sent;
      await settle();
      refreshReads();
    });

    it('does nothing while blocked or while a test is running', async () => {
      store.pickPanel('manual');
      await store.runManual();
      http.expectNone(MANUAL_POST_URL);
      fillManual();
      const sent = store.runManual();
      void store.runManual();
      http.expectOne(MANUAL_POST_URL).flush(manualPostDto());
      await sent;
      await settle();
      refreshReads();
    });

    it('shows the reason when the API refuses it, beside the button and not as a toast', async () => {
      fillManual();
      const sent = store.runManual();
      http
        .expectOne(MANUAL_POST_URL)
        .flush(
          { title: 'มีส่วนขยายมากกว่า 1 เครื่อง เลือกส่วนขยายที่จะส่งงานทดสอบก่อน', status: 422 },
          { status: 422, statusText: 'Unprocessable' },
        );
      await sent;
      await settle();
      expect(store.runError()).toBe(
        'มีส่วนขยายมากกว่า 1 เครื่อง เลือกส่วนขยายที่จะส่งงานทดสอบก่อน',
      );
      expect(store.running()).toBe(false);
      expect(store.log()).toEqual([]);
      expect(toasts()).toEqual([]);
      // Changing panel forgets a refusal that belonged to the other one.
      store.pickPanel('set');
      expect(store.runError()).toBe('');
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

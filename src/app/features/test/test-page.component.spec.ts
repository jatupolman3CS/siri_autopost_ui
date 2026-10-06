import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { LibraryStore } from '../../core/data/library.store';
import { MediaItem } from '../../core/data/models';
import { SettingsStore } from '../../core/data/settings.store';
import { TEST_MAX_MEDIA, TestPostStore } from '../../core/data/test-post.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost, ApiRole } from '../../core/http/api.service';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  WS,
  answerThumbs,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
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
import { TestPageComponent } from './test-page.component';

const HOUR = 3600e3;
const span = (r: HttpRequest<unknown>) =>
  new Date(r.params.get('to')!).getTime() - new Date(r.params.get('from')!).getTime();
const image = (id: string, name = `${id}.png`): MediaItem => ({
  id,
  name,
  meta: 'image/png · 10 KB',
  kind: 'image',
  used: 0,
  folderId: null,
  active: true,
});

describe('TestPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TestPageComponent>;
  let el: HTMLElement;
  let events: FakeDeviceEvents;
  /** What the background reads are answered with (the extensions a spec has, for one). */
  let background: Record<string, object> = {};
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const store = () => TestBed.inject(TestPostStore);

  async function open(
    opts: {
      role?: ApiRole;
      assist?: boolean;
      offline?: boolean;
      posts?: ApiPost[];
      devices?: ReturnType<typeof device>[];
      collections?: (typeof TEST_COLLECTION)[];
      sets?: (typeof TEST_SET)[];
      library?: MediaItem[];
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      imports: [TestPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    if (opts.assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    TestBed.inject(WorkspaceStore);
    TestBed.inject(TestPostStore);
    // The library is asked for when the manual panel needs it; it exists from the start so signIn answers it.
    const library = TestBed.inject(LibraryStore);
    const sets = opts.sets ?? [TEST_SET];
    const devices = opts.devices ?? [device()];
    background = { 'link-sets': sets, devices };
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner' },
      linkSets: sets,
      collections: opts.collections ?? [TEST_COLLECTION, APPROVAL_COLLECTION],
      devices,
      posts: opts.posts ?? [],
    });
    if (opts.library) library.media.set(opts.library);
    if (opts.offline) TestBed.inject(SettingsStore).extensionOnline.set(false);
    fixture = TestBed.createComponent(TestPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const rerender = async () => {
    await settle();
    fixture.detectChanges();
  };
  const select = (label: string) =>
    [...el.querySelectorAll<HTMLElement>('app-select-field')]
      .find((f) => f.querySelector('label')!.textContent!.trim() === label)!
      .querySelector('select')!;
  const choose = async (sel: HTMLSelectElement, value: string) => {
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
    await rerender();
  };
  const runBtn = () => el.querySelector<HTMLButtonElement>('.foot button')!;
  const logTexts = () => [...el.querySelectorAll('.log-row .lx')].map((x) => x.textContent!.trim());
  const history = () => [...el.querySelectorAll('.side section:last-child .row')];
  const refreshReads = (posts: ApiPost[]) => {
    for (const r of http.match((x) => x.url === POSTS_URL && span(x) > 26 * HOUR)) {
      const from = new Date(r.request.params.get('from')!);
      const to = new Date(r.request.params.get('to')!);
      r.flush(posts.filter((p) => new Date(p.scheduledAt) >= from && new Date(p.scheduledAt) < to));
    }
    for (const r of http.match((x) => x.url.endsWith('/errors'))) r.flush([]);
  };
  /** Clicks run and answers the API with `dto`. */
  async function run(dto: ApiPost = testPostDto()): Promise<void> {
    runBtn().click();
    await settle();
    http.expectOne(TEST_POST_URL).flush(dto);
    await settle();
    refreshReads([dto]);
    await rerender();
  }
  /** The followed post's day is read (after an event or a poll): answers with `over` applied. */
  async function followed(over: Partial<ApiPost>, make = testPostDto): Promise<void> {
    for (const r of http.match((x) => x.url === POSTS_URL && span(x) <= 26 * HOUR))
      r.flush([make(over)]);
    await settle();
    refreshReads([make(over)]);
    flushBackground(http, background);
    await rerender();
  }
  /** Shows the hand-made panel. */
  async function manual(): Promise<void> {
    tab(1).click();
    await rerender();
  }
  const tab = (i: number) =>
    el.querySelectorAll<HTMLButtonElement>('[data-testid=test-panels] button')[i];
  const urlInput = () => el.querySelector<HTMLInputElement>('app-input-field input')!;
  const type = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await rerender();
  };
  const textBox = () => el.querySelector<HTMLTextAreaElement>('#test-manual-text')!;
  const send = () => el.querySelector<HTMLButtonElement>('[data-testid=manual-send]')!;
  /** Fills the hand-made form with a valid test. */
  async function fillManual(): Promise<void> {
    await type(urlInput(), 'https://www.facebook.com/baandee.shop');
    await type(textBox(), 'ทดสอบ');
  }

  afterEach(() => {
    try {
      // Whatever the other stores asked for on events is not what these specs look at.
      answerThumbs(http);
      flushBackground(http, background);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('layout', () => {
    beforeEach(() => open());

    it('has the design title, subtitle, four selects, the text box, the preview and the run button', () => {
      expect(el.querySelector('h1')!.textContent).toBe(t().test.title);
      expect(el.querySelector('.page-head p')!.textContent).toBe(t().test.sub);
      const labels = [...el.querySelectorAll('app-select-field label')].map((l) =>
        l.textContent!.trim(),
      );
      // One extension: no picker for it, just the four choices of the form.
      expect(labels).toEqual([t().test.set, t().test.group, t().test.col, t().test.post]);
      expect(el.querySelector('label[for=test-text]')!.textContent).toBe(t().test.override);
      expect(el.querySelector<HTMLTextAreaElement>('#test-text')!.placeholder).toBe(
        t().test.overridePh,
      );
      expect(runBtn().textContent!.trim()).toBe(t().test.run);
      expect(runBtn().disabled).toBe(false);
      // No stepper or next-step card on this page, and no offline banner.
      expect(el.querySelector('.alert')).toBeNull();
    });

    it('says a real post is made in the real group or page, not a simulation, whatever the state of the page', () => {
      const note = el.querySelector('.callout.real')!;
      expect(note.getAttribute('role')).toBe('note');
      expect(note.textContent).toContain(t().api.engine.testReal);
      expect(t().api.engine.testReal).toContain('ไม่ใช่การจำลอง');
      expect(t().test.sub).toContain('จริง');
      TestBed.inject(I18nService).setLang('en');
      expect(t().api.engine.testReal).toMatch(/not a simulation/);
      expect(t().api.engine.testReal).toMatch(/real post/);
      expect(t().api.engine.testReal).toMatch(/group or page/);
      TestBed.inject(I18nService).setLang('th');
    });

    it('says what the test proves, with a link to the schedules', () => {
      const line = el.querySelector('[data-testid=test-proves]')!;
      expect(line.textContent).toContain(t().api.engine.testProves);
      const link = line.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('/app/schedules');
      expect(link.textContent).toBe(t().api.engine.testProvesLink);
    });

    it('says under the text box that spintax and the group code are resolved like a schedule post', () => {
      const hint = el.querySelector('#test-text-hint')!;
      expect(hint.textContent).toBe(t().api.engine.testOverrideHint);
      expect(hint.textContent).toContain('{a|b}');
      expect(hint.textContent).toContain('{{code}}');
      expect(el.querySelector('#test-text')!.getAttribute('aria-describedby')).toBe(hint.id);
      TestBed.inject(I18nService).setLang('en');
      expect(t().api.engine.testOverrideHint).toMatch(/scheduled post/);
      expect(t().api.engine.testOverrideHint).toContain('{a|b}');
      expect(t().api.engine.testOverrideHint).toContain('{{code}}');
      TestBed.inject(I18nService).setLang('th');
    });

    it('lists the sets, the usable groups with their codes, the collections and the posts', () => {
      const texts = (sel: HTMLSelectElement) =>
        [...sel.options].filter((o) => !o.disabled).map((o) => o.textContent!.trim());
      expect(texts(select(t().test.set))).toEqual(['Condo groups']);
      expect(texts(select(t().test.group))).toEqual(['Condo BKK (#Jan24)', 'Condo rent']);
      expect(texts(select(t().test.col))).toEqual(['Condo', 'Tickets']);
      expect(texts(select(t().test.post))).toEqual([
        fmt(t().test.random, { n: 2 }),
        '1. ขายคอนโด {{code}}',
        '2. ห้องว่างให้เช่า',
      ]);
    });

    it('previews the text as the engine writes it, and how many files go with it', async () => {
      await choose(select(t().test.post), 'p1');
      const box = el.querySelector('.box')!.textContent!;
      expect(box).toBe('ขายคอนโด #Jan24\n\nLINE @shop\n#condo');
      expect(el.querySelector('.pv-head span')!.textContent).toBe(
        `${t().test.preview} · ${fmt(t().test.filesN, { n: 2 })}`,
      );
      await choose(select(t().test.post), 'p2');
      expect(el.querySelector('.pv-head span')!.textContent).toContain(t().test.noFiles);
    });

    it('follows the typed text and the group', async () => {
      await choose(select(t().test.group), 'link:b');
      const ta = el.querySelector<HTMLTextAreaElement>('#test-text')!;
      ta.value = 'ข้อความทดสอบ';
      ta.dispatchEvent(new Event('input'));
      await rerender();
      expect(el.querySelector('.box')!.textContent).toBe('ข้อความทดสอบ\n\nLINE @shop\n#condo');
    });

    it('reshuffles the random pick', async () => {
      const before = TestBed.inject(TestPostStore).seed();
      el.querySelector<HTMLButtonElement>('.pv-head button')!.click();
      await rerender();
      expect(TestBed.inject(TestPostStore).seed()).toBe(before + 1);
    });

    it('shows the empty log and history texts', () => {
      expect(el.querySelector('.log h2')!.textContent).toBe(t().test.logTitle);
      expect(el.querySelector('.log .none')!.textContent).toBe(t().test.none);
      expect(history()).toHaveLength(0);
      expect(el.querySelector('.none.hist')!.textContent).toBe(t().test.none);
    });

    it('lists the latest test posts with their real status', async () => {
      const posts = [
        testPostDto({
          id: 'h1',
          scheduledAt: new Date(Date.now() - HOUR).toISOString(),
          status: 'success',
        }),
        testPostDto({
          id: 'h2',
          scheduledAt: new Date(Date.now() - 2 * HOUR).toISOString(),
          status: 'failed',
          failureCode: 'session',
        }),
        apiPost({ id: 'normal', scheduledAt: new Date(Date.now() - HOUR).toISOString() }),
      ];
      TestBed.resetTestingModule();
      await open({ posts });
      const rows = history();
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain(t().status.success);
      expect(rows[0].textContent).toContain('Condo BKK');
      expect(rows[1].textContent).toContain(t().status.failed);
    });

    it('marks a page of the set as one, next to the groups', async () => {
      TestBed.resetTestingModule();
      await open({ sets: [PAGE_SET], devices: [device(), laptop()] });
      const texts = [...select(t().test.group).options]
        .filter((o) => !o.disabled)
        .map((o) => o.textContent!.trim());
      expect(texts).toEqual(['Shop group', `Baandee page · ${t().api.engine.testKindPage}`]);
    });
  });

  describe('the extension that receives the test', () => {
    const device1 = () => el.querySelector<HTMLElement>('[data-testid=test-device]')!;
    const picker = () => select(t().api.engine.testDevice);

    it('is shown as plain text, with its state, when there is only one', async () => {
      await open();
      const one = el.querySelector('[data-testid=test-device-one]')!;
      expect(one.textContent).toContain('Shop PC');
      expect(one.textContent).toContain(t().api.engine.testDeviceOnline);
      expect(one.querySelector('.dot')!.getAttribute('style')).toContain('--color-success');
      expect(device1().querySelector('select')).toBeNull();
    });

    it('is a picker above both panels when there are several, listing name and state of each', async () => {
      await open({
        devices: [
          device(),
          laptop({ online: false }),
          device({ id: 'dev-3', name: 'Office', jobsPaused: true }),
        ],
      });
      const a = t().api.engine;
      expect([...picker().options].map((o) => o.textContent!.trim())).toEqual([
        `Shop PC · ${a.testDeviceOnline}`,
        `Laptop · ${a.testDeviceOffline}`,
        `Office · ${a.testDevicePaused}`,
      ]);
      expect(device1().textContent).toContain(a.testDeviceHint);
      // It is above the panels, so it is still there on the other one.
      await manual();
      expect(picker()).not.toBeNull();
    });

    it('starts on the extension the link set posts as', async () => {
      await open({ sets: [PAGE_SET], devices: [device(), laptop()] });
      expect(picker().value).toBe('dev-2');
      expect(el.querySelector('[data-testid=test-device-state]')!.textContent).toContain('Laptop');
    });

    it('starts on the first one that is online when the link set names none', async () => {
      await open({ devices: [device({ online: false }), laptop()] });
      expect(picker().value).toBe('dev-2');
    });

    it('sends the test through the extension that was picked', async () => {
      await open({ devices: [device(), laptop()] });
      await choose(picker(), 'dev-2');
      runBtn().click();
      await settle();
      const req = http.expectOne(TEST_POST_URL);
      expect(req.request.body.deviceId).toBe('dev-2');
      req.flush(testPostDto());
      await settle();
      refreshReads([testPostDto()]);
      await rerender();
      // Not while the post is being sent.
      expect(picker().disabled).toBe(true);
    });

    it('says the chosen extension is offline and keeps the button off, while another is online', async () => {
      await open({ devices: [device({ online: false }), laptop()] });
      await choose(picker(), 'dev-1');
      expect(el.querySelector('.alert')!.textContent).toContain(
        fmt(t().api.engine.testDeviceDown, { d: 'Shop PC' }),
      );
      expect(runBtn().disabled).toBe(true);
      await choose(picker(), 'dev-2');
      expect(el.querySelector('.alert')).toBeNull();
      expect(runBtn().disabled).toBe(false);
    });

    it('says no extension is connected, with a link to the team page, and keeps both buttons off', async () => {
      await open({ devices: [] });
      expect(el.querySelector('.alert')!.textContent).toContain(t().api.engine.testNoDevice);
      expect(el.querySelector('.alert a')!.getAttribute('href')).toBe('/app/team');
      expect(el.querySelector('[data-testid=test-device-none]')).not.toBeNull();
      expect(runBtn().disabled).toBe(true);
      await manual();
      expect(send().disabled).toBe(true);
    });

    it('warns that the chosen extension is paused, without stopping the test', async () => {
      await open({ devices: [device({ jobsPaused: true })] });
      expect(el.querySelector('.callout.warn')!.textContent).toContain(t().api.engine.testPaused);
      expect(runBtn().disabled).toBe(false);
    });
  });

  describe('why a test cannot start', () => {
    it('says so above the form and keeps the button off when the extension is offline', async () => {
      await open({ offline: true });
      expect(el.querySelector('.alert')!.textContent).toContain(t().test.needOnline);
      expect(el.querySelector('.alert .ph-wifi-slash')).not.toBeNull();
      expect(runBtn().disabled).toBe(true);
    });

    it('asks for a post when the collection has none to use, until some text is typed', async () => {
      await open({ collections: [apiCollection({ id: 'empty', name: 'Empty' })] });
      expect(el.querySelector('.foot .err')!.textContent).toBe(t().test.noPosts);
      expect(runBtn().disabled).toBe(true);
      const ta = el.querySelector<HTMLTextAreaElement>('#test-text')!;
      ta.value = 'ข้อความทดสอบ';
      ta.dispatchEvent(new Event('input'));
      await rerender();
      expect(el.querySelector('.foot .err')).toBeNull();
      expect(runBtn().disabled).toBe(false);
    });

    it('asks for a group when there is no link set', async () => {
      await open({ sets: [] });
      expect(el.querySelector('.foot .err')!.textContent).toBe(t().test.needPick);
      expect(runBtn().disabled).toBe(true);
      expect(el.querySelector('.box')!.textContent).toBe(
        TestBed.inject(TestPostStore).body() || t().test.needPick,
      );
    });

    it('shows the daily-limit note instead of an error while the test can run', async () => {
      await open();
      expect(el.querySelector('.foot .err')).toBeNull();
      expect(el.querySelector('.foot .muted')!.textContent).toBe(t().test.confirmBody);
    });
  });

  describe('the two panels', () => {
    beforeEach(() => open());

    it('are a segmented choice, "from a collection" first', () => {
      const a = t().api.engine;
      const seg = el.querySelector('[data-testid=test-panels]')!;
      expect(seg.getAttribute('role')).toBe('group');
      expect(seg.getAttribute('aria-label')).toBe(a.testPanels);
      expect([...seg.querySelectorAll('button')].map((b) => b.textContent!.trim())).toEqual([
        a.testPanelSet,
        a.testPanelManual,
      ]);
      expect(tab(0).getAttribute('aria-pressed')).toBe('true');
      expect(tab(1).getAttribute('aria-pressed')).toBe('false');
      expect(el.querySelector('[data-testid=test-set-form]')).not.toBeNull();
      expect(el.querySelector('[data-testid=test-manual-form]')).toBeNull();
    });

    it('switch to the hand-made form, which has no link set, collection or post choice', async () => {
      await manual();
      expect(tab(1).getAttribute('aria-pressed')).toBe('true');
      expect(tab(1).classList.contains('on')).toBe(true);
      expect(el.querySelector('[data-testid=test-set-form]')).toBeNull();
      expect(el.querySelector('[data-testid=test-manual-form]')).not.toBeNull();
      expect(el.querySelector('app-select-field')).toBeNull();
      await (async () => {
        tab(0).click();
        await rerender();
      })();
      expect(el.querySelector('[data-testid=test-set-form]')).not.toBeNull();
    });

    it('share the log and the history', async () => {
      await manual();
      expect(el.querySelector('.log h2')!.textContent).toBe(t().test.logTitle);
      await fillManual();
      send().click();
      await settle();
      http.expectOne(MANUAL_POST_URL).flush(manualPostDto());
      await settle();
      refreshReads([manualPostDto()]);
      await rerender();
      expect(logTexts()).toEqual([t().api.engine.testQueued]);
      // Back on the other panel the same story is still there, and its button waits too.
      tab(0).click();
      await rerender();
      expect(logTexts()).toEqual([t().api.engine.testQueued]);
      expect(runBtn().disabled).toBe(true);
      expect(runBtn().textContent!.trim()).toBe(t().test.running);
    });
  });

  describe('the hand-made panel', () => {
    beforeEach(() =>
      open({ library: [image('m1', 'a.png'), image('m2', 'b.png'), image('m3', 'c.png')] }),
    );

    it('asks for a link, a text and images, and says so with a hint for each', async () => {
      await manual();
      const a = t().api.engine;
      expect(el.querySelector('app-input-field label')!.textContent).toBe(a.testManualUrl);
      expect(urlInput().placeholder).toBe(a.testManualUrlPh);
      expect(el.querySelector('[data-testid=test-manual-form]')!.textContent).toContain(
        a.testManualUrlHint,
      );
      expect(el.querySelector('label[for=test-manual-text]')!.textContent).toBe(a.testManualText);
      const hint = el.querySelector('#test-manual-text-hint')!;
      expect(hint.textContent).toBe(fmt(a.testManualTextHint, { n: 5000 }));
      expect(hint.textContent).toContain('{a|b}');
      expect(hint.textContent).toContain('{{code}}');
      expect(textBox().getAttribute('maxlength')).toBe('5000');
      expect(textBox().getAttribute('aria-describedby')).toBe(hint.id);
      expect(urlInput().getAttribute('maxlength')).toBe('300');
      const images = el.querySelector('[data-testid=manual-images]')!;
      expect(images.textContent).toContain(fmt(a.testManualImagesHint, { n: TEST_MAX_MEDIA }));
      expect(images.textContent).toContain(a.testManualUpload);
      expect(send().textContent!.trim()).toBe(a.testManualSend);
      expect(send().disabled).toBe(true);
    });

    it('shows a group link as a group with its standard address', async () => {
      await manual();
      await type(urlInput(), 'fb.com/groups/AbC/permalink/9');
      expect(el.querySelector('[data-testid=manual-kind]')!.textContent).toBe(
        t().api.engine.testKindGroup,
      );
      expect(el.querySelector('[data-testid=manual-target]')!.textContent).toContain(
        'https://www.facebook.com/groups/AbC',
      );
      expect(el.querySelector('.su-field-err')).toBeNull();
    });

    it('shows a page link as a page', async () => {
      await manual();
      await type(urlInput(), 'https://m.facebook.com/baandee.shop?ref=x');
      expect(el.querySelector('[data-testid=manual-kind]')!.textContent).toBe(
        t().api.engine.testKindPage,
      );
      expect(el.querySelector('[data-testid=manual-target]')!.textContent).toContain(
        'https://www.facebook.com/baandee.shop',
      );
    });

    it('says a link that is no Facebook group or page is not one, and keeps send off', async () => {
      await manual();
      await type(urlInput(), 'https://example.com/groups/abc');
      await type(textBox(), 'ทดสอบ');
      expect(el.querySelector('.su-field-err')!.textContent).toBe(t().api.engine.testManualBadUrl);
      expect(el.querySelector('[data-testid=manual-target]')).toBeNull();
      expect(send().disabled).toBe(true);
      expect(el.querySelector('.foot .err')!.textContent).toBe(t().api.engine.testManualBadUrl);
    });

    it('waits quietly (no error) while the link or the text is empty, and says which is missing', async () => {
      await manual();
      expect(el.querySelector('.su-field-err')).toBeNull();
      expect(el.querySelector('.foot .muted')!.textContent).toBe(t().api.engine.testManualNeedUrl);
      await type(urlInput(), 'https://www.facebook.com/groups/abc');
      expect(el.querySelector('.foot .muted')!.textContent).toBe(t().api.engine.testManualNeedText);
      expect(send().disabled).toBe(true);
      await type(textBox(), 'ทดสอบ');
      expect(el.querySelector('.foot .muted')!.textContent).toBe(t().test.confirmBody);
      expect(send().disabled).toBe(false);
    });

    it('previews the text the way the server writes it', async () => {
      await manual();
      await type(textBox(), 'สวัสดี{ครับ|ค่ะ}');
      expect(['สวัสดีครับ', 'สวัสดีค่ะ']).toContain(
        el.querySelector('[data-testid=manual-preview]')!.textContent,
      );
    });

    it('picks images from the library, shows them, and takes them out again', async () => {
      await manual();
      const a = t().api.engine;
      expect(el.querySelector('[data-testid=manual-picker]')).toBeNull();
      el.querySelector<HTMLButtonElement>('[data-testid=manual-pick]')!.click();
      await rerender();
      answerThumbs(http);
      const picks = () => [
        ...el.querySelectorAll<HTMLButtonElement>('[data-testid=manual-picker] button.m'),
      ];
      expect(picks().map((b) => b.textContent!.trim())).toEqual(['a.png', 'b.png', 'c.png']);
      picks()[0].click();
      picks()[2].click();
      await rerender();
      expect(store().manualMedia()).toEqual(['m1', 'm3']);
      expect(el.querySelector('[data-testid=manual-picked]')!.textContent).toBe(
        fmt(a.testManualPicked, { n: 2, m: TEST_MAX_MEDIA }),
      );
      expect(picks()[0].getAttribute('aria-pressed')).toBe('true');
      const attached = () => [...el.querySelectorAll('.media:not(.picker) .m')];
      expect(attached().map((m) => m.textContent!.trim())).toEqual(['a.png', 'c.png']);
      // The x on a picked image takes it out.
      attached()[0].querySelector<HTMLButtonElement>('button')!.click();
      await rerender();
      expect(store().manualMedia()).toEqual(['m3']);
    });

    it('shows only images that are on, and says when the library has none', async () => {
      TestBed.inject(LibraryStore).media.set([
        { ...image('v1', 'clip.mp4'), kind: 'video' },
        { ...image('off', 'off.png'), active: false },
      ]);
      await manual();
      el.querySelector<HTMLButtonElement>('[data-testid=manual-pick]')!.click();
      await rerender();
      expect(el.querySelectorAll('[data-testid=manual-picker] button.m')).toHaveLength(0);
      expect(el.querySelector('[data-testid=manual-picker]')!.textContent).toContain(
        t().api.engine.testManualNoImages,
      );
    });

    it('takes at most ten images: the rest of the library is off once ten are picked', async () => {
      TestBed.inject(LibraryStore).media.set(Array.from({ length: 12 }, (_, i) => image('i' + i)));
      await manual();
      el.querySelector<HTMLButtonElement>('[data-testid=manual-pick]')!.click();
      await rerender();
      answerThumbs(http);
      const picks = () => [
        ...el.querySelectorAll<HTMLButtonElement>('[data-testid=manual-picker] button.m'),
      ];
      for (let i = 0; i < TEST_MAX_MEDIA; i++) picks()[i].click();
      await rerender();
      expect(store().manualMedia()).toHaveLength(TEST_MAX_MEDIA);
      expect(picks()[10].disabled).toBe(true);
      expect(picks()[11].disabled).toBe(true);
      // A picked one can still be taken out.
      expect(picks()[0].disabled).toBe(false);
    });

    describe('upload from my computer', () => {
      const fileInput = () => el.querySelector<HTMLInputElement>('[data-testid=manual-upload]')!;
      async function choosePng(...names: string[]): Promise<void> {
        const files = names.map((n) => new File(['x'], n, { type: 'image/png' }));
        Object.defineProperty(fileInput(), 'files', { value: files, configurable: true });
        fileInput().dispatchEvent(new Event('change'));
        await settle();
      }
      const media = (id: string, name: string) => ({
        id,
        name,
        contentType: 'image/png',
        kind: 'image',
        size: 1000,
        usedCount: 0,
        folderId: null,
        active: true,
      });

      it('takes images only, and uploads them into the library, picking the new ones', async () => {
        await manual();
        expect(fileInput().accept).toBe('image/*');
        expect(fileInput().multiple).toBe(true);
        await choosePng('one.png', 'two.png');
        const uploads = http.match(
          (r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`,
        );
        expect(uploads).toHaveLength(1);
        uploads[0].flush(media('up1', 'one.png'));
        await settle();
        const second = http.expectOne(
          (r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`,
        );
        second.flush(media('up2', 'two.png'));
        await rerender();
        answerThumbs(http);
        expect(store().manualMedia()).toEqual(['up1', 'up2']);
        expect(
          TestBed.inject(LibraryStore)
            .media()
            .map((m) => m.id),
        ).toContain('up1');
        expect(el.querySelector('[data-testid=manual-upload-error]')).toBeNull();
        expect(el.querySelector('[data-testid=manual-picked]')!.textContent).toBe(
          fmt(t().api.engine.testManualPicked, { n: 2, m: TEST_MAX_MEDIA }),
        );
      });

      it("shows the server's refusal (the plan's image limit) and picks nothing", async () => {
        await manual();
        await choosePng('big.png');
        http
          .expectOne((r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`)
          .flush(
            { title: 'แผนของคุณเก็บรูปในคลังได้ไม่เกิน 50 รูป', status: 422 },
            { status: 422, statusText: 'Unprocessable' },
          );
        await rerender();
        expect(el.querySelector('[data-testid=manual-upload-error]')!.textContent).toBe(
          fmt(t().api.engine.testManualUploadRefused, {
            r: 'แผนของคุณเก็บรูปในคลังได้ไม่เกิน 50 รูป',
          }),
        );
        expect(store().manualMedia()).toEqual([]);
        expect(toasts()).toEqual([]);
      });

      it('keeps the files that went through and names the one that did not', async () => {
        await manual();
        await choosePng('ok.png', 'late.png');
        http
          .expectOne((r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`)
          .flush(media('ok1', 'ok.png'));
        await settle();
        http
          .expectOne((r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`)
          .flush(
            { title: 'ถึงจำนวนรูปสูงสุดของแผนแล้ว' },
            { status: 422, statusText: 'Unprocessable' },
          );
        await rerender();
        answerThumbs(http);
        expect(store().manualMedia()).toEqual(['ok1']);
        expect(el.querySelector('[data-testid=manual-upload-error]')!.textContent).toContain(
          'ถึงจำนวนรูปสูงสุดของแผนแล้ว',
        );
      });

      it('says a refusal that has no reason with the usual upload message', async () => {
        await manual();
        await choosePng('x.png');
        http
          .expectOne((r) => r.method === 'POST' && r.url === `/api/workspaces/${WS}/media`)
          .flush('boom', { status: 500, statusText: 'Server Error' });
        await rerender();
        expect(el.querySelector('[data-testid=manual-upload-error]')!.textContent).toBe(
          t().api.uploadFailed,
        );
      });
    });

    it('sends the typed test through the chosen extension and follows it in the shared log', async () => {
      await manual();
      await fillManual();
      store().addManualMedia(['m1']);
      await rerender();
      send().click();
      await settle();
      const req = http.expectOne(MANUAL_POST_URL);
      expect(req.request.body).toEqual({
        url: 'https://www.facebook.com/baandee.shop',
        text: 'ทดสอบ',
        mediaIds: ['m1'],
        deviceId: 'dev-1',
      });
      req.flush(manualPostDto());
      await settle();
      refreshReads([manualPostDto()]);
      await rerender();
      expect(logTexts()).toEqual([t().api.engine.testQueued]);
      expect(send().textContent!.trim()).toBe(t().test.running);
      expect(send().disabled).toBe(true);
      // The inputs wait while it runs.
      expect(urlInput().disabled).toBe(true);
      expect(textBox().readOnly).toBe(true);

      events.emit('post', { postId: 'mp1', status: 'success' });
      await followed({ status: 'success', publishedAt: new Date().toISOString() }, manualPostDto);
      expect(logTexts()).toEqual([t().api.engine.testQueued, t().api.engine.testSuccess]);
      expect(send().textContent!.trim()).toBe(t().test.again);
      expect(send().disabled).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().test.done);
    });

    it("shows the API's refusal beside the button, not in the log", async () => {
      await manual();
      await fillManual();
      send().click();
      await settle();
      http
        .expectOne(MANUAL_POST_URL)
        .flush(
          { title: 'ไม่พบไฟล์รูปบางรายการในคลัง', status: 422 },
          { status: 422, statusText: 'Unprocessable' },
        );
      await rerender();
      expect(el.querySelector('.foot .err')!.textContent).toBe('ไม่พบไฟล์รูปบางรายการในคลัง');
      expect(el.querySelector('.log .none')).not.toBeNull();
      expect(send().disabled).toBe(false);
      expect(toasts()).toEqual([]);
    });
  });

  describe('permissions', () => {
    it.each([
      ['viewer', true],
      ['editor', false],
      ['admin', false],
      ['owner', false],
    ] as const)('%s: choices and run are off = %s', async (role, disabled) => {
      await open({ role });
      expect(runBtn().disabled).toBe(disabled);
      expect([...el.querySelectorAll<HTMLSelectElement>('select')].every((s) => s.disabled)).toBe(
        disabled,
      );
      expect(el.querySelector<HTMLTextAreaElement>('#test-text')!.readOnly).toBe(disabled);
      expect(el.querySelector('.perm-note') !== null).toBe(disabled);
    });

    it('keeps the hand-made panel off for a viewer, and for assist mode', async () => {
      await open({ role: 'viewer' });
      await manual();
      expect(send().disabled).toBe(true);
      expect(urlInput().disabled).toBe(true);
      expect(textBox().readOnly).toBe(true);
      expect(el.querySelector<HTMLButtonElement>('[data-testid=manual-pick]')!.disabled).toBe(true);
      expect(el.querySelector<HTMLInputElement>('[data-testid=manual-upload]')!.disabled).toBe(
        true,
      );
    });

    it('is read-only in assist mode', async () => {
      await open({ role: 'owner', assist: true });
      expect(runBtn().disabled).toBe(true);
      expect(el.querySelector('.perm-note')).not.toBeNull();
    });
  });

  describe('a test run', () => {
    beforeEach(() => open());

    it('sends the test and shows the real log as the post moves: queued, posting, posted', async () => {
      await run();
      expect(logTexts()).toEqual([t().api.engine.testQueued]);
      expect(runBtn().textContent!.trim()).toBe(t().test.running);
      expect(runBtn().disabled).toBe(true);
      // Choices are off while it runs.
      expect(select(t().test.set).disabled).toBe(true);

      events.emit('post', { postId: 'tp1', status: 'posting' });
      await followed({ status: 'posting' });
      expect(logTexts()).toEqual([t().api.engine.testQueued, t().api.engine.testPosting]);

      events.emit('post', { postId: 'tp1', status: 'success' });
      await followed({ status: 'success', publishedAt: new Date().toISOString() });
      expect(logTexts()).toEqual([
        t().api.engine.testQueued,
        t().api.engine.testPosting,
        t().api.engine.testSuccess,
      ]);
      expect(runBtn().textContent!.trim()).toBe(t().test.again);
      expect(runBtn().disabled).toBe(false);
      expect(toasts().map((x) => x.message)).toContain(t().test.done);
      // Each line has a time and an icon, the last one green.
      const last = el.querySelectorAll('.log-row')[2];
      expect(last.querySelector('.ph-check-circle')).not.toBeNull();
      expect(last.querySelector('.lt')!.textContent).toMatch(/^\d\d:\d\d$/);
    });

    it('shows a failure with its reason title and what the extension reported', async () => {
      await run();
      events.emit('post', { postId: 'tp1', status: 'failed' });
      await followed({
        status: 'failed',
        failureCode: 'session',
        failureDetail: 'ต้องล็อกอินใหม่',
      });
      const row = el.querySelectorAll('.log-row')[1];
      expect(row.querySelector('.lx')!.textContent).toContain(
        `${t().api.engine.testFailed} · ${t().reasons.session.title}`,
      );
      expect(row.querySelector('.detail')!.textContent).toBe('ต้องล็อกอินใหม่');
      expect(row.querySelector('.ph-x-circle')).not.toBeNull();
    });

    it('says awaiting approval when the group holds the post', async () => {
      await run();
      events.emit('post', { postId: 'tp1', status: 'pending' });
      await followed({ status: 'pending' });
      expect(logTexts().at(-1)).toBe(t().api.engine.testPending);
      expect(runBtn().disabled).toBe(false);
    });

    it('shows the API refusal beside the button and nothing in the log', async () => {
      runBtn().click();
      await settle();
      http
        .expectOne(TEST_POST_URL)
        .flush(
          { title: 'กลุ่มนี้ถูกปิดอยู่', status: 422 },
          { status: 422, statusText: 'Unprocessable' },
        );
      await rerender();
      expect(el.querySelector('.foot .err')!.textContent).toBe('กลุ่มนี้ถูกปิดอยู่');
      expect(el.querySelector('.log .none')).not.toBeNull();
      expect(runBtn().disabled).toBe(false);
      expect(toasts()).toEqual([]);
    });

    it('keeps the log when the page is left and opened again', async () => {
      await run();
      fixture.destroy();
      fixture = TestBed.createComponent(TestPageComponent);
      fixture.detectChanges();
      el = fixture.nativeElement as HTMLElement;
      await rerender();
      expect(logTexts()).toEqual([t().api.engine.testQueued]);
      expect(runBtn().textContent!.trim()).toBe(t().test.running);
    });

    it('keeps the panel and what was typed on the hand-made one when the page is opened again', async () => {
      await manual();
      await fillManual();
      fixture.destroy();
      fixture = TestBed.createComponent(TestPageComponent);
      fixture.detectChanges();
      el = fixture.nativeElement as HTMLElement;
      await rerender();
      expect(tab(1).getAttribute('aria-pressed')).toBe('true');
      expect(urlInput().value).toBe('https://www.facebook.com/baandee.shop');
      expect(textBox().value).toBe('ทดสอบ');
    });
  });
});

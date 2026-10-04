import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { SettingsStore } from '../../core/data/settings.store';
import { TestPostStore } from '../../core/data/test-post.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost, ApiRole } from '../../core/http/api.service';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ACCOUNTS, apiPost, provideApiTesting, settle, signIn } from '../../testing/api-testing';
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
import { TestPageComponent } from './test-page.component';

const HOUR = 3600e3;
const span = (r: HttpRequest<unknown>) =>
  new Date(r.params.get('to')!).getTime() - new Date(r.params.get('from')!).getTime();

describe('TestPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TestPageComponent>;
  let el: HTMLElement;
  let events: FakeDeviceEvents;
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();

  async function open(
    opts: {
      role?: ApiRole;
      assist?: boolean;
      accounts?: typeof ACCOUNTS;
      offline?: boolean;
      posts?: ApiPost[];
      devices?: ReturnType<typeof device>[];
      collections?: (typeof TEST_COLLECTION)[];
      sets?: (typeof TEST_SET)[];
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
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner' },
      linkSets: opts.sets ?? [TEST_SET],
      collections: opts.collections ?? [TEST_COLLECTION, APPROVAL_COLLECTION],
      devices: opts.devices ?? [device()],
      posts: opts.posts ?? [],
    });
    TestBed.inject(AccountsStore).list.set(opts.accounts ?? [...ACCOUNTS, FB, OTHER_ACCOUNT]);
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
  async function followed(over: Partial<ApiPost>): Promise<void> {
    for (const r of http.match((x) => x.url === POSTS_URL && span(x) <= 26 * HOUR))
      r.flush([testPostDto(over)]);
    await settle();
    refreshReads([testPostDto(over)]);
    flushBackground(http);
    await rerender();
  }

  afterEach(() => {
    try {
      // Whatever the other stores asked for on events is not what these specs look at.
      flushBackground(http);
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

    it('lists the sets, the usable groups with their codes, the collections and the posts', () => {
      const texts = (sel: HTMLSelectElement) =>
        [...sel.options].filter((o) => !o.disabled).map((o) => o.textContent!.trim());
      expect(texts(select(t().test.set))).toEqual(['Condo groups']);
      expect(texts(select(t().test.group))).toEqual([
        'Condo BKK (#Jan24)',
        'Condo rent',
        'Facebook · Laptop · โปรไฟล์',
      ]);
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
  });

  describe('why a test cannot start', () => {
    it('says so above the form and keeps the button off when the extension is offline', async () => {
      await open({ offline: true });
      expect(el.querySelector('.alert')!.textContent).toContain(t().test.needOnline);
      expect(el.querySelector('.alert .ph-wifi-slash')).not.toBeNull();
      expect(runBtn().disabled).toBe(true);
    });

    it('says so when no browser has brought a Facebook account yet', async () => {
      await open({ accounts: ACCOUNTS, devices: [] });
      expect(el.querySelector('.alert')!.textContent).toContain(t().api.engine.testNoAccount);
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

    it('warns that the paired browser is paused, without stopping the test', async () => {
      await open({ devices: [device({ jobsPaused: true })] });
      expect(el.querySelector('.callout')!.textContent).toContain(t().api.engine.testPaused);
      expect(runBtn().disabled).toBe(false);
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
  });
});

import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { assistStorage } from '../../core/auth/token';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LibraryStore } from '../../core/data/library.store';
import { MediaItem } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { SettingsStore } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { localDateKey, utcOffsetMinutes } from '../../core/flow/schedule-math';
import { ApiCollection, ApiLinkSet, ApiRole, ApiSchedule } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  ACCOUNTS,
  WS,
  answerThumbs,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import {
  apiCollection,
  apiCollectionPost,
  apiLinkSet,
  apiSetLink,
} from '../../testing/collection-fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED } from '../../testing/link-sets.fixtures';
import {
  SCHEDULES_URL,
  answerChangeRefresh,
  apiSchedule,
  apiScheduleCreated,
} from '../../testing/schedules.fixtures';
import { ScheduleFormService } from './schedule-form.service';
import { SchedulesPageComponent } from './schedules-page.component';

const POSTS = [1, 2, 3].map((i) => apiCollectionPost({ id: `p${i}` }));
const C1 = apiCollection({
  id: 'c1',
  name: 'Condo posts',
  icon: 'ph-buildings',
  posts: POSTS,
  scheduleCount: 1,
});
const C2 = apiCollection({ id: 'c2', name: 'Empty collection' });
const C3 = apiCollection({
  id: 'c3',
  name: 'Needs approval',
  settings: { requireApproval: true },
  posts: [apiCollectionPost({ id: 'p9', approval: 'draft' })],
});
const LINK_A = apiSetLink({ id: 'a', name: 'Condo BKK', code: '#Jan24' });
const LINK_B = apiSetLink({ id: 'b', name: 'Condo rent' });
const LINK_OFF = apiSetLink({ id: 'c', name: 'Switched off', enabled: false });
const LINK_BAD = apiSetLink({ id: 'd', name: 'Not a group', url: 'x', valid: false });
const LINK_DUP = apiSetLink({ id: 'e', name: 'Again', url: LINK_A.url, duplicate: true });
const S1 = apiLinkSet({
  id: 's1',
  name: 'Condo groups',
  links: [LINK_A, LINK_B, LINK_OFF, LINK_BAD, LINK_DUP],
  scheduleCount: 1,
});
const S2 = apiLinkSet({ id: 's2', name: 'No groups', links: [LINK_OFF] });
const MORNING = apiSchedule({
  id: 'sc1',
  name: 'Morning posts',
  collectionId: 'c1',
  linkSetId: 's1',
  todayCount: 3,
  nextRunAt: '2026-10-05T02:00:00Z',
});
const TOMORROW = localDateKey(new Date(Date.now() + 864e5));

describe('SchedulesPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function open(
    opts: {
      role?: ApiRole;
      assist?: boolean;
      schedules?: ApiSchedule[];
      collections?: ApiCollection[];
      linkSets?: ApiLinkSet[];
      connected?: boolean;
      /** Simple mode off: the builder's "more" section starts open. */
      simple?: boolean;
      url?: string;
      /** Answer the schedules only when the test says so. */
      holdSchedules?: boolean;
      /** The owner's plan includes bumping (Premium); the default owner is on Pro, which does not. */
      bump?: boolean;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [SchedulesPageComponent],
      providers: [
        provideRouter(
          [
            { path: 'app/schedules', component: SchedulesPageComponent },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
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
    if (opts.simple === false) TestBed.inject(UiPrefsService).set(false);
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(SettingsStore);
    TestBed.inject(SchedulesStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LibraryStore);
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner', bump: opts.bump ?? false },
      schedules: opts.holdSchedules ? [] : (opts.schedules ?? [MORNING]),
      collections: opts.collections ?? [C1, C2, C3],
      linkSets: opts.linkSets ?? [S1, S2],
    });
    TestBed.inject(AccountsStore).list.set(
      opts.connected === false ? ACCOUNTS : [...ACCOUNTS, FB_CONNECTED],
    );
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(opts.url ?? '/app/schedules', SchedulesPageComponent);
    await settle();
    // The page reads the schedules again when it opens (their figures move all the time).
    for (const r of http.match(SCHEDULES_URL)) r.flush(opts.schedules ?? [MORNING]);
    await settle();
    harness.detectChanges();
    return {
      fixture: harness.fixture as ComponentFixture<unknown>,
      el: harness.routeNativeElement!,
    };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const builder = (el: HTMLElement) => el.querySelector<HTMLElement>('app-schedule-builder');
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );
  const exact = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === text,
    );
  const field = (root: ParentNode, label: string) =>
    [...root.querySelectorAll<HTMLElement>('app-input-field, app-select-field')].find(
      (f) => f.querySelector('label')?.textContent?.trim() === label,
    );
  const input = (root: ParentNode, label: string) =>
    field(root, label)!.querySelector<HTMLInputElement>('input')!;
  const select = (root: ParentNode, label: string) =>
    field(root, label)!.querySelector<HTMLSelectElement>('select')!;
  const type = (el: HTMLInputElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const pick = (el: HTMLSelectElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event('change'));
  };
  const rowsOf = (el: HTMLElement) => [
    ...el.querySelectorAll<HTMLElement>('app-schedule-list .item'),
  ];
  const chips = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.tchip')];
  const chip = (el: HTMLElement, time: string) =>
    chips(el).find((c) => c.textContent?.trim() === time)!;
  const summary = (el: HTMLElement) => el.querySelector('.summary span')?.textContent;
  const err = (el: HTMLElement) => el.querySelector('.builder .err')?.textContent;
  const create = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('.foot .su-btn-primary')][0];
  const openBuilder = async (el: HTMLElement, fixture: ComponentFixture<unknown>) => {
    button(el, t().sch.newSch)!.click();
    await settle();
    fixture.detectChanges();
    // The best hours are asked for when the builder opens.
    for (const r of http.match((x) => x.url === `${SCHEDULES_URL}/best-times`))
      r.flush(['09:00', '12:00', '19:00']);
    await settle();
    fixture.detectChanges();
  };
  /** Picks a collection and a link set in the builder. */
  const pair = async (el: HTMLElement, fixture: ComponentFixture<unknown>, c = 'c1', s = 's1') => {
    pick(select(el, t().sch.collection), c);
    pick(select(el, t().sch.set), s);
    await settle();
    fixture.detectChanges();
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('route', () => {
    it('is a lazy page of the signed-in area, titled with its dictionary text', async () => {
      const route = routes
        .find((r) => r.path === 'app')!
        .children!.find((c) => c.path === 'schedules')!;
      expect(route.title).toBe('nav.schedules');
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(SchedulesPageComponent);
    });
  });

  describe('page', () => {
    it('shows the title, the subtitle and the stepper on step 4, with the builder closed', async () => {
      const { el } = await open();
      expect(el.querySelector('h1')?.textContent).toBe(t().sch.title);
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().sch.sub);
      expect(el.querySelector('a.step[aria-current="step"] .num')?.textContent?.trim()).toBe('4');
      expect(builder(el)).toBeNull();
    });

    it('has the next-step card that goes to the calendar, in simple mode only', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      expect(el.querySelector('.next')?.textContent).toContain(t().flow.n3);
      el.querySelector<HTMLButtonElement>('.next button')!.click();
      expect(navigate).toHaveBeenCalledWith('/app/calendar');
    });

    it('hides the next-step card when simple mode is off', async () => {
      const { el } = await open({ simple: false });
      expect(el.querySelector('.next')).toBeNull();
    });

    it('waits for the schedules before it lists any', async () => {
      const { fixture, el } = await open();
      TestBed.inject(SchedulesStore).loaded.set(false);
      fixture.detectChanges();
      expect(el.querySelector('app-schedule-list')?.textContent).toContain(t().api.loading);
      expect(rowsOf(el)).toHaveLength(0);
      expect(el.querySelector('app-schedule-list app-empty-state')).toBeNull();
    });

    it('says so when there is no schedule yet', async () => {
      const { el } = await open({ schedules: [] });
      expect(rowsOf(el)).toHaveLength(0);
      expect(el.querySelector('app-schedule-list app-empty-state')?.textContent).toContain(
        t().api.flow.emptySchedulesTitle,
      );
    });

    it('sends the person to create a collection or a link set when there is none', async () => {
      const { el } = await open({ collections: [], linkSets: [] });
      const links = [...el.querySelectorAll<HTMLAnchorElement>('.setup a')];
      expect(links.map((a) => a.getAttribute('href'))).toEqual([
        '/app/collections',
        '/app/targets',
      ]);
      expect(links.map((a) => a.textContent?.trim())).toEqual([
        t().api.flow.schGoCollections,
        t().api.flow.schGoLinkSets,
      ]);
    });

    it('shows no such notice when both exist', async () => {
      const { el } = await open();
      expect(el.querySelector('.setup')).toBeNull();
    });

    it('says a computer must be paired first when no Facebook account is connected', async () => {
      const { el } = await open({ connected: false });
      const note = el.querySelector('.callout')!;
      expect(note.textContent).toContain(t().api.flow.needDevice);
      expect(note.querySelector('a')?.getAttribute('href')).toBe('/app/team?pair=1');
    });

    it('has no such notice when a browser is paired', async () => {
      const { el } = await open();
      expect(el.querySelector('.callout')).toBeNull();
    });
  });

  describe('the list', () => {
    it('shows a schedule with its collection and set, cadence, today, next run and status', async () => {
      const { el } = await open();
      const row = rowsOf(el)[0];
      expect(row.querySelector('.fw6')?.textContent).toBe('Morning posts');
      expect(row.querySelector('.pico i')?.className).toContain('ph-buildings');
      const lines = [...row.querySelectorAll('.info .small')].map((n) => n.textContent);
      expect(lines[0]).toBe('Condo posts → Condo groups');
      expect(lines[1]).toBe(
        [t().sch.mDaily, '09:00, 18:00', fmt(t().sch.perDay, { n: 4 }), t().sch.oShuffle].join(
          ' · ',
        ),
      );
      expect(row.querySelector('.when')?.firstElementChild?.textContent).toBe(
        fmt(t().sch.today, { n: 3 }),
      );
      expect(row.querySelector('.when .small')?.textContent).toContain(t().sch.nextRun);
      expect(row.querySelector('.when .small')?.textContent).not.toContain('—');
      expect(row.querySelector('.status')?.textContent?.trim()).toBe(t().sch.active);
      expect(button(row, t().sch.pause)).toBeDefined();
    });

    it('shows a paused schedule as paused, with no next run, and offers to resume it', async () => {
      const paused = apiSchedule({ id: 'sc2', name: 'Paused one', active: false });
      const { el } = await open({ schedules: [paused] });
      const row = rowsOf(el)[0];
      expect(row.querySelector('.status')?.textContent?.trim()).toBe(t().sch.pausedL);
      expect(row.querySelector('.when .small')?.textContent).toBe(`${t().sch.nextRun}: —`);
      expect(button(row, t().sch.resume)).toBeDefined();
    });

    it('says a "once" schedule whose day has passed is finished, and offers no resume', async () => {
      const once = apiSchedule({
        id: 'sc3',
        name: 'One day',
        mode: 'once',
        active: false,
        startDate: '2020-01-01',
        onceTime: '14:00',
        slots: ['14:00'],
        perDay: 2,
      });
      const { el } = await open({ schedules: [once] });
      const row = rowsOf(el)[0];
      expect(row.querySelector('.status')?.textContent?.trim()).toBe(t().api.flow.schFinished);
      expect(button(row, t().sch.resume)).toBeUndefined();
      expect(button(row, t().sch.pause)).toBeUndefined();
      expect(button(row, t().sch.remove)).toBeDefined();
    });

    it('shows the bump as a line of its own and says only the auto-delete is saved', async () => {
      const kept = apiSchedule({
        id: 'sc4',
        bumpHours: 2,
        bump: { rounds: 2, text: '', mediaIds: ['m1'], imagesEach: 1 },
        autoDeleteDays: 7,
      });
      const { el } = await open({ schedules: [kept] });
      const info = rowsOf(el)[0].querySelector('.info')!;
      expect(info.querySelector('.bump-line')!.textContent!.trim()).toBe(
        `${fmt(t().api.flow.schBumpLine, { h: 2, n: 2 })} · ${fmt(t().api.flow.schBumpLineImg, { k: 1 })}`,
      );
      // The bump is real now: it does not carry the "saved only" badge, the auto-delete still does.
      const stored = info.querySelector('[title]')!;
      expect(stored.textContent).toContain(fmt(t().sch.autoDelD, { d: 7 }));
      expect(stored.textContent).toContain(t().api.flow.storedOnlyBadge);
      expect(info.querySelector('.bump-line')!.textContent).not.toContain(
        t().api.flow.storedOnlyBadge,
      );
    });

    it('has no bump line for a schedule that does not bump', async () => {
      const { el } = await open();
      expect(rowsOf(el)[0].querySelector('.bump-line')).toBeNull();
    });

    it('opens the calendar on the day of the next run', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(rowsOf(el)[0], t().sch.viewCal)!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/calendar'], {
        queryParams: { day: localDateKey(new Date(MORNING.nextRunAt!)) },
      });
    });

    it('opens the calendar on today when there is no next run', async () => {
      const none = apiSchedule({ id: 'sc5', nextRunAt: null });
      const { el } = await open({ schedules: [none] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(rowsOf(el)[0], t().sch.viewCal)!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/calendar'], {
        queryParams: { day: TestBed.inject(PostsStore).todayKey() },
      });
    });

    it('pauses: calls the API, toasts, and reads the queue again', async () => {
      const { fixture, el } = await open();
      button(rowsOf(el)[0], t().sch.pause)!.click();
      await settle();
      fixture.detectChanges();
      expect(button(rowsOf(el)[0], t().sch.resume)).toBeUndefined();
      const req = http.expectOne(`${SCHEDULES_URL}/sc1/active`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ active: false });
      req.flush({ ...MORNING, active: false, nextRunAt: null });
      await settle();
      expect(answerChangeRefresh(http).posts).toBeGreaterThan(0);
      await settle();
      fixture.detectChanges();
      expect(rowsOf(el)[0].querySelector('.status')?.textContent?.trim()).toBe(t().sch.pausedL);
      expect(toasts().map((x) => x.message)).toContain(fmt(t().sch.paused, { s: 'Morning posts' }));
    });

    it('resumes: calls the API with active=true and toasts', async () => {
      const paused = { ...MORNING, active: false, nextRunAt: null };
      const { fixture, el } = await open({ schedules: [paused] });
      button(rowsOf(el)[0], t().sch.resume)!.click();
      await settle();
      const req = http.expectOne(`${SCHEDULES_URL}/sc1/active`);
      expect(req.request.body).toEqual({ active: true });
      req.flush(MORNING);
      await settle();
      expect(answerChangeRefresh(http).posts).toBeGreaterThan(0);
      await settle();
      fixture.detectChanges();
      expect(rowsOf(el)[0].querySelector('.status')?.textContent?.trim()).toBe(t().sch.active);
      expect(toasts().map((x) => x.message)).toContain(
        fmt(t().sch.resumed, { s: 'Morning posts' }),
      );
    });

    it('deletes at once: calls the API, drops the row, reads the queue again and toasts', async () => {
      const { fixture, el } = await open();
      button(rowsOf(el)[0], t().sch.remove)!.click();
      await settle();
      const req = http.expectOne(`${SCHEDULES_URL}/sc1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await settle();
      expect(answerChangeRefresh(http).posts).toBeGreaterThan(0);
      await settle();
      fixture.detectChanges();
      expect(rowsOf(el)).toHaveLength(0);
      expect(toasts().map((x) => x.message)).toContain(
        fmt(t().sch.deleted, { s: 'Morning posts' }),
      );
    });

    it('keeps the row and does not toast a success when the pause is refused', async () => {
      const { fixture, el } = await open();
      button(rowsOf(el)[0], t().sch.pause)!.click();
      await settle();
      http.expectOne(`${SCHEDULES_URL}/sc1/active`).flush('x', { status: 500, statusText: 'x' });
      await settle();
      fixture.detectChanges();
      expect(rowsOf(el)[0].querySelector('.status')?.textContent?.trim()).toBe(t().sch.active);
      expect(toasts()).toHaveLength(0);
      expect(button(rowsOf(el)[0], t().sch.pause)!.disabled).toBe(false);
    });
  });

  describe('rename', () => {
    const renameButton = (el: HTMLElement) =>
      rowsOf(el)[0].querySelector<HTMLButtonElement>('.btns .ibtn')!;

    it('renames a schedule through the dialog and keeps everything else', async () => {
      const { fixture, el } = await open();
      renameButton(el).click();
      fixture.detectChanges();
      await settle();
      const input = el.querySelector<HTMLInputElement>('app-rename-modal input')!;
      expect(input.value).toBe('Morning posts');
      input.value = '  Evening posts ';
      input.dispatchEvent(new Event('input'));
      el.querySelector<HTMLFormElement>('#rename-form')!.requestSubmit();
      await settle();
      const req = http.expectOne(`${SCHEDULES_URL}/sc1/name`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Evening posts' });
      req.flush({ ...MORNING, name: 'Evening posts' });
      await settle();
      fixture.detectChanges();
      expect(rowsOf(el)[0].querySelector('.fw6')?.textContent?.trim()).toBe('Evening posts');
      expect(rowsOf(el)[0].querySelector('.status')?.textContent?.trim()).toBe(t().sch.active);
      expect(el.querySelector('app-rename-modal .su-modal-panel')).toBeNull();
      expect(toasts().map((x) => x.message)).toContain(t().api.itemRenamed);
    });

    it('does not call the API when the name did not change', async () => {
      const { fixture, el } = await open();
      renameButton(el).click();
      fixture.detectChanges();
      await settle();
      el.querySelector<HTMLFormElement>('#rename-form')!.requestSubmit();
      await settle();
      http.expectNone(`${SCHEDULES_URL}/sc1/name`);
      expect(el.querySelector('app-rename-modal .su-modal-panel')).toBeNull();
    });

    it('keeps the dialog open when the name is refused', async () => {
      const { fixture, el } = await open();
      renameButton(el).click();
      fixture.detectChanges();
      await settle();
      const input = el.querySelector<HTMLInputElement>('app-rename-modal input')!;
      input.value = 'New';
      input.dispatchEvent(new Event('input'));
      el.querySelector<HTMLFormElement>('#rename-form')!.requestSubmit();
      await settle();
      http
        .expectOne(`${SCHEDULES_URL}/sc1/name`)
        .flush({ title: 'no' }, { status: 422, statusText: 'Unprocessable' });
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('app-rename-modal .su-modal-panel')).not.toBeNull();
      expect(rowsOf(el)[0].querySelector('.fw6')?.textContent?.trim()).toBe('Morning posts');
    });

    it('is off for a viewer', async () => {
      const { el } = await open({ role: 'viewer' });
      expect(renameButton(el).disabled).toBe(true);
    });
  });

  describe('permissions', () => {
    it.each([
      ['viewer', true],
      ['editor', false],
      ['admin', false],
      ['owner', false],
    ] as const)('%s: new schedule, pause and delete are off = %s', async (role, off) => {
      const { el } = await open({ role });
      expect(button(el, t().sch.newSch)!.disabled).toBe(off);
      const row = rowsOf(el)[0];
      expect(button(row, t().sch.pause)!.disabled).toBe(off);
      expect(button(row, t().sch.remove)!.disabled).toBe(off);
      // Seeing a schedule on the calendar is reading.
      expect(button(row, t().sch.viewCal)!.disabled).toBe(false);
      expect(!!el.querySelector('.perm-note')).toBe(off);
    });

    it('is read-only in assist mode', async () => {
      const { el } = await open({ assist: true });
      expect(button(el, t().sch.newSch)!.disabled).toBe(true);
      expect(button(rowsOf(el)[0], t().sch.pause)!.disabled).toBe(true);
    });

    it('does not call the API from a disabled button', async () => {
      const { el } = await open({ role: 'viewer' });
      button(rowsOf(el)[0], t().sch.pause)!.click();
      button(rowsOf(el)[0], t().sch.remove)!.click();
      await settle();
      http.expectNone((r) => r.url.startsWith(`${SCHEDULES_URL}/sc1`));
    });
  });

  describe('the builder', () => {
    it('opens with "new schedule" and closes with cancel', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      expect(builder(el)).not.toBeNull();
      expect(builder(el)!.querySelector('h2')?.textContent).toBe(t().sch.builderTitle);
      button(builder(el)!, t().common.cancel)!.click();
      fixture.detectChanges();
      expect(builder(el)).toBeNull();
      // "New schedule" again opens it, and a second press while open closes it.
      button(el, t().sch.newSch)!.click();
      fixture.detectChanges();
      expect(builder(el)).not.toBeNull();
      button(el, t().sch.newSch)!.click();
      fixture.detectChanges();
      expect(builder(el)).toBeNull();
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('starts with the six basic fields, today as the start date and an empty summary', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      const labels = [...builder(el)!.querySelectorAll('.grid:first-of-type label')].map((l) =>
        l.textContent?.trim(),
      );
      expect(labels).toEqual([
        t().sch.name,
        t().sch.collection,
        t().sch.set,
        t().sch.mode,
        t().api.flow.schStartLabel,
        t().sch.start,
      ]);
      expect(input(el, t().sch.start).value).toBe(TestBed.inject(PostsStore).todayKey());
      expect(input(el, t().sch.start).type).toBe('date');
      expect(input(el, t().sch.name).maxLength).toBe(120);
      expect(select(el, t().sch.mode).value).toBe('daily');
      expect(summary(el)).toBe(t().sch.summaryEmpty);
    });

    it('lists the six patterns, the collections and the link sets', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      const options = (label: string) =>
        [...select(el, label).querySelectorAll('option:not([disabled])')].map((o) => [
          (o as HTMLOptionElement).value,
          o.textContent,
        ]);
      expect(options(t().sch.mode)).toEqual([
        ['daily', t().sch.mDaily],
        ['weekdays', t().sch.mWeekdays],
        ['weekend', t().sch.mWeekend],
        ['interval', t().sch.mInterval],
        ['drip', t().sch.mDrip],
        ['once', t().sch.mOnce],
      ]);
      expect(options(t().sch.collection)).toEqual([
        ['c1', 'Condo posts'],
        ['c2', 'Empty collection'],
        ['c3', 'Needs approval'],
      ]);
      expect(options(t().sch.set)).toEqual([
        ['s1', 'Condo groups'],
        ['s2', 'No groups'],
      ]);
    });

    it('keeps "more" closed in simple mode and opens it with its toggle', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      expect(chips(el)).toHaveLength(0);
      button(builder(el)!, t().common.more)!.click();
      fixture.detectChanges();
      expect(chips(el).length).toBeGreaterThan(0);
      button(builder(el)!, t().common.less)!.click();
      fixture.detectChanges();
      expect(chips(el)).toHaveLength(0);
    });

    it('opens "more" by itself when simple mode is off, and the choice then stays', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      expect(chips(el).length).toBeGreaterThan(0);
      button(builder(el)!, t().common.less)!.click();
      fixture.detectChanges();
      expect(chips(el)).toHaveLength(0);
    });

    it('summarises what it makes once a collection, a set and a time are chosen', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      // Two groups that are on and valid (the repeated address is left out), at two times, from three usable
      // posts, with the workspace's wait of 3-12 minutes.
      expect(summary(el)).toBe(fmt(t().sch.summary, { n: 4, m: 2, p: 3, a: 3, b: 12 }));
    });

    it('warns when the Facebook posts of a day go over the daily limit, which the server would fail', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      const over = () => builder(el)!.querySelector<HTMLElement>('.over');
      expect(over()).toBeNull(); // 4 Facebook posts a day under the default 40

      const settings = TestBed.inject(SettingsStore);
      expect(settings.loaded()).toBe(true);
      settings.patchAb({ limits: { ...settings.ab().limits, fb: 3 } });
      await settle();
      fixture.detectChanges();
      // Two groups at two times.
      expect(over()!.querySelector('span')!.textContent).toBe(
        fmt(t().api.flow.schOverLimit, { n: 4, limit: 3, max: 500 }),
      );
      expect(over()!.querySelector('a')!.getAttribute('href')).toBe('/app/antiban');
    });

    it('counts only the approved posts of a collection that needs approval', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture, 'c3');
      expect(summary(el)).toBe(fmt(t().sch.summary, { n: 4, m: 2, p: 0, a: 3, b: 12 }));
    });

    it('says "once" in the summary, with the date and the time', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      pick(select(el, t().sch.mode), 'once');
      fixture.detectChanges();
      type(input(el, t().sch.onceDate), '2026-12-25');
      fixture.detectChanges();
      button(builder(el)!, t().common.more)!.click();
      fixture.detectChanges();
      expect(summary(el)).toBe(fmt(t().sch.summaryOnce, { n: 2, m: 2, d: '25 ธ.ค.', t: '14:00' }));
    });

    it('says the auto-delete is only saved (the bump is real and has its own section)', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      const hints = [...builder(el)!.querySelectorAll('.stored')].map((n) => n.textContent?.trim());
      expect(hints).toEqual([t().api.flow.storedOnly]);
      expect(field(el, t().sch.autoDel)!.parentElement?.querySelector('.stored')).not.toBeNull();
      // No "saved only" hint inside the bump section.
      expect(builder(el)!.querySelector('app-schedule-bump .stored')).toBeNull();
    });

    it('explains how posts are picked for each order', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(t().sch.shuffleNote);
      pick(select(el, t().sch.order), 'rotate');
      fixture.detectChanges();
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(t().sch.rotateNote);
    });
  });

  describe('times', () => {
    const times = (el: HTMLElement) =>
      chips(el)
        .filter((c) => c.classList.contains('on'))
        .map((c) => c.textContent?.trim());

    it('offers 06:00 to 22:00, with 09:00 and 18:00 chosen to begin with', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      expect(chips(el)).toHaveLength(17);
      expect(chips(el)[0].textContent?.trim()).toBe('06:00');
      expect(chips(el)[16].textContent?.trim()).toBe('22:00');
      expect(times(el)).toEqual(['09:00', '18:00']);
      expect(chip(el, '09:00').getAttribute('aria-pressed')).toBe('true');
      expect(chip(el, '10:00').getAttribute('aria-pressed')).toBe('false');
    });

    it('chooses and drops times, and the summary follows', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      chip(el, '12:00').click();
      chip(el, '09:00').click();
      fixture.detectChanges();
      expect(times(el)).toEqual(['12:00', '18:00']);
      chip(el, '12:00').click();
      chip(el, '18:00').click();
      fixture.detectChanges();
      expect(times(el)).toEqual([]);
      expect(summary(el)).toBe(t().sch.summaryEmpty);
    });

    it('adds a time of its own as a chip, in order, and empties the box', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      type(input(el, t().sch.addTime), '9:30, 23.15');
      fixture.detectChanges();
      exact(builder(el)!, t().sch.add)!.click();
      fixture.detectChanges();
      expect(times(el)).toEqual(['09:00', '09:30', '18:00', '23:15']);
      expect(chips(el)).toHaveLength(19);
      expect(input(el, t().sch.addTime).value).toBe('');
      expect(err(el)).toBeUndefined();
    });

    it.each(['25:00', 'abc', '', '9:30 nope'])('refuses "%s" with the time error', async (text) => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      type(input(el, t().sch.addTime), text);
      exact(builder(el)!, t().sch.add)!.click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().sch.errTime);
      expect(times(el)).toEqual(['09:00', '18:00']);
    });

    it('suggests the best hours of the last 30 days and uses them on request', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      expect(builder(el)!.querySelector('.best span')?.textContent).toBe(
        fmt(t().sch.bestTime, { t: '09:00, 12:00, 19:00' }),
      );
      button(builder(el)!, t().sch.useBest)!.click();
      fixture.detectChanges();
      expect(times(el)).toEqual(['09:00', '12:00', '19:00']);
    });

    it('asks for the hours in the time zone of this browser', async () => {
      const { fixture, el } = await open({ simple: false });
      button(el, t().sch.newSch)!.click();
      await settle();
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url === `${SCHEDULES_URL}/best-times`);
      expect(req.request.params.get('utcOffsetMinutes')).toBe(String(utcOffsetMinutes()));
      req.flush([]);
      await settle();
      fixture.detectChanges();
      // No history: a dash, and nothing to use.
      expect(builder(el)!.querySelector('.best span')?.textContent).toBe(
        fmt(t().sch.bestTime, { t: '—' }),
      );
      expect(button(builder(el)!, t().sch.useBest)!.disabled).toBe(true);
    });

    it('asks once, however often the builder is opened', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      button(builder(el)!, t().common.cancel)!.click();
      button(el, t().sch.newSch)!.click();
      await settle();
      http.expectNone((r) => r.url.endsWith('/best-times'));
      fixture.detectChanges();
    });
  });

  describe('the other patterns', () => {
    it('rounds every N hours: first round, spacing and the rounds of a day', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      pick(select(el, t().sch.mode), 'interval');
      fixture.detectChanges();
      expect(chips(el)).toHaveLength(0);
      expect(input(el, t().sch.firstRound).type).toBe('time');
      const every = builder(el)!.querySelector<HTMLInputElement>('#sch-every')!;
      expect([every.min, every.max, every.value]).toEqual(['1', '24', '6']);
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(
        fmt(t().sch.roundsPreview, { t: '09:00, 15:00, 21:00' }),
      );
      every.value = '8';
      every.dispatchEvent(new Event('change'));
      type(input(el, t().sch.firstRound), '06:30');
      fixture.detectChanges();
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(
        fmt(t().sch.roundsPreview, { t: '06:30, 14:30, 22:30' }),
      );
      // A silly number is cut to what the server takes.
      every.value = '99';
      every.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(every.value).toBe('24');
    });

    it('once: has a time of its own and its start label says "post date"', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      pick(select(el, t().sch.mode), 'once');
      fixture.detectChanges();
      expect(chips(el)).toHaveLength(0);
      expect(input(el, t().sch.onceTime).value).toBe('14:00');
      expect(field(el, t().sch.onceDate)).toBeDefined();
      expect(field(el, t().sch.start)).toBeUndefined();
    });

    it('drip: window and count, with the times it spreads to', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      pick(select(el, t().sch.mode), 'drip');
      fixture.detectChanges();
      expect(input(el, t().sch.dripFrom).value).toBe('09:00');
      expect(input(el, t().sch.dripTo).value).toBe('21:00');
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(
        fmt(t().sch.dripPreview, { t: '09:00, 15:00, 21:00' }),
      );
      const n = builder(el)!.querySelector<HTMLInputElement>('#sch-drip-n')!;
      n.value = '5';
      n.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(builder(el)!.querySelector('.note')?.textContent).toBe(
        fmt(t().sch.dripPreview, { t: '09:00, 12:00, 15:00, 18:00, 21:00' }),
      );
      n.value = '40';
      n.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(n.value).toBe('12');
    });
  });

  describe('per-group times', () => {
    const rows = (el: HTMLElement) => [
      ...el.querySelectorAll<HTMLElement>('app-schedule-overrides .member'),
    ];

    it('asks to choose a link set first', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      expect(el.querySelector('app-schedule-overrides')?.textContent).toContain(
        t().sch.pickSetFirst,
      );
      expect(rows(el)).toHaveLength(0);
    });

    it('has a row for every group or page that is on and valid, and no other accounts', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      expect(rows(el).map((r) => r.querySelector('.ellipsis')?.textContent)).toEqual([
        'Condo BKK',
        'Condo rent',
      ]);
      // The group with a code shows it, and the note counts the coded groups.
      expect(rows(el)[0].querySelector('.small')?.textContent).toBe(`${t().cal.code} #Jan24`);
      expect(rows(el)[1].querySelector('.small')).toBeNull();
      expect(el.querySelector('app-schedule-overrides .codes')?.textContent).toContain(
        fmt(t().sch.codeNote, { n: 1 }),
      );
      expect(rows(el)[0].querySelector('input')!.placeholder).toBe(t().sch.followSchedule);
    });

    it('lists a Facebook page next to the groups, with its own icon, and counts it', async () => {
      const page = apiSetLink({
        id: 'p',
        name: 'Baan Dee page',
        url: 'https://www.facebook.com/baandee.shop',
      });
      const set = apiLinkSet({ id: 's3', name: 'Groups and a page', links: [LINK_A, page] });
      const { fixture, el } = await open({ simple: false, linkSets: [S1, S2, set] });
      await openBuilder(el, fixture);
      await pair(el, fixture, 'c1', 's3');
      expect(rows(el).map((r) => r.querySelector('.ellipsis')?.textContent)).toEqual([
        'Condo BKK',
        'Baan Dee page',
      ]);
      expect(rows(el)[0].querySelector('.ph-users-three')).not.toBeNull();
      expect(rows(el)[1].querySelector('.ph-flag')).not.toBeNull();
      expect(summary(el)).toBe(fmt(t().sch.summary, { n: 4, m: 2, p: 3, a: 3, b: 12 }));
    });

    it("counts the posts of a group with its own times, not the schedule's", async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      type(rows(el)[0].querySelector('input')!, '08:00, 12:00, 20:00');
      fixture.detectChanges();
      // Three for the first group, two for the other.
      expect(summary(el)).toBe(fmt(t().sch.summary, { n: 5, m: 2, p: 3, a: 3, b: 12 }));
    });

    it('forgets the typed times when another link set is chosen', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      type(rows(el)[0].querySelector('input')!, '08:00');
      pick(select(el, t().sch.set), 's2');
      fixture.detectChanges();
      pick(select(el, t().sch.set), 's1');
      fixture.detectChanges();
      expect(rows(el)[0].querySelector('input')!.value).toBe('');
    });

    it('says a set with no usable group has nothing to post to', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture, 'c1', 's2');
      expect(rows(el)).toHaveLength(0);
      expect(el.querySelector('app-schedule-overrides .note')?.textContent).toBe(
        t().api.flow.schNoTargets,
      );
    });
  });

  describe('creating', () => {
    const body = (over: Record<string, unknown> = {}) => ({
      name: null,
      collectionId: 'c1',
      linkSetId: 's1',
      mode: 'daily',
      times: ['09:00', '18:00'],
      everyHours: 6,
      firstTime: '09:00',
      startDate: TestBed.inject(PostsStore).todayKey(),
      onceTime: '14:00',
      order: 'shuffle',
      dripFrom: '09:00',
      dripTo: '21:00',
      dripCount: 3,
      bumpHours: 0,
      autoDeleteDays: 0,
      overrides: {},
      utcOffsetMinutes: utcOffsetMinutes(),
      startNow: false,
      repeat: 'recent',
      ...over,
    });
    const NEW = apiSchedule({ id: 'new', name: 'Condo posts → Condo groups' });

    it('sends the pairing and the default times, then goes to the calendar on the first post day', async () => {
      const { fixture, el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await openBuilder(el, fixture);
      await pair(el, fixture);
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body());
      req.flush(apiScheduleCreated(NEW, { created: 28, firstAt: '2026-10-06T02:00:00Z' }));
      await settle();
      answerChangeRefresh(http);
      await settle();
      fixture.detectChanges();
      expect(toasts().map((x) => x.message)).toContain(
        fmt(t().sch.created, { s: 'Condo posts → Condo groups', n: 28 }),
      );
      expect(navigate).toHaveBeenCalledWith(['/app/calendar'], {
        queryParams: { day: localDateKey(new Date('2026-10-06T02:00:00Z')) },
      });
      // The form starts over for the next schedule.
      expect(builder(el)).toBeNull();
      expect(rowsOf(el)).toHaveLength(2);
    });

    it('starts right away when asked: no date, startNow true, and a note about the first round', async () => {
      const { fixture, el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await openBuilder(el, fixture);
      await pair(el, fixture);
      pick(select(el, t().api.flow.schStartLabel), 'now');
      fixture.detectChanges();
      expect(builder(el)!.textContent).toContain(t().api.flow.schStartNowNote);
      // The date has nothing to say any more.
      expect(builder(el)!.querySelector('input[type="date"]')).toBeNull();
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      expect(req.request.body).toEqual(body({ startDate: null, startNow: true }));
      req.flush(apiScheduleCreated(NEW, { created: 28, firstAt: '2026-10-06T02:00:00Z' }));
      await settle();
      answerChangeRefresh(http);
      await settle();
      expect(navigate).toHaveBeenCalled();
    });

    it('sends the chosen repeat of a post to a group, and explains each choice', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      const f = t().api.flow;
      const note = () => builder(el)!.textContent;
      expect(select(el, f.repeatLabel).value).toBe('recent');
      expect(note()).toContain(f.repeatRecentNote);
      pick(select(el, f.repeatLabel), 'any');
      fixture.detectChanges();
      expect(note()).toContain(f.repeatAnyNote);
      pick(select(el, f.repeatLabel), 'never');
      fixture.detectChanges();
      expect(note()).toContain(f.repeatNeverNote);
      // Rotating in order does not pick at random: the choice is off and says so.
      pick(select(el, t().sch.order), 'rotate');
      fixture.detectChanges();
      expect(select(el, f.repeatLabel).disabled).toBe(true);
      expect(note()).toContain(f.repeatRotateNote);
      pick(select(el, t().sch.order), 'shuffle');
      fixture.detectChanges();
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      expect(req.request.body).toEqual(body({ repeat: 'never' }));
      req.flush(apiScheduleCreated(NEW, { created: 0 }));
      await settle();
      answerChangeRefresh(http);
      await settle();
    });

    it('hides the time of a once schedule that starts now and says what it does', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      pick(select(el, t().sch.mode), 'once');
      fixture.detectChanges();
      button(builder(el)!, t().common.more)!.click();
      fixture.detectChanges();
      const labels = () =>
        [...builder(el)!.querySelectorAll('label')].map((l) => l.textContent?.trim());
      expect(labels()).toContain(t().sch.onceTime);
      pick(select(el, t().api.flow.schStartLabel), 'now');
      fixture.detectChanges();
      expect(labels()).not.toContain(t().sch.onceTime);
      expect(builder(el)!.textContent).toContain(t().api.flow.schStartNowOnceNote);
      expect(summary(el)).toBe(fmt(t().api.flow.schSummaryNow, { m: 2, a: 3, b: 12 }));
    });

    it('sends everything that was changed: name, pattern, times, order, per-group times and delete', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      type(input(el, t().sch.name), '  Weekend push ');
      pick(select(el, t().sch.mode), 'weekend');
      type(input(el, t().sch.start), '2026-11-06');
      pick(select(el, t().sch.order), 'rotate');
      pick(select(el, t().sch.autoDel), '7');
      chip(el, '12:00').click();
      type(
        el
          .querySelectorAll<HTMLElement>('app-schedule-overrides .member')[1]
          .querySelector('input')!,
        '8:00, 20:00',
      );
      fixture.detectChanges();
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      expect(req.request.body).toEqual(
        body({
          name: 'Weekend push',
          mode: 'weekend',
          startDate: '2026-11-06',
          order: 'rotate',
          times: ['09:00', '12:00', '18:00'],
          autoDeleteDays: 7,
          overrides: { b: ['08:00', '20:00'] },
        }),
      );
      req.flush(apiScheduleCreated(NEW, { created: 3 }));
      await settle();
      answerChangeRefresh(http);
      await settle();
    });

    /** Fills the builder with the given steps, creates, and answers with the schedule made; resolves to the request body. */
    async function createWith(
      steps: (el: HTMLElement, fixture: ComponentFixture<unknown>) => void,
    ) {
      const { fixture, el } = await open({ simple: false });
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await openBuilder(el, fixture);
      await pair(el, fixture);
      steps(el, fixture);
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      const sent = req.request.body;
      req.flush(apiScheduleCreated(NEW));
      await settle();
      answerChangeRefresh(http);
      await settle();
      return sent;
    }

    it('sends the first round and the spacing for rounds every N hours', async () => {
      const sent = await createWith((el, fixture) => {
        pick(select(el, t().sch.mode), 'interval');
        fixture.detectChanges();
        type(input(el, t().sch.firstRound), '07:00');
        const every = builder(el)!.querySelector<HTMLInputElement>('#sch-every')!;
        every.value = '5';
        every.dispatchEvent(new Event('change'));
        fixture.detectChanges();
      });
      expect(sent).toMatchObject({
        mode: 'interval',
        firstTime: '07:00',
        everyHours: 5,
        times: ['07:00'],
      });
    });

    it('sends the time of a one-off schedule', async () => {
      const sent = await createWith((el, fixture) => {
        pick(select(el, t().sch.mode), 'once');
        fixture.detectChanges();
        type(input(el, t().sch.onceDate), '2026-12-25');
        type(input(el, t().sch.onceTime), '16:45');
        fixture.detectChanges();
      });
      expect(sent).toMatchObject({
        mode: 'once',
        startDate: '2026-12-25',
        onceTime: '16:45',
        times: ['16:45'],
      });
    });

    it('sends the window and the count of a spread across the day, with the times they make', async () => {
      const sent = await createWith((el, fixture) => {
        pick(select(el, t().sch.mode), 'drip');
        fixture.detectChanges();
        type(input(el, t().sch.dripFrom), '10:00');
        type(input(el, t().sch.dripTo), '14:00');
        const n = builder(el)!.querySelector<HTMLInputElement>('#sch-drip-n')!;
        n.value = '3';
        n.dispatchEvent(new Event('change'));
        fixture.detectChanges();
      });
      expect(sent).toMatchObject({
        mode: 'drip',
        dripFrom: '10:00',
        dripTo: '14:00',
        dripCount: 3,
        times: ['10:00', '12:00', '14:00'],
      });
    });

    it('needs a collection, a link set and a time, and sends nothing without them', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().sch.errForm);
      expect(t().sch.errForm).not.toMatch(/ชื่อ|name/);
      pick(select(el, t().sch.collection), 'c1');
      pick(select(el, t().sch.set), 's1');
      chip(el, '09:00').click();
      chip(el, '18:00').click();
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().sch.errForm);
      // Picking something clears the line.
      chip(el, '09:00').click();
      fixture.detectChanges();
      expect(err(el)).toBeUndefined();
      http.expectNone(SCHEDULES_URL);
    });

    it('refuses a time that cannot be read in a per-group box', async () => {
      const { fixture, el } = await open({ simple: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      type(
        el.querySelector<HTMLElement>('app-schedule-overrides .member')!.querySelector('input')!,
        "9 o'clock",
      );
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().sch.errTime);
      http.expectNone(SCHEDULES_URL);
    });

    it('refuses a collection with no post, and one with no approved post', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture, 'c2');
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().api.flow.schNoPosts);
      pick(select(el, t().sch.collection), 'c3');
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().api.flow.schNoApproved);
      http.expectNone(SCHEDULES_URL);
    });

    it('refuses a link set with nothing to post to', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture, 'c1', 's2');
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().api.flow.schNoTargets);
      http.expectNone(SCHEDULES_URL);
    });

    it('refuses a start date outside yesterday … a year ahead before asking the server', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
      date.value = '2099-01-01';
      date.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      create(el).click();
      fixture.detectChanges();
      expect(err(el)).toBe(t().api.flow.schBadDate);
      http.expectNone(SCHEDULES_URL);
    });

    it('shows the reason when the API refuses, and keeps the form for another try', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      create(el).click();
      await settle();
      http
        .expectOne(SCHEDULES_URL)
        .flush(
          { title: 'บัญชีไม่ได้เชื่อมกับเครื่อง' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await settle();
      fixture.detectChanges();
      expect(err(el)).toBe('บัญชีไม่ได้เชื่อมกับเครื่อง');
      expect(builder(el)).not.toBeNull();
      expect(select(el, t().sch.collection).value).toBe('c1');
      expect(create(el).disabled).toBe(false);
    });

    it('stays on the page when nothing was queued, and says why', async () => {
      const { fixture, el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await openBuilder(el, fixture);
      await pair(el, fixture);
      create(el).click();
      await settle();
      http.expectOne(SCHEDULES_URL).flush(apiScheduleCreated(NEW, { created: 0 }));
      await settle();
      answerChangeRefresh(http);
      await settle();
      fixture.detectChanges();
      expect(navigate).not.toHaveBeenCalledWith(['/app/calendar'], expect.anything());
      expect(toasts().map((x) => x.message)).toContain(
        fmt(t().api.flow.schNothingQueued, { s: 'Condo posts → Condo groups' }),
      );
      expect(rowsOf(el)).toHaveLength(2);
    });

    it('does not send twice while a request is on its way', async () => {
      const { fixture, el } = await open();
      await openBuilder(el, fixture);
      await pair(el, fixture);
      create(el).click();
      await settle();
      fixture.detectChanges();
      expect(create(el).disabled).toBe(true);
      create(el).click();
      const reqs = http.match(SCHEDULES_URL);
      expect(reqs).toHaveLength(1);
      reqs[0].flush(apiScheduleCreated(NEW));
      await settle();
      answerChangeRefresh(http);
      await settle();
    });

    it('is off for a workspace with no connected Facebook account, with the reason', async () => {
      const { fixture, el } = await open({ connected: false });
      await openBuilder(el, fixture);
      await pair(el, fixture);
      expect(create(el).disabled).toBe(true);
      expect(create(el).title).toBe(t().api.flow.needDevice);
      create(el).click();
      http.expectNone(SCHEDULES_URL);
    });

    it('says so in the builder and leads to pairing that opens the dialog', async () => {
      const { fixture, el } = await open({ connected: false });
      await openBuilder(el, fixture);
      const need = el.querySelector('.builder .need')!;
      expect(need.textContent).toContain(t().api.flow.needDevice);
      expect(need.querySelector('a')?.getAttribute('href')).toBe('/app/team?pair=1');
    });
  });

  describe('bump (Premium)', () => {
    const PHOTOS: MediaItem[] = Array.from({ length: 24 }, (_, i) => ({
      id: `m${i + 1}`,
      name: `photo${i + 1}.jpg`,
      meta: 'image/jpeg · 90 KB',
      kind: 'image',
      used: 0,
      folderId: null,
      active: true,
    }));
    const NEW = apiSchedule({ id: 'new', name: 'Condo posts → Condo groups' });
    const f = () => t().api.flow;
    const bumpTitle = () => fmt(f().schBumpTitle, { plan: t().plans.agency.name });
    const section = (el: HTMLElement) => el.querySelector<HTMLElement>('app-schedule-bump');
    /** The page provides its own form service, so it is read from the routed page's injector. */
    const formOf = () => harness.routeDebugElement!.injector.get(ScheduleFormService);
    const library = () => TestBed.inject(LibraryStore);
    const switchOf = (el: HTMLElement) =>
      section(el)!.querySelector<HTMLInputElement>('app-checkbox input')!;
    const toggle = (el: HTMLElement, on: boolean) => {
      const box = switchOf(el);
      box.checked = on;
      box.dispatchEvent(new Event('change'));
    };
    const textarea = (el: HTMLElement) =>
      section(el)!.querySelector<HTMLTextAreaElement>('textarea')!;
    const sum = (el: HTMLElement) => section(el)!.querySelector('.sum')?.textContent?.trim();
    const pickerButton = (el: HTMLElement) =>
      [...section(el)!.querySelectorAll<HTMLButtonElement>('.img-head button')][0];
    const chosen = (el: HTMLElement) => [
      ...section(el)!.querySelectorAll<HTMLElement>('.media:not(.picker) .m'),
    ];
    const picks = (el: HTMLElement) => [
      ...section(el)!.querySelectorAll<HTMLButtonElement>('.media.picker button.m'),
    ];
    /** Opens the builder with the library holding photos and a collection + link set chosen. */
    async function ready(opts: Parameters<typeof open>[0] = {}) {
      const page = await open({ simple: false, bump: true, ...opts });
      library().media.set(PHOTOS);
      await openBuilder(page.el, page.fixture);
      await pair(page.el, page.fixture);
      return page;
    }
    /** Presses "create" and answers; resolves to the request body. */
    async function send(el: HTMLElement) {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      create(el).click();
      await settle();
      const req = http.expectOne(SCHEDULES_URL);
      const sent = req.request.body;
      req.flush(apiScheduleCreated(NEW));
      await settle();
      answerChangeRefresh(http);
      await settle();
      answerThumbs(http);
      return sent;
    }

    describe('the section', () => {
      it('sits in the "more options" part where the old bump select was, and starts off', async () => {
        const { fixture, el } = await open({ bump: true });
        await openBuilder(el, fixture);
        // Simple mode: the more section is closed, and the bump section is in it.
        expect(section(el)).toBeNull();
        button(builder(el)!, t().common.more)!.click();
        fixture.detectChanges();
        expect(section(el)).not.toBeNull();
        expect(section(el)!.querySelector('.title')!.textContent).toBe(bumpTitle());
        expect(bumpTitle()).toContain('Premium');
        expect(section(el)!.textContent).toContain(f().schBumpIntro);
        // The old select of the design is gone; the switch is off and nothing else shows.
        expect(builder(el)!.textContent).not.toContain(t().sch.bumpOff);
        expect(switchOf(el).checked).toBe(false);
        expect(section(el)!.querySelector('select')).toBeNull();
        expect(section(el)!.querySelector('app-feature-lock')).toBeNull();
      });

      it('shows its controls when the switch is on, with 2 hours, 1 bump and a plain summary', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        const hours = select(el, f().schBumpAfter);
        expect(hours.value).toBe('2');
        expect([...hours.options].map((o) => o.value)).toEqual(['1', '2', '3', '6', '12', '24']);
        expect(hours.selectedOptions[0].textContent).toBe(fmt(f().schBumpAfterOpt, { h: 2 }));
        const rounds = select(el, f().schBumpRounds);
        expect([...rounds.options].map((o) => o.value)).toEqual(['1', '2', '3']);
        expect(rounds.value).toBe('1');
        expect(textarea(el).getAttribute('maxlength')).toBe('1000');
        expect(section(el)!.textContent).toContain(f().schBumpTextHint);
        expect(section(el)!.textContent).toContain(f().schBumpNote);
        expect(sum(el)).toBe(`${fmt(f().schBumpHead1, { h: 2 })} · ${f().schBumpTailText}`);
        // The text box says a blank text uses a short default phrase.
        expect(textarea(el).placeholder).toBe(f().schBumpTextPh);
      });

      it('says the summary the way the person set it: how many, how far apart, how many images', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        pick(select(el, f().schBumpAfter), '6');
        pick(select(el, f().schBumpRounds), '3');
        fixture.detectChanges();
        expect(sum(el)).toBe(`${fmt(f().schBumpHeadN, { n: 3, h: 6 })} · ${f().schBumpTailText}`);
        formOf().toggleBumpMedia('m1');
        fixture.detectChanges();
        expect(sum(el)).toBe(
          `${fmt(f().schBumpHeadN, { n: 3, h: 6 })} · ${fmt(f().schBumpTailImg, { k: 1 })}`,
        );
        answerThumbs(http);
      });

      it('has a heading the controls are tied to for a screen reader', async () => {
        const { el } = await ready();
        const labelled = section(el)!.querySelector('section')!.getAttribute('aria-labelledby')!;
        expect(section(el)!.querySelector(`#${labelled}`)!.textContent).toBe(bumpTitle());
      });
    });

    describe('when the owner plan has no bumping', () => {
      it('stays visible but locked: a Premium banner with the upgrade link, and the controls off', async () => {
        const { fixture, el } = await ready({ bump: false });
        expect(section(el)).not.toBeNull();
        const lock = section(el)!.querySelector('app-feature-lock')!;
        expect(lock.textContent).toContain(fmt(f().schBumpLockedTitle, { plan: 'Premium' }));
        expect(lock.textContent).toContain(fmt(f().schBumpLockedBody, { plan: 'Premium' }));
        const upgrade = lock.querySelector<HTMLAnchorElement>('a')!;
        expect(upgrade.textContent!.trim()).toBe(t().common.upgrade);
        expect(upgrade.getAttribute('href')).toBe('/app/billing');
        expect(switchOf(el).disabled).toBe(true);
        expect(switchOf(el).checked).toBe(false);
        // What Premium adds can be seen, off.
        const controls = [
          ...section(el)!.querySelectorAll<HTMLElement>('select, textarea, button'),
        ];
        expect(controls.length).toBeGreaterThan(3);
        expect(controls.every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
        expect(fixture.componentInstance).toBeTruthy();
      });

      it('shows no upgrade link to someone who is not the owner (the plan is the owner’s)', async () => {
        const { el } = await ready({ bump: false, role: 'editor' });
        const lock = section(el)!.querySelector('app-feature-lock')!;
        expect(lock).not.toBeNull();
        expect(lock.querySelector('a')).toBeNull();
      });

      it('never asks for a bump, even when the switch had been turned on before: the API would answer 403', async () => {
        const { fixture, el } = await ready({ bump: false });
        const form = formOf();
        form.bumpOn.set(true);
        form.bumpHours.set(6);
        form.bumpMedia.set(['m1']);
        fixture.detectChanges();
        expect(form.bumpActive()).toBe(false);
        expect(switchOf(el).checked).toBe(false);
        const sent = await send(el);
        expect(sent.bumpHours).toBe(0);
        expect(sent).not.toHaveProperty('bump');
      });

      it('is open for a plan that has bumping: no banner, the switch can be used', async () => {
        const { fixture, el } = await ready({ bump: true });
        expect(section(el)!.querySelector('app-feature-lock')).toBeNull();
        expect(switchOf(el).disabled).toBe(false);
        expect(formOf().bumpLocked()).toBe(false);
      });
    });

    describe('what is sent', () => {
      it('sends no bump while the switch is off', async () => {
        const { el } = await ready();
        const sent = await send(el);
        expect(sent.bumpHours).toBe(0);
        expect(sent).not.toHaveProperty('bump');
      });

      it('sends the hours and the plan of the bump: how many, the text, no images', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        pick(select(el, f().schBumpAfter), '6');
        pick(select(el, f().schBumpRounds), '3');
        const box = textarea(el);
        box.value = '  {ขึ้นๆ ค่ะ|ดันหน่อยค่ะ}  ';
        box.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        const sent = await send(el);
        expect(sent).toMatchObject({
          bumpHours: 6,
          bump: { rounds: 3, text: '{ขึ้นๆ ค่ะ|ดันหน่อยค่ะ}', mediaIds: [], imagesEach: 0 },
        });
      });

      it('sends a blank text as blank: the server uses its short default phrase', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        const sent = await send(el);
        expect(sent.bumpHours).toBe(2);
        expect(sent.bump).toEqual({ rounds: 1, text: '', mediaIds: [], imagesEach: 0 });
      });

      it('starts the next schedule with the switch off and the defaults', async () => {
        const { fixture, el } = await ready();
        const form = formOf();
        toggle(el, true);
        fixture.detectChanges();
        form.setBumpHours('12');
        form.setBumpRounds('2');
        form.bumpText.set('hello');
        form.toggleBumpMedia('m3');
        await send(el);
        expect([form.bumpOn(), form.bumpHours(), form.bumpRounds(), form.bumpText()]).toEqual([
          false,
          2,
          1,
          '',
        ]);
        expect(form.bumpMedia()).toEqual([]);
      });
    });

    describe('the images', () => {
      it('cannot be counted per bump until some are chosen', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        const each = select(el, f().schBumpEach);
        expect(each.disabled).toBe(true);
        expect([...each.options].map((o) => o.value)).toEqual(['0']);
        expect(section(el)!.textContent).toContain(f().schBumpImagesNone);
        expect(section(el)!.textContent).toContain(fmt(f().schBumpImagesSel, { n: 0, max: 20 }));
      });

      it('picks library images with thumbnails and then draws a number of them per bump', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        pickerButton(el).click();
        fixture.detectChanges();
        expect(pickerButton(el).getAttribute('aria-expanded')).toBe('true');
        // The first page of the library (12) is offered, each one a toggle button.
        expect(picks(el)).toHaveLength(12);
        picks(el)[0].click();
        picks(el)[1].click();
        picks(el)[2].click();
        fixture.detectChanges();
        answerThumbs(http);
        await settle();
        fixture.detectChanges();
        expect(chosen(el)).toHaveLength(3);
        expect(picks(el)[0].getAttribute('aria-pressed')).toBe('true');
        expect(picks(el)[5].getAttribute('aria-pressed')).toBe('false');
        expect(section(el)!.textContent).toContain(fmt(f().schBumpImagesSel, { n: 3, max: 20 }));
        const each = select(el, f().schBumpEach);
        expect(each.disabled).toBe(false);
        expect([...each.options].map((o) => o.value)).toEqual(['0', '1', '2', '3']);
        // The first image chosen means "use it": one per bump.
        expect(each.value).toBe('1');
        pick(each, '3');
        fixture.detectChanges();
        expect(sum(el)).toContain(fmt(f().schBumpTailImg, { k: 3 }));
        const sent = await send(el);
        expect(sent.bump).toEqual({
          rounds: 1,
          text: '',
          mediaIds: ['m1', 'm2', 'm3'],
          imagesEach: 3,
        });
      });

      it('shows the thumbnails of the files it picked (fetched with the token, never a bare src)', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        formOf().toggleBumpMedia('m2');
        fixture.detectChanges();
        const asked = http.match((r) => r.url === `/api/workspaces/${WS}/media/m2/content`);
        expect(asked).toHaveLength(1);
        asked[0].flush(new Blob(['x']));
        await settle();
        fixture.detectChanges();
        expect(chosen(el)[0].querySelector('img')).not.toBeNull();
        expect(chosen(el)[0].textContent).toContain('photo2.jpg');
      });

      it('never draws more images per bump than are chosen, and 5 at most', async () => {
        const { fixture } = await ready();
        const form = formOf();
        form.setBumpEach('4');
        expect(form.bumpEach()).toBe(0); // none chosen
        form.toggleBumpMedia('m1');
        form.toggleBumpMedia('m2');
        expect(form.bumpEach()).toBe(2); // 4 wanted, 2 chosen
        for (const id of ['m3', 'm4', 'm5', 'm6', 'm7']) form.toggleBumpMedia(id);
        expect(form.bumpEach()).toBe(4);
        form.setBumpEach('9');
        expect(form.bumpEach()).toBe(5); // never more than 5
        form.toggleBumpMedia('m1'); // take one off: still 5 of 6
        form.setBumpEach('2');
        for (const id of ['m2', 'm3', 'm4', 'm5', 'm6']) form.toggleBumpMedia(id);
        expect(form.bumpMedia()).toEqual(['m7']);
        expect(form.bumpEach()).toBe(1); // clamped to how many are left
        answerThumbs(http);
      });

      it('takes an image off with its remove button', async () => {
        const { fixture, el } = await ready();
        toggle(el, true);
        fixture.detectChanges();
        formOf().toggleBumpMedia('m1');
        formOf().toggleBumpMedia('m2');
        fixture.detectChanges();
        answerThumbs(http);
        const remove = chosen(el)[0].querySelector<HTMLButtonElement>('button')!;
        expect(remove.getAttribute('aria-label')).toContain('photo1.jpg');
        remove.click();
        fixture.detectChanges();
        expect(formOf().bumpMedia()).toEqual(['m2']);
      });

      it('allows 20 images at most and says so when a 21st is picked', async () => {
        const { fixture, el } = await ready();
        const form = formOf();
        for (const m of PHOTOS.slice(0, 20)) form.toggleBumpMedia(m.id);
        expect(form.bumpMedia()).toHaveLength(20);
        form.toggleBumpMedia('m21');
        expect(form.bumpMedia()).toHaveLength(20);
        expect(form.bumpMedia()).not.toContain('m21');
        expect(form.error()).toBe(fmt(f().schBumpMax, { n: 20 }));
        fixture.detectChanges();
        expect(err(el)).toBe(fmt(f().schBumpMax, { n: 20 }));
        // Taking one off clears the message and makes room.
        form.toggleBumpMedia('m1');
        expect(form.error()).toBe('');
        form.toggleBumpMedia('m21');
        expect(form.bumpMedia()).toHaveLength(20);
        answerThumbs(http);
      });

      it('offers only images that are on, and sends none that has left the library since', async () => {
        const { fixture, el } = await ready();
        library().media.set([
          ...PHOTOS.slice(0, 3),
          { ...PHOTOS[3], active: false },
          { ...PHOTOS[4], kind: 'video' },
        ]);
        toggle(el, true);
        fixture.detectChanges();
        pickerButton(el).click();
        fixture.detectChanges();
        expect(picks(el).map((p) => p.title)).toEqual(['photo1.jpg', 'photo2.jpg', 'photo3.jpg']);
        const form = formOf();
        form.toggleBumpMedia('m1');
        form.toggleBumpMedia('m2');
        // m2 is deleted in the library meanwhile: the server refuses an unknown file, so it is not sent.
        library().media.set(PHOTOS.filter((m) => m.id !== 'm2'));
        fixture.detectChanges();
        answerThumbs(http);
        const sent = await send(el);
        expect(sent.bump.mediaIds).toEqual(['m1']);
        expect(sent.bump.imagesEach).toBe(1);
      });

      it('points to the library when it has no image yet', async () => {
        const { fixture, el } = await ready();
        library().media.set([]);
        toggle(el, true);
        fixture.detectChanges();
        pickerButton(el).click();
        fixture.detectChanges();
        const link = section(el)!.querySelector<HTMLAnchorElement>('.picker a')!;
        expect(link.textContent!.trim()).toBe(f().schBumpNoLibrary);
        expect(link.getAttribute('href')).toBe('/app/library');
      });
    });

    describe('the form’s rules', () => {
      it('keeps the hours to the options the server knows and the number of bumps between 1 and 3', async () => {
        const { fixture } = await ready();
        const form = formOf();
        form.setBumpHours('6');
        expect(form.bumpHours()).toBe(6);
        form.setBumpHours('5'); // not an option
        expect(form.bumpHours()).toBe(2);
        form.setBumpHours('0'); // 0 would mean "no bump": that is the switch
        expect(form.bumpHours()).toBe(2);
        form.setBumpRounds('9');
        expect(form.bumpRounds()).toBe(3);
        form.setBumpRounds('0');
        expect(form.bumpRounds()).toBe(1);
        form.setBumpRounds('x');
        expect(form.bumpRounds()).toBe(1);
      });

      it('says "once" or "N times, H hours apart" in the summary', async () => {
        const { fixture } = await ready();
        const form = formOf();
        form.bumpOn.set(true);
        expect(form.bumpSummary()).toBe(
          `${fmt(f().schBumpHead1, { h: 2 })} · ${f().schBumpTailText}`,
        );
        form.setBumpRounds('2');
        form.setBumpHours('1');
        expect(form.bumpSummary()).toContain(fmt(f().schBumpHeadN, { n: 2, h: 1 }));
      });
    });

    describe('permissions', () => {
      /** A viewer cannot open the builder from its button, but the form may still be open (an address, a draft). */
      async function viewer() {
        const page = await open({ simple: false, bump: true, role: 'viewer' });
        formOf().show();
        page.fixture.detectChanges();
        await settle();
        for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
        await settle();
        page.fixture.detectChanges();
        return page;
      }

      it('is off for a viewer, who cannot change anything, and not locked by the plan', async () => {
        const { el } = await viewer();
        expect(switchOf(el).disabled).toBe(true);
        expect(section(el)!.querySelector('app-feature-lock')).toBeNull();
      });

      it('keeps every control off for a viewer even when the switch is on', async () => {
        const { fixture, el } = await viewer();
        formOf().bumpOn.set(true);
        fixture.detectChanges();
        const controls = [
          ...section(el)!.querySelectorAll<HTMLElement>('select, textarea, button'),
        ];
        expect(controls.length).toBeGreaterThan(3);
        expect(controls.every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
      });
    });
  });

  describe('opened from the address', () => {
    it('opens the builder with the collection, the set and the start date, then clears the address', async () => {
      const { el } = await open({ url: `/app/schedules?collection=c1&set=s1&start=${TOMORROW}` });
      expect(builder(el)).not.toBeNull();
      expect(select(el, t().sch.collection).value).toBe('c1');
      expect(select(el, t().sch.set).value).toBe('s1');
      expect(input(el, t().sch.start).value).toBe(TOMORROW);
      expect(TestBed.inject(Router).url).toBe('/app/schedules');
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('starts today when the address asks for a day that has passed', async () => {
      const yesterday = localDateKey(new Date(Date.now() - 864e5));
      const { el } = await open({ url: `/app/schedules?collection=c1&set=s1&start=${yesterday}` });
      expect(input(el, t().sch.start).value).toBe(TestBed.inject(PostsStore).todayKey());
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('keeps today and later days as they are', async () => {
      const { el } = await open({ url: `/app/schedules?collection=c1&set=s1&start=${TOMORROW}` });
      expect(input(el, t().sch.start).value).toBe(TOMORROW);
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('opens with only a collection (from a collection card)', async () => {
      const { el } = await open({ url: '/app/schedules?collection=c1' });
      expect(select(el, t().sch.collection).value).toBe('c1');
      expect(select(el, t().sch.set).value).toBe('');
      expect(input(el, t().sch.start).value).toBe(TestBed.inject(PostsStore).todayKey());
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('opens with only a link set (from a set card)', async () => {
      const { el } = await open({ url: '/app/schedules?set=s2' });
      expect(select(el, t().sch.set).value).toBe('s2');
      expect(select(el, t().sch.collection).value).toBe('');
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('opens as it is with ?new=1 (from the overview)', async () => {
      const { el } = await open({ url: '/app/schedules?new=1' });
      expect(builder(el)).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe('/app/schedules');
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('ignores an id that does not exist and a date that is not one', async () => {
      const { el } = await open({ url: '/app/schedules?collection=nope&set=nope&start=tomorrow' });
      expect(builder(el)).not.toBeNull();
      expect(select(el, t().sch.collection).value).toBe('');
      expect(select(el, t().sch.set).value).toBe('');
      expect(input(el, t().sch.start).value).toBe(TestBed.inject(PostsStore).todayKey());
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });

    it('stays closed without a parameter', async () => {
      const { el } = await open();
      expect(builder(el)).toBeNull();
    });

    it('does not open an empty form for someone who cannot create, but still clears the address', async () => {
      const { el } = await open({ role: 'viewer', url: '/app/schedules?collection=c1' });
      expect(builder(el)).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/app/schedules');
    });

    it('keeps the other parameters of the address', async () => {
      const { el } = await open({ url: '/app/schedules?collection=c1&keep=1' });
      expect(builder(el)).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe('/app/schedules?keep=1');
      for (const r of http.match((x) => x.url.endsWith('/best-times'))) r.flush([]);
    });
  });

  it('reads the schedules again when the page opens', async () => {
    http = provideApiTesting({
      imports: [SchedulesPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    TestBed.inject(SchedulesStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(SettingsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LibraryStore); // the schedule form reads the library (bump images)
    await signIn(http, { schedules: [MORNING], collections: [C1], linkSets: [S1] });
    const fixture = TestBed.createComponent(SchedulesPageComponent);
    fixture.detectChanges();
    await settle();
    http.expectOne(SCHEDULES_URL).flush([{ ...MORNING, todayCount: 9 }]);
    await settle();
    expect(TestBed.inject(SchedulesStore).byId('sc1')?.todayCount).toBe(9);
    expect(WS).toBe('ws-1');
  });
});

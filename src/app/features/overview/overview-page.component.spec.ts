import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DevicesStore } from '../../core/data/devices.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { SettingsStore } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { AccountsStore } from '../../core/data/accounts.store';
import { ApiDevice } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { ACCOUNTS, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import {
  apiCollection,
  apiCollectionPost,
  apiLinkSet,
  apiSetLink,
} from '../../testing/collection-fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED } from '../../testing/link-sets.fixtures';
import { apiSchedule } from '../../testing/schedules.fixtures';
import { OverviewPageComponent } from './overview-page.component';

const DEVICE: ApiDevice = {
  id: 'd1',
  name: 'Shop PC',
  browser: 'Chrome 130',
  version: '2.2.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: '2026-10-04T08:00:00Z',
  online: true,
  accountId: FB_CONNECTED.id,
  jobsPaused: false,
};
const LINK_SET = apiLinkSet({
  id: 's1',
  links: [
    apiSetLink({ id: 'a' }),
    apiSetLink({ id: 'b' }),
    apiSetLink({ id: 'c', enabled: false }),
  ],
});
const COLLECTION = apiCollection({
  id: 'c1',
  name: 'Condo',
  posts: [1, 2, 3].map((i) => apiCollectionPost({ id: `p${i}` })),
});
const COLLECTION_2 = apiCollection({ id: 'c2', name: 'Land', posts: [] });

describe('OverviewPageComponent', () => {
  let http: HttpTestingController;

  async function open(
    data: {
      devices?: ApiDevice[];
      collections?: (typeof COLLECTION)[];
      linkSets?: (typeof LINK_SET)[];
      schedules?: ReturnType<typeof apiSchedule>[];
      online?: boolean;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [OverviewPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    // The stores the page reads answer from signIn() when they exist before it.
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(SettingsStore);
    TestBed.inject(CollectionsStore);
    TestBed.inject(LinkSetsStore);
    TestBed.inject(SchedulesStore);
    await signIn(http, {
      devices: data.devices ?? [],
      collections: data.collections ?? [],
      linkSets: data.linkSets ?? [],
      schedules: data.schedules ?? [],
    });
    TestBed.inject(AccountsStore).list.set([...ACCOUNTS, FB_CONNECTED]);
    if (data.online === false) TestBed.inject(SettingsStore).extensionOnline.set(false);
    const fixture = TestBed.createComponent(OverviewPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const steps = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.hub .step')];
  const detail = (step: HTMLElement) => step.querySelector('.small')?.textContent;
  const isDone = (step: HTMLElement) => step.querySelector('.num')?.classList.contains('done');
  const isPrimary = (step: HTMLElement) =>
    step.querySelector('button')!.classList.contains('su-btn-primary');
  const refresh = async (fixture: ComponentFixture<unknown>) => {
    await settle();
    fixture.detectChanges();
  };

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the three-step card', () => {
    it('sits above the figures, with its title and sub-title', async () => {
      const { el } = await open();
      const hub = el.querySelector('app-overview-hub')!;
      expect(hub.querySelector('h2')?.textContent).toBe(t().ov.startTitle);
      expect(hub.querySelector('.head .small')?.textContent).toBe(t().ov.startSub);
      expect(steps(el)).toHaveLength(3);
      // Before the KPIs in the page.
      expect(
        hub.compareDocumentPosition(el.querySelector('.kpis')!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('starts with nothing done: the first step has the main button', async () => {
      const { el } = await open();
      expect(steps(el).map(isDone)).toEqual([false, false, false]);
      expect(steps(el).map(isPrimary)).toEqual([true, false, false]);
      expect(steps(el).map((s) => s.querySelector('.fw6')?.textContent)).toEqual([
        t().ov.s1,
        t().ov.s2,
        t().ov.s3,
      ]);
      expect(steps(el).map((s) => s.querySelector('button')?.textContent?.trim())).toEqual([
        t().ov.s1a,
        t().ov.s2a,
        t().ov.s3a,
      ]);
      expect(detail(steps(el)[0])).toBe(fmt(t().ov.s1d, { n: 0, m: 0 }));
      expect(detail(steps(el)[1])).toBe(fmt(t().ov.s2d, { n: 0, m: 0 }));
      expect(detail(steps(el)[2])).toBe(fmt(t().ov.s3d, { n: 0, k: 0 }));
    });

    it("counts the links that are on and valid, the posts, and the schedules with today's posts", async () => {
      const { el } = await open({
        linkSets: [LINK_SET],
        collections: [COLLECTION, COLLECTION_2],
        schedules: [
          apiSchedule({ id: 'x', todayCount: 4 }),
          apiSchedule({ id: 'y', todayCount: 1 }),
          apiSchedule({ id: 'z', active: false, todayCount: 2 }),
        ],
      });
      expect(steps(el).map(isDone)).toEqual([true, true, true]);
      expect(detail(steps(el)[0])).toBe(fmt(t().ov.s1d, { n: 2, m: 1 }));
      expect(detail(steps(el)[1])).toBe(fmt(t().ov.s2d, { n: 3, m: 2 }));
      expect(detail(steps(el)[2])).toBe(fmt(t().ov.s3d, { n: 2, k: 7 }));
      // All done: the schedules keep the main button.
      expect(steps(el).map(isPrimary)).toEqual([false, false, true]);
      expect(steps(el)[0].querySelector('.ph-check')).not.toBeNull();
      expect(steps(el)[0].querySelector('.num')?.textContent?.trim()).toBe('');
    });

    it('gives the main button to the first step that is not done', async () => {
      const { el } = await open({ linkSets: [LINK_SET] });
      expect(steps(el).map(isDone)).toEqual([true, false, false]);
      expect(steps(el).map(isPrimary)).toEqual([false, true, false]);
      expect(steps(el)[1].querySelector('.num')?.textContent?.trim()).toBe('2');
    });

    it('does not call a collection without posts, or a paused schedule, a step done', async () => {
      const { el } = await open({
        linkSets: [LINK_SET],
        collections: [COLLECTION_2],
        schedules: [apiSchedule({ id: 'z', active: false })],
      });
      expect(steps(el).map(isDone)).toEqual([true, false, false]);
      expect(steps(el).map(isPrimary)).toEqual([false, true, false]);
    });

    it('reads "—" and calls nothing done before the lists have arrived', async () => {
      const { fixture, el } = await open({ linkSets: [LINK_SET], collections: [COLLECTION] });
      TestBed.inject(LinkSetsStore).loaded.set(false);
      TestBed.inject(CollectionsStore).loaded.set(false);
      TestBed.inject(SchedulesStore).loaded.set(false);
      fixture.detectChanges();
      expect(steps(el).map(detail)).toEqual(['—', '—', '—']);
      expect(steps(el).map(isDone)).toEqual([false, false, false]);
      expect(steps(el).map(isPrimary)).toEqual([false, false, false]);
    });

    it('takes the first step to the group links', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      steps(el)[0].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith('/app/targets');
    });

    it('takes the second step to the post library, ready for a new post in the collection that is open', async () => {
      const { el } = await open({ collections: [COLLECTION, COLLECTION_2] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.inject(CollectionsStore).openId.set('c2');
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/posts'], {
        queryParams: { collection: 'c2', new: 1 },
      });
    });

    it('prefers the collection a post was last saved to', async () => {
      const { el } = await open({ collections: [COLLECTION, COLLECTION_2] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.inject(CollectionsStore).lastId.set('c1');
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/posts'], {
        queryParams: { collection: 'c1', new: 1 },
      });
    });

    it('opens the new-post editor with no collection when there is none', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/posts'], { queryParams: { new: 1 } });
    });

    it('takes the third step to the schedules with the builder open', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      steps(el)[2].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], { queryParams: { new: 1 } });
    });

    it('follows a schedule that is created or paused elsewhere', async () => {
      const { fixture, el } = await open({ linkSets: [LINK_SET], collections: [COLLECTION] });
      expect(isDone(steps(el)[2])).toBe(false);
      TestBed.inject(SchedulesStore).schedules.set([apiSchedule({ id: 'n' })]);
      await refresh(fixture);
      expect(isDone(steps(el)[2])).toBe(true);
      expect(steps(el).map(isPrimary)).toEqual([false, false, true]);
    });
  });

  describe('the extension line', () => {
    const line = (el: HTMLElement) => el.querySelector('.hub .ext');

    it('says no computer is paired, with a button to pair one', async () => {
      const { el } = await open();
      expect(line(el)?.textContent).toContain(t().ov.extNone);
      const pair = line(el)!.querySelector<HTMLAnchorElement>('a')!;
      expect(pair.textContent?.trim()).toBe(t().ov.pair);
      expect(pair.getAttribute('href')).toBe('/app/team');
    });

    it('says the extension is ready on the paired computer, without a pair button', async () => {
      const { el } = await open({ devices: [DEVICE] });
      expect(line(el)?.textContent).toContain(fmt(t().ov.extOk, { d: 'Shop PC' }));
      expect(line(el)?.querySelector('a')).toBeNull();
      expect(line(el)?.querySelector<HTMLElement>('.dot')?.style.background).toContain('success');
    });

    it('names the computer that is online when several are paired', async () => {
      const off = { ...DEVICE, id: 'd0', name: 'Old laptop', online: false };
      const { el } = await open({ devices: [off, DEVICE] });
      expect(line(el)?.textContent).toContain(fmt(t().ov.extOk, { d: 'Shop PC' }));
    });

    it('says it is offline when the paired computers are, without a pair button', async () => {
      const { el } = await open({ devices: [{ ...DEVICE, online: false }], online: false });
      expect(line(el)?.textContent).toContain(t().ov.extNo);
      expect(line(el)?.querySelector('a')).toBeNull();
      expect(line(el)?.querySelector<HTMLElement>('.dot')?.style.background).toContain('danger');
    });

    it('says nothing until the computers have arrived', async () => {
      const { fixture, el } = await open({ devices: [DEVICE] });
      TestBed.inject(DevicesStore).loaded.set(false);
      fixture.detectChanges();
      expect(line(el)).toBeNull();
    });
  });

  // The panel lists the paired browsers (the devices): real data only. The sample accounts of the design, and the
  // accounts of the workspace, are not shown here any more.
  describe('the connected extensions', () => {
    const panel = (el: HTMLElement) =>
      el.querySelector<HTMLElement>(`section[aria-label="${t().api.flow.ovExtTitle}"]`)!;
    const rows = (el: HTMLElement) => [...panel(el).querySelectorAll<HTMLElement>('.extrow')];
    const stateOf = (row: HTMLElement) => row.querySelector('.status')?.textContent?.trim();
    const dotOf = (row: HTMLElement) => row.querySelector<HTMLElement>('.dot')?.style.background;

    it('is titled for extensions, and no longer says "accounts seen by the extension"', async () => {
      const { el } = await open({ devices: [DEVICE] });
      expect(panel(el).querySelector('h2')?.textContent).toBe(t().api.flow.ovExtTitle);
      expect(t().ov.accountsTitle).toBe(t().api.flow.ovExtTitle);
      expect(panel(el).querySelector('a[routerLink], a[href="/app/team"]')).not.toBeNull();
      expect(panel(el).textContent).toContain(t().api.flow.ovExtManage);
    });

    it('shows one row for each paired browser: its name, its browser and that it is online', async () => {
      const { el } = await open({ devices: [DEVICE, { ...DEVICE, id: 'd2', name: 'Laptop' }] });
      const [first, second] = rows(el);
      expect(rows(el)).toHaveLength(2);
      expect(first.querySelector('.fw5')?.textContent?.trim()).toBe('Shop PC');
      expect(first.querySelector('.small')?.textContent?.trim()).toBe('Chrome 130');
      expect(stateOf(first)).toBe(t().api.deviceOnline);
      expect(dotOf(first)).toContain('success');
      expect(second.querySelector('.fw5')?.textContent?.trim()).toBe('Laptop');
      expect(first.getAttribute('href')).toBe('/app/team');
    });

    it('shows a browser that cannot be reached as offline, with when it was last seen', async () => {
      const seen = new Date(Date.now() - 3 * 3600_000).toISOString();
      const { el } = await open({ devices: [{ ...DEVICE, online: false, lastSeenAt: seen }] });
      const [row] = rows(el);
      expect(stateOf(row)).toBe(t().api.flow.ovExtOffline);
      expect(dotOf(row)).toContain('danger');
      expect(row.querySelector('.small')?.textContent?.trim()).toBe(
        `Chrome 130 · ${t().api.flow.ovExtSeen} ${fmt(t().api.hoursAgo, { n: 3 })}`,
      );
    });

    it('says a browser that never called in has never connected', async () => {
      const { el } = await open({ devices: [{ ...DEVICE, online: false, lastSeenAt: null }] });
      expect(rows(el)[0].querySelector('.small')?.textContent?.trim()).toBe(
        `Chrome 130 · ${t().api.deviceNever}`,
      );
    });

    it('shows a browser whose jobs are paused, and one the engine paused itself', async () => {
      const { el } = await open({
        devices: [
          { ...DEVICE, jobsPaused: true },
          { ...DEVICE, id: 'd2', name: 'Laptop', autoPausedUntil: '2099-01-01T00:00:00Z' },
        ],
      });
      const [byHand, byEngine] = rows(el);
      expect(stateOf(byHand)).toBe(t().api.flow.ovExtPaused);
      expect(dotOf(byHand)).toContain('warning');
      expect(stateOf(byEngine)).toBe(t().api.flow.ovExtAuto);
      expect(dotOf(byEngine)).toContain('warning');
    });

    it('looks right in a new workspace: no extension yet, and a way to add one', async () => {
      const { el } = await open();
      expect(rows(el)).toHaveLength(0);
      const empty = panel(el).querySelector('app-empty-state')!;
      expect(empty.textContent).toContain(t().api.flow.ovExtEmptyTitle);
      expect(empty.textContent).toContain(t().api.flow.ovExtEmptyBody);
      const add = panel(el).querySelector<HTMLAnchorElement>('.add a')!;
      expect(add.textContent?.trim()).toBe(t().ov.pair);
      expect(add.getAttribute('href')).toBe('/app/team?pair=1');
    });

    it('shows no sample accounts and no account of the workspace, only the browsers', async () => {
      const { el } = await open({ devices: [DEVICE] });
      // The accounts store holds the old, unbound account and the connected one; neither is a row of the panel.
      expect(TestBed.inject(AccountsStore).list().length).toBeGreaterThan(1);
      expect(rows(el)).toHaveLength(1);
      expect(el.textContent).not.toContain('Old PC');
      expect(el.textContent).not.toContain(FB_CONNECTED.name);
      expect(el.textContent).not.toMatch(/ตัวอย่าง|Sample|\bIP\b|\d+\.\d+\.\d+\.\d+/);
      expect(el.querySelector('.via')).toBeNull();
    });

    it('says it is loading until the browsers have arrived, not that there is none', async () => {
      const { fixture, el } = await open();
      TestBed.inject(DevicesStore).loaded.set(false);
      fixture.detectChanges();
      expect(panel(el).querySelector('app-empty-state')).toBeNull();
      expect(panel(el).textContent).toContain(t().api.loading);
      TestBed.inject(DevicesStore).loaded.set(true);
      fixture.detectChanges();
      expect(panel(el).querySelector('app-empty-state')).not.toBeNull();
    });

    it('follows a browser that is paired, renamed or goes offline without a reload', async () => {
      const { fixture, el } = await open({ devices: [DEVICE] });
      const devices = TestBed.inject(DevicesStore);
      devices.list.set([{ ...DEVICE, name: 'Back office', online: false }]);
      await refresh(fixture);
      expect(rows(el)[0].querySelector('.fw5')?.textContent?.trim()).toBe('Back office');
      expect(stateOf(rows(el)[0])).toBe(t().api.flow.ovExtOffline);
      devices.list.set([]);
      await refresh(fixture);
      expect(rows(el)).toHaveLength(0);
      expect(panel(el).querySelector('app-empty-state')).not.toBeNull();
    });
  });

  it('is an empty page that still looks right in a new workspace: no posts, no errors, no extensions', async () => {
    const { el } = await open();
    expect(el.querySelectorAll('.kpi')).toHaveLength(4);
    expect(el.textContent).toContain(t().cal.empty);
    expect(el.textContent).toContain(t().ov.noErrors);
    expect(el.querySelectorAll('.row')).toHaveLength(0);
  });

  it('keeps the figures, the queue and the errors below the card', async () => {
    const { el } = await open();
    expect(el.querySelectorAll('.kpi')).toHaveLength(4);
    expect(el.textContent).toContain(t().ov.queueTitle);
    expect(el.textContent).toContain(t().ov.errorsTitle);
    expect(WS).toBe('ws-1');
  });
});

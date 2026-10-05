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

    it('takes the second step to the composer, in the collection that is open', async () => {
      const { el } = await open({ collections: [COLLECTION, COLLECTION_2] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.inject(CollectionsStore).openId.set('c2');
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'c2' },
      });
    });

    it('prefers the collection a post was last saved to', async () => {
      const { el } = await open({ collections: [COLLECTION, COLLECTION_2] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.inject(CollectionsStore).lastId.set('c1');
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'c1' },
      });
    });

    it('opens the composer with no collection when there is none', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      steps(el)[1].querySelector('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], { queryParams: {} });
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

  describe('the accounts', () => {
    const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.row.tight')];

    it('says which computer and browser post for an account that has one', async () => {
      const { el } = await open({ devices: [DEVICE] });
      const connected = rows(el).find((r) => r.textContent?.includes(FB_CONNECTED.name))!;
      expect(connected.querySelector('.via')?.textContent?.trim()).toBe(
        `${t().ov.via} Shop PC · Chrome 130`,
      );
      expect(connected.querySelector('.via .ph-desktop')).not.toBeNull();
    });

    it('says an account with no computer is not bound to a browser, and invents no address', async () => {
      const { el } = await open({ devices: [DEVICE] });
      const sample = rows(el).find((r) => r.textContent?.includes('Baan Dee'))!;
      expect(sample.querySelector('.via')?.textContent?.trim()).toBe(t().ov.viaNone);
      expect(sample.querySelector('.via .ph-plugs')).not.toBeNull();
      expect(el.textContent).not.toMatch(/\bIP\b|\d+\.\d+\.\d+\.\d+/);
    });

    it('shows no such line until the computers have arrived', async () => {
      const { fixture, el } = await open({ devices: [DEVICE] });
      TestBed.inject(DevicesStore).loaded.set(false);
      fixture.detectChanges();
      expect(el.querySelector('.via')).toBeNull();
    });
  });

  it('keeps the figures, the queue and the errors below the card', async () => {
    const { el } = await open();
    expect(el.querySelectorAll('.kpi')).toHaveLength(4);
    expect(el.textContent).toContain(t().ov.queueTitle);
    expect(el.textContent).toContain(t().ov.errorsTitle);
    expect(WS).toBe('ws-1');
  });
});

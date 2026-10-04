import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiReport, ApiReportGroup, ApiWorkspace } from '../http/api.service';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { REPORT_URL, report, reportGroup } from '../../testing/engine.fixtures';
import { DeviceEventsService } from './device-events.service';
import { ReportsStore } from './reports.store';
import { WorkspaceStore } from './workspace.store';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const URL_A = 'https://www.facebook.com/groups/condo';
const GROUPS: ApiReportGroup[] = [
  reportGroup({ name: 'Condo BKK', linkId: 'a', url: URL_A, posted: 8, failed: 2, rate: 80 }),
  reportGroup({ name: 'Cars', linkId: 'd', posted: 3, pending: 1, rate: 100 }),
];

describe('ReportsStore', () => {
  let http: HttpTestingController;
  let store: ReportsStore;

  const days = (d: number) =>
    http.expectOne((r) => r.url === REPORT_URL && r.params.get('days') === String(d));

  async function start(
    opts: { report?: ApiReport; workspace?: Partial<ApiWorkspace> } = {},
  ): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http, { workspace: opts.workspace });
    store = TestBed.inject(ReportsStore);
    await settle();
    days(7).flush(opts.report ?? report({ groups: GROUPS }));
    http.expectOne(SETS_URL).flush([]);
    await settle();
  }

  afterEach(() => http.verify());

  it('loads the last 7 days, and the page shows "—" until it has', async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http);
    store = TestBed.inject(ReportsStore);
    await settle();
    expect(store.loaded()).toBe(false);
    days(7).flush(report({ groups: GROUPS }));
    http.expectOne(SETS_URL).flush([]);
    await settle();
    expect(store.loaded()).toBe(true);
    expect(store.groups()).toHaveLength(2);
    expect(store.days()).toBe(7);
  });

  it('switching to 30 days drops the 7-day numbers and reads the other period', async () => {
    await start();
    store.setDays(30);
    expect(store.loaded()).toBe(false);
    expect(store.report()).toBeNull();
    await settle();
    days(30).flush(report({ days: 30, groups: [GROUPS[1]] }));
    await settle();
    expect(store.groups().map((g) => g.name)).toEqual(['Cars']);
    expect(store.loaded()).toBe(true);
  });

  it('drops an answer that arrives for a period that is no longer chosen', async () => {
    await start();
    store.setDays(30);
    await settle();
    const late = days(30);
    store.setDays(7);
    await settle();
    days(7).flush(report({ groups: [GROUPS[0]] }));
    late.flush(report({ days: 30, groups: [GROUPS[1]] }));
    await settle();
    expect(store.groups().map((g) => g.name)).toEqual(['Condo BKK']);
  });

  it('says so when the API refuses, and reads again on request', async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http);
    store = TestBed.inject(ReportsStore);
    await settle();
    days(7).flush({ title: 'x' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(SETS_URL).flush([]);
    await settle();
    expect(store.failed()).toBe(true);
    expect(store.loaded()).toBe(false);
    void store.load();
    await settle();
    expect(store.failed()).toBe(false);
    days(7).flush(report({ groups: GROUPS }));
    await settle();
    expect(store.loaded()).toBe(true);
  });

  it('ensureFresh reads again only when the numbers are old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await start();
      store.ensureFresh();
      await settle();
      http.expectNone((r) => r.url === REPORT_URL);
      vi.setSystemTime(Date.now() + 31_000);
      store.ensureFresh();
      await settle();
      days(7).flush(report({ groups: GROUPS }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells whether the owner’s plan has client reports', async () => {
    await start();
    expect(store.canShare()).toBe(false);
    TestBed.inject(WorkspaceStore).list.update((l) =>
      l.map((w) => ({ ...w, clientReports: true })),
    );
    expect(store.canShare()).toBe(true);
  });

  it('empties itself with the workspace', async () => {
    await start();
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    expect(store.report()).toBeNull();
    expect(store.loaded()).toBe(false);
    http
      .expectOne((r) => r.url === '/api/workspaces/ws-2/reports')
      .flush(report({ groups: [GROUPS[1]] }));
    http.expectOne('/api/workspaces/ws-2/link-sets').flush([]);
    await settle();
    expect(store.groups().map((g) => g.name)).toEqual(['Cars']);
  });

  describe('disabling a group', () => {
    const LINK_A = apiLink({ id: 'a', name: 'Condo BKK', url: URL_A, code: '#Jan', dailyMax: 5 });
    // The same group sits in a second set, spelled differently.
    const LINK_A2 = apiLink({ id: 'a2', name: 'Condo again', url: 'fb.com/groups/condo?ref=x' });
    const LINK_OFF = apiLink({ id: 'a3', url: URL_A, enabled: false });
    const LINK_OTHER = apiLink({ id: 'z' });

    it('switches off every enabled link with the group’s address, sending the whole row', async () => {
      await start();
      const done = store.disableGroup(GROUPS[0]);
      await settle();
      http
        .expectOne(SETS_URL)
        .flush([
          apiLinkSet({ id: 's1', links: [LINK_A, LINK_OTHER, LINK_OFF] }),
          apiLinkSet({ id: 's2', links: [LINK_A2] }),
        ]);
      await settle();
      const first = http.expectOne({ url: `${SETS_URL}/s1/links/a`, method: 'PUT' });
      expect(first.request.body).toEqual({
        name: 'Condo BKK',
        url: URL_A,
        code: '#Jan',
        dailyMax: 5,
        enabled: false,
      });
      first.flush({ ...LINK_A, enabled: false });
      await settle();
      http
        .expectOne({ url: `${SETS_URL}/s2/links/a2`, method: 'PUT' })
        .flush({ ...LINK_A2, enabled: false });
      await settle();
      // Then the link sets and the report are read again.
      http.expectOne(SETS_URL).flush([]);
      days(7).flush(report({ groups: [{ ...GROUPS[0], enabled: false }] }));
      expect(await done).toBe(2);
      await settle();
      expect(store.groups()[0].enabled).toBe(false);
    });

    it('finds a group by its link id when the report has no address', async () => {
      await start();
      const done = store.disableGroup(reportGroup({ name: 'x', linkId: 'z', url: null }));
      await settle();
      http.expectOne(SETS_URL).flush([apiLinkSet({ id: 's1', links: [LINK_A, LINK_OTHER] })]);
      await settle();
      http
        .expectOne({ url: `${SETS_URL}/s1/links/z`, method: 'PUT' })
        .flush({ ...LINK_OTHER, enabled: false });
      await settle();
      http.expectOne(SETS_URL).flush([]);
      days(7).flush(report());
      expect(await done).toBe(1);
    });

    it('reports 0 and leaves the rest alone when the API refuses', async () => {
      await start();
      const done = store.disableGroup(GROUPS[0]);
      await settle();
      http.expectOne(SETS_URL).flush([apiLinkSet({ id: 's1', links: [LINK_A] })]);
      await settle();
      http
        .expectOne({ url: `${SETS_URL}/s1/links/a`, method: 'PUT' })
        .flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      http.expectOne(SETS_URL).flush([]);
      days(7).flush(report({ groups: GROUPS }));
      expect(await done).toBe(0);
    });
  });

  describe('sharing', () => {
    it('makes the shareable copy and remembers its link', async () => {
      await start({ workspace: { clientReports: true } });
      const done = store.share('  Baan Dee Studio ', 'month', false);
      const req = http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' });
      expect(req.request.body).toEqual({ brand: 'Baan Dee Studio', period: 'month', logo: false });
      const share = { token: 'tok', path: '/report/tok', expiresAt: '2026-11-03T05:00:00Z' };
      req.flush(share);
      expect(await done).toEqual(share);
      expect(store.lastShare()).toEqual(share);
    });

    it('does not remember a link the API refused to make', async () => {
      await start();
      const done = store.share('x', 'week', true);
      http
        .expectOne({ url: `${REPORT_URL}/share`, method: 'POST' })
        .flush({ title: 'ต้องใช้แผน Agency' }, { status: 403, statusText: 'Forbidden' });
      await expect(done).rejects.toBeTruthy();
      expect(store.lastShare()).toBeNull();
    });
  });
});

import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { assistStorage } from '../../core/auth/token';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { ReportsStore } from '../../core/data/reports.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiReport, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NewTabService } from '../../core/services/new-tab.service';
import { NotificationService } from '../../core/services/notification.service';
import { lookup } from '../../core/services/title.strategy';
import {
  WS,
  provideApiTesting,
  settle,
  signIn,
  signInHoldingWorkspaces,
} from '../../testing/api-testing';
import { REPORT_URL, report, reportGroup } from '../../testing/engine.fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { ReportsPageComponent } from './reports-page.component';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const URL_A = 'https://www.facebook.com/groups/condo';
const REPORT: ApiReport = report({
  groups: [
    reportGroup({
      name: 'Condo BKK',
      linkId: 'a',
      url: URL_A,
      posted: 18,
      pending: 2,
      failed: 2,
      rate: 90,
    }),
    reportGroup({ name: 'Cars', linkId: 'd', posted: 6, failed: 4, rate: 60 }),
    reportGroup({ name: 'Rent', linkId: 'e', posted: 4, failed: 1, rate: 80, enabled: false }),
    reportGroup({ name: 'Old group', posted: 1, rate: 100 }), // a link that is gone: nothing to switch off
  ],
  posts: [
    { collectionPostId: 'p1', text: 'Teak shelf 1,290 baht', used: 12 },
    { collectionPostId: 'p2', text: 'Condo for rent', used: 30 },
    { collectionPostId: 'p3', text: 'Never used', used: 0 },
  ],
});

describe('ReportsPageComponent', () => {
  let http: HttpTestingController;

  const days = (d: number) =>
    http.expectOne((r) => r.url === REPORT_URL && r.params.get('days') === String(d));

  async function open(
    opts: {
      role?: ApiRole;
      agency?: boolean;
      assist?: boolean;
      report?: ApiReport;
      /** Answer the report only when the test says so. */
      hold?: boolean;
      /** Replace the new-tab service: the addresses it is asked to open land here. */
      opened?: string[];
    } = {},
  ) {
    http = provideApiTesting({
      imports: [ReportsPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
        ...(opts.opened
          ? [{ provide: NewTabService, useValue: { open: (u: string) => opts.opened!.push(u) } }]
          : []),
      ],
    });
    if (opts.assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner', clientReports: opts.agency ?? false },
    });
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
    await settle();
    const pending = days(7);
    http.expectOne(SETS_URL).flush([]);
    if (!opts.hold) {
      pending.flush(opts.report ?? REPORT);
      await settle();
      fixture.detectChanges();
    }
    return { fixture, el: fixture.nativeElement as HTMLElement, pending };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button, a.su-btn')].find((b) =>
      b.textContent?.trim().includes(text),
    ) as HTMLButtonElement | undefined;
  const rows = (el: HTMLElement) => {
    const cells = [...el.querySelectorAll<HTMLElement>('.groups .td')];
    const out: HTMLElement[][] = [];
    for (let i = 0; i < cells.length; i += 7 + 1) out.push(cells.slice(i, i + 8));
    return out;
  };
  const text = (e: Element) => e.textContent?.replace(/\s+/g, ' ').trim();
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const modal = () => document.querySelector<HTMLElement>('.su-modal-panel');

  afterEach(() => {
    try {
      // The link sets store sits on the collections store, which asks for its own list.
      for (const r of http?.match((x) => x.url.endsWith('/collections')) ?? []) r.flush([]);
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
      vi.restoreAllMocks();
    }
  });

  describe('route', () => {
    it('is a lazy page of the signed-in area, titled with its dictionary text', async () => {
      http = provideApiTesting();
      const route = routes
        .find((r) => r.path === 'app')!
        .children!.find((c) => c.path === 'reports')!;
      expect(route.title).toBe('nav.reports');
      expect(lookup(TestBed.inject(I18nService).t(), route.title as string)).toBeTruthy();
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(ReportsPageComponent);
    });
  });

  describe('page', () => {
    it('shows the title and the corrected subtitle: no likes and comments are collected', async () => {
      const { el } = await open();
      expect(el.querySelector('h1')?.textContent).toBe(t().rep.title);
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().rep.sub);
      expect(t().rep.sub).toMatch(/ยังไม่มีข้อมูลไลก์|not collected/);
    });

    it('waits for the numbers before it shows any', async () => {
      const { fixture, el, pending } = await open({ hold: true });
      expect(el.textContent).toContain(t().api.loading);
      expect(el.querySelector('.groups')).toBeNull();
      pending.flush(REPORT);
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('.groups')).not.toBeNull();
      expect(el.textContent).not.toContain(t().api.loading);
    });

    it('says so and offers to try again when the report did not load', async () => {
      const { fixture, el, pending } = await open({ hold: true });
      pending.flush({ title: 'x' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      fixture.detectChanges();
      expect(el.textContent).toContain(t().api.engine.reportsFailed);
      button(el, t().api.engine.reportsRetry)!.click();
      await settle();
      days(7).flush(REPORT);
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('.groups')).not.toBeNull();
    });

    it('switches between 7 and 30 days', async () => {
      const { fixture, el } = await open();
      const [d7, d30] = [...el.querySelectorAll<HTMLButtonElement>('.seg button')];
      expect(d7.textContent?.trim()).toBe(t().rep.range7);
      expect(d7.getAttribute('aria-pressed')).toBe('true');
      expect(d7.classList.contains('on')).toBe(true);
      d30.click();
      fixture.detectChanges();
      expect(d30.getAttribute('aria-pressed')).toBe('true');
      expect(el.textContent).toContain(t().api.loading); // the 7-day numbers are not shown under "30 days"
      await settle();
      days(30).flush(report({ days: 30, groups: [REPORT.groups[1]] }));
      await settle();
      fixture.detectChanges();
      expect(rows(el)).toHaveLength(1);
      expect(rows(el)[0][0].textContent).toContain('Cars');
    });
  });

  describe('by group', () => {
    it('lists the groups with posted, pending, failed and the success rate', async () => {
      const { el } = await open();
      expect([...el.querySelectorAll('.groups .th')].map((h) => h.textContent?.trim())).toEqual([
        t().rep.group,
        t().rep.posted,
        t().rep.pending,
        t().rep.failed,
        t().rep.rate,
        t().rep.likes,
        t().rep.comments,
        '',
      ]);
      expect(rows(el)).toHaveLength(4);
      const first = rows(el)[0].map((c) => text(c));
      expect(first.slice(0, 5)).toEqual(['Condo BKK', '18', '2', '2', '90%']);
      expect(rows(el)[0][0].querySelector('.ph-facebook-logo')).not.toBeNull();
    });

    it('draws the rate bar with the design’s colours', async () => {
      const { el } = await open();
      const bar = (i: number) => rows(el)[i][4].querySelector<HTMLElement>('.ratebar > span')!;
      expect(bar(0).style.width).toBe('90%');
      expect(bar(0).style.background).toContain('success');
      expect(bar(2).style.background).toContain('warning'); // 80%
      expect(bar(1).style.width).toBe('60%');
      expect(bar(1).style.background).toContain('danger');
    });

    it('shows a dash for likes and comments, with the reason, and says what is counted', async () => {
      const { el } = await open();
      for (const r of rows(el)) {
        expect(text(r[5])).toBe('—');
        expect(text(r[6])).toBe('—');
        expect(r[5].title).toBe(t().api.engine.reportsNoLikes);
      }
      const notes = el.querySelector('.notes')!.textContent;
      expect(notes).toContain(t().api.engine.reportsNoLikes);
      expect(notes).toContain(t().api.engine.reportsScope);
      // The design's average likes would be an invented number: the by-post column is a dash too.
      for (const c of el.querySelectorAll('.byPost .td:nth-child(3n)')) expect(text(c)).toBe('—');
    });

    it('scrolls sideways under 640 px instead of squeezing the columns', async () => {
      const { el } = await open();
      expect(el.querySelector('.tbl-wrap .tbl.groups')).not.toBeNull();
    });

    it('says when nothing was posted in the period', async () => {
      const { el } = await open({ report: report() });
      expect(el.querySelector('.groups')).toBeNull();
      expect(el.textContent).toContain(t().api.engine.reportsEmpty);
    });

    it('offers "disable" only for a group that has a link and is not off, and badges one that is off', async () => {
      const { el } = await open();
      const action = (i: number) => rows(el)[i][7];
      expect(button(action(0), t().rep.disable)).toBeTruthy();
      expect(button(action(1), t().rep.disable)).toBeTruthy();
      expect(button(action(2), t().rep.disable)).toBeUndefined(); // off already
      expect(action(2).querySelector('app-chip')?.textContent).toBe(t().ts.hOff);
      expect(action(3).textContent?.trim()).toBe(''); // no link behind it
    });

    it('switches the group off in every link with its address and says so', async () => {
      const { fixture, el } = await open();
      button(rows(el)[0][7], t().rep.disable)!.click();
      await settle();
      http.expectOne(SETS_URL).flush([
        apiLinkSet({
          id: 's1',
          links: [apiLink({ id: 'a', name: 'Condo BKK', url: URL_A, code: '#Jan', dailyMax: 5 })],
        }),
      ]);
      await settle();
      const put = http.expectOne({ url: `${SETS_URL}/s1/links/a`, method: 'PUT' });
      expect(put.request.body.enabled).toBe(false);
      put.flush({ ...put.request.body, id: 'a' });
      await settle();
      http.expectOne(SETS_URL).flush([]);
      days(7).flush(
        report({ groups: [{ ...REPORT.groups[0], enabled: false }, ...REPORT.groups.slice(1)] }),
      );
      await settle();
      fixture.detectChanges();
      expect(toasts().some((x) => x.message === fmt(t().rep.disabledMsg, { g: 'Condo BKK' }))).toBe(
        true,
      );
      expect(t().rep.disabledMsg).not.toMatch(/every link set|ทุกชุดลิงก์/);
      expect(rows(el)[0][7].querySelector('app-chip')?.textContent).toBe(t().ts.hOff);
      expect(button(rows(el)[0][7], t().rep.disable)).toBeUndefined();
    });

    it('does not say a group was switched off when nothing was', async () => {
      const { el } = await open();
      button(rows(el)[1][7], t().rep.disable)!.click();
      await settle();
      http.expectOne(SETS_URL).flush([]); // no link with that address any more
      await settle();
      http.expectOne(SETS_URL).flush([]);
      days(7).flush(REPORT);
      await settle();
      expect(toasts().some((x) => x.message === fmt(t().rep.disabledMsg, { g: 'Cars' }))).toBe(
        false,
      );
    });

    it('turns "disable" off for a viewer with the reason, since the API would refuse', async () => {
      const { el } = await open({ role: 'viewer' });
      const b = button(rows(el)[0][7], t().rep.disable)!;
      expect(b.disabled).toBe(true);
      expect(b.title).toBe(t().api.permEdit);
    });

    it('turns "disable" off in assist mode', async () => {
      const { el } = await open({ assist: true });
      expect(button(rows(el)[0][7], t().rep.disable)!.disabled).toBe(true);
    });

    it('lets an editor disable', async () => {
      const { el } = await open({ role: 'editor' });
      expect(button(rows(el)[0][7], t().rep.disable)!.disabled).toBe(false);
    });
  });

  describe('by post', () => {
    const postRows = (el: HTMLElement) => {
      const cells = [...el.querySelectorAll<HTMLElement>('.byPost .td')];
      const out: HTMLElement[][] = [];
      for (let i = 0; i < cells.length; i += 3) out.push(cells.slice(i, i + 3));
      return out;
    };

    it('lists the most used posts first, with the top badge on the first one only', async () => {
      const { el } = await open();
      expect([...el.querySelectorAll('.byPost .th')].map((h) => h.textContent?.trim())).toEqual([
        t().rep.post,
        t().rep.used,
        t().rep.avgLikes,
      ]);
      expect(postRows(el).map((r) => [text(r[0]), text(r[1])])).toEqual([
        ['Condo for rent' + t().rep.best, '30'],
        ['Teak shelf 1,290 baht', '12'],
        ['Never used', '0'],
      ]);
      expect(el.querySelectorAll('.byPost app-chip')).toHaveLength(1);
    });

    it('gives no badge when no post was used', async () => {
      const { el } = await open({
        report: report({ ...REPORT, posts: [{ collectionPostId: 'p', text: 'x', used: 0 }] }),
      });
      expect(el.querySelector('.byPost app-chip')).toBeNull();
    });

    it('says when no post from a collection went out', async () => {
      const { el } = await open({ report: report({ groups: REPORT.groups }) });
      expect(el.querySelector('.byPost')).toBeNull();
      expect(el.textContent).toContain(t().api.engine.reportsPostsEmpty);
    });
  });

  describe('client report', () => {
    const card = (el: HTMLElement) => el.querySelector('app-client-report-card')!;
    const create = (el: HTMLElement) => button(card(el), t().rep.clientBtn)!;

    it('is locked below Agency, with the upgrade for the owner', async () => {
      const { el } = await open();
      expect(card(el).textContent).toContain(t().rep.client);
      expect(card(el).textContent).toContain(t().rep.clientSub);
      expect(card(el).querySelector('.lock')?.textContent).toContain(t().rep.clientLocked);
      expect(card(el).querySelector('a[href="/app/billing"]')?.textContent).toContain(
        t().common.upgrade,
      );
      expect(create(el).disabled).toBe(true);
      expect(create(el).title).toBe(t().rep.clientLocked);
    });

    it('shows no lock before the workspaces have arrived, then says the plan has no client reports', async () => {
      http = provideApiTesting({
        imports: [ReportsPageComponent],
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          { provide: DeviceEventsService, useClass: FakeDeviceEvents },
        ],
      });
      const ws = TestBed.inject(WorkspaceStore);
      const held = await signInHoldingWorkspaces(http);
      const fixture = TestBed.createComponent(ReportsPageComponent);
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(ws.loaded()).toBe(false);
      expect(card(el).querySelector('.lock')).toBeNull();
      expect(create(el).title).not.toBe(t().rep.clientLocked);
      await held.answer({ clientReports: false });
      days(7).flush(REPORT);
      await settle();
      fixture.detectChanges();
      expect(card(el).querySelector('.lock')?.textContent).toContain(t().rep.clientLocked);
      expect(create(el).title).toBe(t().rep.clientLocked);
    });

    it('offers no upgrade to someone who is not the owner', async () => {
      const { el } = await open({ role: 'admin' });
      expect(card(el).querySelector('.lock')).not.toBeNull();
      expect(card(el).querySelector('a[href="/app/billing"]')).toBeNull();
    });

    it('is on for an admin of an Agency workspace', async () => {
      const { el } = await open({ agency: true, role: 'admin' });
      expect(card(el).querySelector('.lock')).toBeNull();
      expect(create(el).disabled).toBe(false);
    });

    it('is off for an editor even on Agency, since the API wants an admin', async () => {
      const { el } = await open({ agency: true, role: 'editor' });
      expect(create(el).disabled).toBe(true);
      expect(create(el).title).toBe(t().api.permAdmin);
    });

    it('is off in assist mode', async () => {
      const { el } = await open({ agency: true, assist: true });
      expect(create(el).disabled).toBe(true);
    });

    describe('the dialog', () => {
      const fields = () => modal()!.querySelectorAll<HTMLInputElement>('input.su-input');
      const selects = () => modal()!.querySelectorAll<HTMLSelectElement>('select');
      const make = () => button(modal()!, t().rep.clientBtn)!;
      const SHARE = { token: 'tok123', path: '/report/tok123', expiresAt: '2026-11-03T05:00:00Z' };

      async function dialog(opened?: string[]) {
        const r = await open({ agency: true, opened });
        create(r.el).click();
        r.fixture.detectChanges();
        return r;
      }

      it('opens with the design’s fields and the white-label switch on', async () => {
        await dialog();
        expect(modal()?.querySelector('h2')?.textContent).toBe(t().rep.client);
        expect(fields()[0].maxLength).toBe(120);
        expect([...selects()[0].options].map((o) => [o.value, o.textContent])).toEqual([
          ['week', t().rep.pWeek],
          ['month', t().rep.pMonth],
        ]);
        expect([...selects()[1].options].map((o) => o.value)).toEqual(['pdf', 'link']);
        const logo = modal()!.querySelector<HTMLInputElement>('input[type=checkbox]')!;
        expect(logo.checked).toBe(true);
        // The design promised an agency logo; nothing stores one, so the box says what it really does.
        expect(modal()!.textContent).toContain(t().rep.logo);
        expect(t().rep.logo).not.toMatch(/โลโก้เอเจนซี่แทน|agency logo instead/);
      });

      it('wants a brand name', async () => {
        const { fixture } = await dialog();
        make().click();
        fixture.detectChanges();
        expect(modal()!.querySelector('.su-field-err')?.textContent).toBe(t().rep.errBrand);
        http.expectNone({ url: `${REPORT_URL}/share`, method: 'POST' });
      });

      it('makes a PDF: opens the print view of the report in a new tab and shows the link', async () => {
        const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
        const { fixture, el } = await dialog();
        type(fields()[0], 'Baan Dee Studio');
        fixture.detectChanges();
        make().click();
        await settle();
        const req = http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' });
        expect(req.request.body).toEqual({ brand: 'Baan Dee Studio', period: 'week', logo: true });
        req.flush(SHARE);
        await settle();
        fixture.detectChanges();
        const base = window.location.origin;
        expect(open_).toHaveBeenCalledWith(
          `${base}/report/tok123?print=1`,
          '_blank',
          'noopener,noreferrer',
        );
        expect(modal()).toBeNull();
        expect(
          toasts().some(
            (x) =>
              x.message ===
              fmt(t().rep.created, { p: t().rep.pWeek, w: 'Shop', l: `${base}/report/tok123` }),
          ),
        ).toBe(true);
        expect(toasts().some((x) => x.message === t().api.engine.reportPdfHint)).toBe(true);
        expect(card(el).querySelector('[data-testid=share-url]')?.textContent).toBe(
          `${base}/report/tok123`,
        );
        expect(card(el).textContent).toContain(
          fmt(t().api.engine.reportShareExpires, { d: '3 พ.ย. 2569' }),
        );
        const anchors = [...card(el).querySelectorAll<HTMLAnchorElement>('a[target=_blank]')];
        expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
          `${base}/report/tok123`,
          `${base}/report/tok123?print=1`,
        ]);
        // The links in the card give the new tab no reference back to this page either.
        for (const a of anchors)
          expect(a.rel.split(' ').sort()).toEqual(['noopener', 'noreferrer']);
      });

      it('opens the print view through the new-tab service, never with window.open itself', async () => {
        const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
        const opened: string[] = [];
        const { fixture } = await dialog(opened);
        type(fields()[0], 'Baan Dee Studio');
        make().click();
        await settle();
        http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' }).flush(SHARE);
        await settle();
        fixture.detectChanges();
        expect(opened).toEqual([`${window.location.origin}/report/tok123?print=1`]);
        expect(open_).not.toHaveBeenCalled();
      });

      it('opens nothing for a link-only report', async () => {
        const opened: string[] = [];
        const { fixture } = await dialog(opened);
        type(fields()[0], 'Baan Dee Studio');
        selects()[1].value = 'link';
        selects()[1].dispatchEvent(new Event('change'));
        make().click();
        await settle();
        http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' }).flush(SHARE);
        await settle();
        fixture.detectChanges();
        expect(opened).toEqual([]);
      });

      it('makes a link only: nothing opens, the link shows', async () => {
        const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
        const { fixture, el } = await dialog();
        type(fields()[0], ' Baan Dee ');
        selects()[0].value = 'month';
        selects()[0].dispatchEvent(new Event('change'));
        selects()[1].value = 'link';
        selects()[1].dispatchEvent(new Event('change'));
        modal()!.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
        fixture.detectChanges();
        make().click();
        await settle();
        const req = http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' });
        expect(req.request.body).toEqual({ brand: 'Baan Dee', period: 'month', logo: false });
        req.flush(SHARE);
        await settle();
        fixture.detectChanges();
        expect(open_).not.toHaveBeenCalled();
        expect(
          toasts().some((x) => x.message.includes(t().rep.pMonth) && x.message.includes('tok123')),
        ).toBe(true);
        expect(toasts().some((x) => x.message === t().api.engine.reportPdfHint)).toBe(false);
        expect(card(el).querySelector('[data-testid=share-url]')).not.toBeNull();
      });

      it('stays open when the API refuses (a plan below Agency, too many links)', async () => {
        const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
        const { fixture, el } = await dialog();
        type(fields()[0], 'Baan Dee');
        make().click();
        await settle();
        http
          .expectOne({ url: `${REPORT_URL}/share`, method: 'POST' })
          .flush({ title: 'ต้องใช้แผน Agency' }, { status: 403, statusText: 'Forbidden' });
        await settle();
        fixture.detectChanges();
        expect(modal()).not.toBeNull();
        expect(fields()[0].value).toBe('Baan Dee');
        expect(open_).not.toHaveBeenCalled();
        expect(card(el).querySelector('[data-testid=share-url]')).toBeNull();
      });

      it('copies the link', async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: write },
          configurable: true,
        });
        vi.spyOn(window, 'open').mockReturnValue(null);
        const { fixture, el } = await dialog();
        type(fields()[0], 'Baan Dee');
        make().click();
        await settle();
        http.expectOne({ url: `${REPORT_URL}/share`, method: 'POST' }).flush(SHARE);
        await settle();
        fixture.detectChanges();
        button(card(el), t().api.engine.reportShareCopy)!.click();
        await settle();
        expect(write).toHaveBeenCalledWith(`${window.location.origin}/report/tok123`);
        expect(toasts().some((x) => x.message === t().api.engine.reportShareCopied)).toBe(true);
      });
    });
  });

  it('reads the dictionary in English too', async () => {
    const { fixture, el } = await open();
    TestBed.inject(I18nService).setLang('en');
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toBe('Reports');
    expect(el.textContent).toContain('Likes and comments are not collected yet');
    TestBed.inject(I18nService).setLang('th');
  });

  it('the store is the page’s only source: nothing is read twice on a first visit', async () => {
    const { el } = await open();
    expect(TestBed.inject(ReportsStore).loaded()).toBe(true);
    expect(el.querySelector('.groups')).not.toBeNull();
    http.expectNone((r) => r.url === REPORT_URL);
  });
});

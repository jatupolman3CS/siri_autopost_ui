import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { routes } from '../../app.routes';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { DictionaryTitleStrategy, lookup } from '../../core/services/title.strategy';
import { NotificationService } from '../../core/services/notification.service';
import { provideApiTesting, settle } from '../../testing/api-testing';
import { report, reportGroup, sharedReport } from '../../testing/engine.fixtures';
import { SharedReportPageComponent } from './shared-report-page.component';

const URL_ = '/api/reports/shared/tok123';
const FULL = sharedReport({
  report: report({
    groups: [
      reportGroup({ name: 'Condo BKK', linkId: 'a', posted: 18, pending: 2, failed: 2, rate: 90 }),
      reportGroup({ name: 'Cars', linkId: 'd', posted: 6, failed: 4, rate: 60 }),
    ],
    posts: [
      { collectionPostId: 'p1', text: 'Teak shelf 1,290 baht', used: 12 },
      { collectionPostId: 'p2', text: 'Condo for rent', used: 30 },
    ],
  }),
});

describe('SharedReportPageComponent', () => {
  let http: HttpTestingController;

  async function open(
    opts: { token?: string; print?: string; hold?: boolean; body?: unknown } = {},
  ) {
    http = provideApiTesting({ imports: [SharedReportPageComponent] });
    const fixture = TestBed.createComponent(SharedReportPageComponent);
    fixture.componentRef.setInput('token', opts.token ?? 'tok123');
    if (opts.print !== undefined) fixture.componentRef.setInput('print', opts.print);
    fixture.detectChanges();
    await settle();
    const req = http.expectOne(URL_);
    if (!opts.hold) {
      req.flush(opts.body ?? FULL);
      await settle();
      fixture.detectChanges();
      await settle();
    }
    return { fixture, el: fixture.nativeElement as HTMLElement, req };
  }

  const t = () => TestBed.inject(I18nService).t();
  const text = (e: Element | null) => e?.textContent?.replace(/\s+/g, ' ').trim();
  const tiles = (el: HTMLElement) =>
    [...el.querySelectorAll('.kpi')].map((k) => [
      text(k.querySelector('.label')),
      text(k.querySelector('.value')),
    ]);

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
      vi.restoreAllMocks();
    }
  });

  describe('route', () => {
    it('is public (no guard), has no layout and is titled with the report title', async () => {
      http = provideApiTesting();
      const route = routes.find((r) => r.path === 'report/:token')!;
      expect(route.title).toBe('api.reportTitle');
      expect(route.canActivate).toBeUndefined();
      expect(route.children).toBeUndefined();
      expect(lookup(t(), route.title as string)).toBeTruthy();
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(SharedReportPageComponent);
    });
  });

  describe('loading', () => {
    it('asks for the report behind the token, without signing in', async () => {
      const { req } = await open({ hold: true });
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush(FULL);
    });

    it('shows a loading box until the report arrives', async () => {
      const { fixture, el, req } = await open({ hold: true });
      expect(el.querySelector('[role=status]')?.textContent).toContain(t().api.loading);
      expect(el.querySelector('.doc')).toBeNull();
      expect(el.querySelector('button.su-btn-secondary')).toBeNull(); // nothing to print yet
      req.flush(FULL);
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('.doc')).not.toBeNull();
    });

    it('says the report was not found (an unknown or expired link) without a toast', async () => {
      const { el, req, fixture } = await open({ hold: true });
      req.flush({ title: 'ไม่พบรายงาน' }, { status: 404, statusText: 'Not Found' });
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toBe(t().api.engine.sharedNotFound);
      expect(el.textContent).toContain(t().api.engine.sharedNotFoundBody);
      expect(el.querySelector('.doc')).toBeNull();
      expect(TestBed.inject(NotificationService).toasts()).toEqual([]);
    });

    it('says the same for a token the API calls invalid', async () => {
      const { el, req, fixture } = await open({ hold: true });
      req.flush({ title: 'bad' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toBe(t().api.engine.sharedNotFound);
    });

    it('says it could not load, and tries again on request, when the server is down', async () => {
      const { el, req, fixture } = await open({ hold: true });
      req.flush({ title: 'x' }, { status: 500, statusText: 'Server Error' });
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')?.textContent).toContain(t().api.engine.sharedFailed);
      el.querySelector<HTMLButtonElement>('[role=alert] button')!.click();
      await settle();
      http.expectOne(URL_).flush(FULL);
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('.doc')).not.toBeNull();
      expect(el.querySelector('[role=alert]')).toBeNull();
    });

    it('reads another report when the token changes', async () => {
      const { fixture, el } = await open();
      fixture.componentRef.setInput('token', 'other');
      fixture.detectChanges();
      await settle();
      http.expectOne('/api/reports/shared/other').flush(sharedReport({ brand: 'Other Co' }));
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toBe('Other Co');
    });

    it('is not found without a token, and sends nothing', async () => {
      http = provideApiTesting({ imports: [SharedReportPageComponent] });
      const fixture = TestBed.createComponent(SharedReportPageComponent);
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe(
        t().api.engine.sharedNotFound,
      );
    });
  });

  describe('the report', () => {
    it('shows the brand name, the workspace, the period and its dates', async () => {
      const { el } = await open();
      expect(el.querySelector('.head h1')?.textContent).toBe('Baan Dee Studio');
      expect(text(el.querySelector('.kind'))).toBe(`${t().api.reportTitle} · ${t().rep.pWeek}`);
      expect(text(el.querySelector('.meta'))).toBe(
        `${fmt(t().api.engine.sharedFor, { w: 'Shop' })} · ${fmt(t().api.engine.sharedPeriod, { a: '27 ก.ย. 2569', b: '4 ต.ค. 2569' })}`,
      );
    });

    it('names a month report', async () => {
      const { el } = await open({
        body: sharedReport({ period: 'month', report: report({ days: 30 }) }),
      });
      expect(text(el.querySelector('.kind'))).toContain(t().rep.pMonth);
    });

    it('totals the groups in the summary tiles', async () => {
      const { el } = await open();
      expect(tiles(el)).toEqual([
        [t().rep.posted, '24'],
        [t().rep.pending, '2'],
        [t().rep.failed, '6'],
        [t().rep.rate, '80%'],
      ]);
    });

    it('lists the groups with their numbers and rate bars, and no likes or comments', async () => {
      const { el } = await open();
      expect([...el.querySelectorAll('.groups .th')].map((h) => text(h))).toEqual([
        t().rep.group,
        t().rep.posted,
        t().rep.pending,
        t().rep.failed,
        t().rep.rate,
      ]);
      const cells = [...el.querySelectorAll('.groups .td')].map((c) => text(c));
      expect(cells).toEqual(['Condo BKK', '18', '2', '2', '90%', 'Cars', '6', '0', '4', '60%']);
      const bars = [...el.querySelectorAll<HTMLElement>('.ratebar > span')];
      expect(bars.map((b) => b.style.width)).toEqual(['90%', '60%']);
      expect(bars[0].style.background).toContain('success');
      expect(bars[1].style.background).toContain('danger');
      expect(el.textContent).not.toContain(t().rep.likes);
      expect(el.textContent).not.toContain(t().rep.comments);
    });

    it('lists the most used posts with the top badge on the first', async () => {
      const { el } = await open();
      expect([...el.querySelectorAll('.byPost .th')].map((h) => text(h))).toEqual([
        t().rep.post,
        t().rep.used,
      ]);
      expect([...el.querySelectorAll('.byPost .td')].map((c) => text(c))).toEqual([
        `Condo for rent${t().rep.best}`,
        '30',
        'Teak shelf 1,290 baht',
        '12',
      ]);
      expect(el.querySelectorAll('.byPost app-chip')).toHaveLength(1);
    });

    it('says when nothing was posted, and leaves out the post table', async () => {
      const { el } = await open({ body: sharedReport() });
      expect(el.querySelector('.groups')).toBeNull();
      expect(el.textContent).toContain(t().api.engine.reportsEmpty);
      expect(el.querySelector('.byPost')).toBeNull();
      expect(tiles(el)[3]).toEqual([t().rep.rate, '100%']);
    });

    it('says when it was made, until when it works and that it does not update', async () => {
      const { el } = await open();
      const foot = text(el.querySelector('.foot'))!;
      expect(foot).toContain(fmt(t().api.engine.sharedCreated, { d: '4 ต.ค. 2569' }));
      expect(foot).toContain(fmt(t().api.engine.reportShareExpires, { d: '3 พ.ย. 2569' }));
      expect(foot).toContain(t().api.engine.sharedSnapshot);
    });

    it('reads in English with Gregorian years', async () => {
      const { fixture, el } = await open();
      TestBed.inject(I18nService).setLang('en');
      fixture.detectChanges();
      expect(text(el.querySelector('.meta'))).toContain('Workspace Shop');
      expect(text(el.querySelector('.meta'))).toContain('27 Sep 2026 – 4 Oct 2026');
      expect(text(el.querySelector('.kind'))).toBe('Posting report · Last 7 days');
      TestBed.inject(I18nService).setLang('th');
    });
  });

  describe('branding (the "logo" switch is a white-label switch)', () => {
    it('shows the brand name only when logo is on: no AutoPost name, mark or credit', async () => {
      const { el } = await open({ body: { ...FULL, logo: true } });
      expect(el.querySelector('.ap')).toBeNull();
      expect(el.querySelector('.foot .by')).toBeNull();
      expect(el.querySelector('.doc')?.textContent).not.toContain('AutoPost');
    });

    it('shows the AutoPost mark and credit when logo is off', async () => {
      const { el } = await open({ body: { ...FULL, logo: false } });
      expect(el.querySelector('.ap')?.textContent).toContain('AutoPost');
      expect(el.querySelector('.ap .ph-paper-plane-tilt')).not.toBeNull();
      expect(text(el.querySelector('.foot .by'))).toBe(t().api.engine.sharedPoweredBy);
    });

    it('puts the brand in the tab title when white-label, and keeps it when the language changes', async () => {
      http = provideApiTesting({ imports: [SharedReportPageComponent] });
      TestBed.inject(DictionaryTitleStrategy); // writes its own title on every language switch
      const fixture = TestBed.createComponent(SharedReportPageComponent);
      fixture.componentRef.setInput('token', 'tok123');
      fixture.detectChanges();
      await settle();
      http.expectOne(URL_).flush({ ...FULL, logo: true });
      await settle();
      fixture.detectChanges();
      await settle();
      await Promise.resolve();
      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe(`Baan Dee Studio · ${t().api.reportTitle}`);
      expect(title.getTitle()).not.toContain('AutoPost');
      TestBed.inject(I18nService).setLang('en');
      fixture.detectChanges();
      await settle();
      await Promise.resolve();
      expect(title.getTitle()).toBe('Baan Dee Studio · Posting report');
      TestBed.inject(I18nService).setLang('th');
    });

    it('says AutoPost in the tab title when it is not white-label', async () => {
      await open({ body: { ...FULL, logo: false } });
      await Promise.resolve();
      expect(TestBed.inject(Title).getTitle()).toBe(
        `Baan Dee Studio · ${t().api.reportTitle} · AutoPost`,
      );
    });
  });

  describe('printing', () => {
    it('has a print button, outside what is printed', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { el } = await open();
      const tools = el.querySelector('.tools')!;
      expect(tools.classList.contains('no-print')).toBe(true);
      const button = [...tools.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(t().api.engine.reportSharePrint),
      )!;
      button.click();
      expect(print).toHaveBeenCalledTimes(1);
    });

    it('does not print by itself', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      await open();
      expect(print).not.toHaveBeenCalled();
    });

    it('prints once when the address has ?print=1, after the report is on screen', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { fixture, req } = await open({ print: '1', hold: true });
      expect(print).not.toHaveBeenCalled(); // nothing to print before the report arrives
      req.flush(FULL);
      await settle();
      fixture.detectChanges();
      await settle();
      expect(print).toHaveBeenCalledTimes(1);
      fixture.detectChanges();
      await settle();
      expect(print).toHaveBeenCalledTimes(1);
    });

    it('does not print a report that was not found', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { fixture, req } = await open({ print: '1', hold: true });
      req.flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
      fixture.detectChanges();
      await settle();
      expect(print).not.toHaveBeenCalled();
    });

    it('ignores any other value of print', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      await open({ print: '0' });
      expect(print).not.toHaveBeenCalled();
    });
  });

  it('has the language and theme switch, which is not printed', async () => {
    const { el } = await open();
    expect(el.querySelector('.tools app-lang-theme-switch')).not.toBeNull();
  });
});

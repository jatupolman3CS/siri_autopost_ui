import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { Dict, I18nService } from '../core/i18n/i18n.service';
import { lookup } from '../core/services/title.strategy';

const app = routes.find((r) => r.path === 'app')!;

async function load(route: Route): Promise<Type<unknown>> {
  return (await (route.loadComponent as () => Promise<Type<unknown>>)()) as Type<unknown>;
}

// The pages of the collections / link sets / schedules flow and of the engine are placeholders until the real
// pages replace them; their routes, titles and the way they read the dictionary are what later pages build on.
describe('routes of the redesigned app', () => {
  const pages: {
    path: string;
    title: string;
    cls: string;
    module: () => Promise<Record<string, unknown>>;
    text: (t: Dict) => [string, string];
    step?: number;
  }[] = [
    {
      path: 'collections',
      title: 'nav.collections',
      cls: 'CollectionsPageComponent',
      module: () => import('./collections/collections-page.component'),
      text: (t) => [t.col.title, t.col.sub],
      step: 1,
    },
    {
      path: 'targets',
      title: 'nav.targets',
      cls: 'TargetsPageComponent',
      module: () => import('./targets/targets-page.component'),
      text: (t) => [t.ts.title, t.ts.sub],
      step: 2,
    },
    {
      path: 'schedules',
      title: 'nav.schedules',
      cls: 'SchedulesPageComponent',
      module: () => import('./schedules/schedules-page.component'),
      text: (t) => [t.sch.title, t.sch.sub],
      step: 3,
    },
    {
      path: 'reports',
      title: 'nav.reports',
      cls: 'ReportsPageComponent',
      module: () => import('./reports/reports-page.component'),
      text: (t) => [t.rep.title, t.rep.sub],
    },
    {
      path: 'test',
      title: 'nav.test',
      cls: 'TestPageComponent',
      module: () => import('./test/test-page.component'),
      text: (t) => [t.test.title, t.test.sub],
    },
    {
      path: 'notify',
      title: 'nav.notify',
      cls: 'NotifyPageComponent',
      module: () => import('./notify/notify-page.component'),
      text: (t) => [t.ntf.title, t.ntf.sub],
    },
    {
      path: 'engage',
      title: 'nav.engage',
      cls: 'EngagePageComponent',
      module: () => import('./engage/engage-page.component'),
      text: (t) => [t.ar.title, t.ar.sub],
    },
  ];

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  for (const page of pages) {
    describe(`/app/${page.path}`, () => {
      const route = () => app.children!.find((c) => c.path === page.path)!;

      it('is a lazy page of the signed-in area with the title of its dictionary text', () => {
        expect(route()).toBeDefined();
        expect(route().title).toBe(page.title);
        expect(typeof route().loadComponent).toBe('function');
      });

      it(`renders ${page.cls} with its title and subtitle from the dictionary`, async () => {
        const type = await load(route());
        expect(type).toBe((await page.module())[page.cls]);
        TestBed.configureTestingModule({ providers: [provideRouter([])] });
        const fixture = TestBed.createComponent(type);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(I18nService).t();
        const [title, sub] = page.text(t);
        expect(el.querySelector('h1')?.textContent).toBe(title);
        expect(el.querySelector('.page-head p')?.textContent).toBe(sub);
        // Thai by default, and the route title is a dictionary path that exists.
        expect(lookup(t, route().title as string)).toBeTruthy();
        // The three pages of the flow show the stepper at their own step.
        const current = el.querySelector('a.step[aria-current="step"] .num');
        expect(current?.textContent?.trim() ?? null).toBe(page.step ? String(page.step) : null);
      });
    });
  }

  it('has the next-step card on the flow pages (simple mode)', async () => {
    const type = await load(app.children!.find((c) => c.path === 'targets')!);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    const t = TestBed.inject(I18nService).t();
    expect((fixture.nativeElement as HTMLElement).querySelector('.next')?.textContent).toContain(
      t.flow.n2,
    );
  });

  it('keeps the composer and the extension campaigns page as routes, although they have no menu item', () => {
    for (const path of ['composer', 'campaigns'])
      expect(
        app.children!.some((c) => c.path === path),
        path,
      ).toBe(true);
  });

  describe('the public shared report (/report/:token)', () => {
    const route = routes.find((r) => r.path === 'report/:token')!;

    it('is outside the signed-in area: no layout, no guard', () => {
      expect(route).toBeDefined();
      expect(route.component).toBeUndefined();
      expect(route.canActivate).toBeUndefined();
      expect(route.title).toBe('api.reportTitle');
      expect(app.children!.some((c) => c.path === 'report/:token')).toBe(false);
    });

    it('renders SharedReportPageComponent with the title from the shared strings', async () => {
      const type = await load(route);
      const { SharedReportPageComponent } = await import('./public/shared-report-page.component');
      expect(type).toBe(SharedReportPageComponent);
      const fixture = TestBed.createComponent(type);
      fixture.componentRef.setInput('token', 'abc');
      fixture.detectChanges();
      const t = TestBed.inject(I18nService).t();
      expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
        t.api.reportTitle,
      );
      expect(lookup(t, route.title as string)).toBe(t.api.reportTitle);
    });
  });
});

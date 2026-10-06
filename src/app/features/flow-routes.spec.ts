import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RedirectFunction, Route, UrlTree, provideRouter } from '@angular/router';
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
      path: 'posts',
      title: 'api.postsNav',
      cls: 'PostsPageComponent',
      module: () => import('./posts/posts-page.component'),
      text: (t) => [t.api.flow.plTitle, t.api.flow.plSub],
      step: 1,
    },
    {
      path: 'collections',
      title: 'nav.collections',
      cls: 'CollectionsPageComponent',
      module: () => import('./collections/collections-page.component'),
      text: (t) => [t.col.title, t.col.sub],
      step: 2,
    },
    {
      path: 'schedules',
      title: 'nav.schedules',
      cls: 'SchedulesPageComponent',
      module: () => import('./schedules/schedules-page.component'),
      text: (t) => [t.sch.title, t.sch.sub],
      step: 4,
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

  // The editor is a panel of the post library now; the old composer address still works for bookmarks.
  describe('/app/composer', () => {
    const composer = () => app.children!.find((c) => c.path === 'composer')!;
    const redirect = (queryParams: Record<string, string>) =>
      TestBed.runInInjectionContext(() =>
        (composer().redirectTo as RedirectFunction)({ queryParams } as never),
      ) as UrlTree;

    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

    it('is a redirect to the post library, not a page of its own', () => {
      expect(typeof composer().redirectTo).toBe('function');
      expect(composer().loadComponent).toBeUndefined();
      expect(composer().component).toBeUndefined();
    });

    it('opens the post of the address in the post library', () => {
      expect(redirect({ collection: 'a', post: 'p1' }).toString()).toBe('/app/posts?post=p1');
      expect(redirect({ post: 'p1' }).toString()).toBe('/app/posts?post=p1');
    });

    it('starts a new post in the collection of the address', () => {
      expect(redirect({ collection: 'a' }).toString()).toBe('/app/posts?new=1&collection=a');
    });

    it('continues the post in progress when the address has nothing', () => {
      expect(redirect({}).toString()).toBe('/app/posts?new=1');
    });

    it('keeps nothing else of the old address', () => {
      expect(redirect({ foo: 'bar', collection: 'a' }).toString()).toBe(
        '/app/posts?new=1&collection=a',
      );
    });
  });

  // The extension-settings page is gone. Installed extensions of older versions still open /app/campaigns after
  // pairing, so that address (and the old preview page's) must land on a real page.
  it('sends the old extension-settings and extension-preview addresses to real pages', () => {
    const old = (path: string) => app.children!.find((c) => c.path === path)!;
    expect(old('campaigns').redirectTo).toBe('antiban');
    expect(old('extension').redirectTo).toBe('team');
    for (const path of ['campaigns', 'extension']) expect(old(path).loadComponent).toBeUndefined();
    const targets = new Set(app.children!.filter((c) => c.loadComponent).map((c) => c.path));
    expect(targets.has('antiban')).toBe(true);
    expect(targets.has('team')).toBe(true);
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

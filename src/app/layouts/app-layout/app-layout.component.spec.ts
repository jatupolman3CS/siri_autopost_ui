import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { SIMPLE_KEY } from '../../core/services/ui-prefs.service';
import {
  answerWorkspaceLoads,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { AppLayoutComponent } from './app-layout.component';

interface Link {
  path: string;
  label: string;
  on: boolean;
  badge: string | null;
}

describe('the sidebar of the app shell', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AppLayoutComponent>;
  let el: HTMLElement;

  async function render(
    opts: { simple?: boolean; url?: string; data?: Parameters<typeof signIn>[1] } = {},
  ) {
    http = provideApiTesting({
      imports: [AppLayoutComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    if (opts.simple === false) localStorage.setItem(SIMPLE_KEY, '0');
    TestBed.inject(WorkspaceStore);
    await signIn(http, opts.data ?? {});
    fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, opts.data ?? {});
    await settle();
    if (opts.url) await TestBed.inject(Router).navigateByUrl(opts.url);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const groups = () =>
    [...el.querySelectorAll('.side .group')].map((g) => ({
      label: g.querySelector('.group-label')!.textContent!.trim(),
      links: [...g.querySelectorAll<HTMLAnchorElement>('a.nav')].map((a): Link => ({
        path: a.getAttribute('href')!,
        label: a.querySelector('.label')!.textContent!.trim(),
        on: a.classList.contains('on'),
        badge: a.querySelector('.count')?.textContent?.trim() ?? null,
      })),
    }));
  const paths = (label: string) =>
    groups()
      .find((g) => g.label === label)!
      .links.map((l) => l.path);
  const toggle = () => el.querySelector<HTMLButtonElement>('.more-btn')!;

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  describe('simple mode (the default)', () => {
    it('keeps the three-step flow, the calendar and the errors, then the account', async () => {
      await render();
      const t = TestBed.inject(I18nService).t().nav;
      expect(groups().map((g) => g.label)).toEqual([t.gWorkspace, t.gAccount]);
      expect(groups()[0].links.map((l) => [l.path, l.label])).toEqual([
        ['/app/overview', t.overview],
        ['/app/collections', t.postsShort],
        ['/app/targets', t.groupsShort],
        ['/app/schedules', t.scheduleShort],
        ['/app/calendar', t.calendar],
        ['/app/errors', t.errors],
      ]);
      expect(paths(t.gAccount)).toEqual(['/app/billing', '/app/team']);
    });

    it('has no item for the composer, the campaigns page or the engine pages', async () => {
      await render();
      const all = groups().flatMap((g) => g.links.map((l) => l.path));
      for (const gone of [
        '/app/composer',
        '/app/campaigns',
        '/app/library',
        '/app/reports',
        '/app/test',
        '/app/antiban',
        '/app/notify',
        '/app/engage',
        '/app/offline',
        '/app/extension',
      ])
        expect(all).not.toContain(gone);
    });

    it('offers to show the advanced menu', async () => {
      await render();
      const t = TestBed.inject(I18nService).t().nav;
      expect(toggle().textContent).toContain(t.moreMenu);
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('the full menu', () => {
    it('has the design groups: workspace, engine, account and preview', async () => {
      await render({ simple: false });
      const t = TestBed.inject(I18nService).t().nav;
      expect(groups().map((g) => g.label)).toEqual([
        t.gWorkspace,
        t.gEngine,
        t.gAccount,
        t.gPreview,
      ]);
      expect(paths(t.gWorkspace)).toEqual([
        '/app/overview',
        '/app/collections',
        '/app/targets',
        '/app/schedules',
        '/app/calendar',
        '/app/library',
        '/app/reports',
      ]);
      expect(paths(t.gEngine)).toEqual([
        '/app/test',
        '/app/antiban',
        '/app/notify',
        '/app/engage',
        '/app/offline',
        '/app/errors',
      ]);
      expect(paths(t.gAccount)).toEqual(['/app/billing', '/app/team']);
      expect(paths(t.gPreview)).toEqual(['/app/extension']);
    });

    it('uses the long labels, not the short ones of simple mode', async () => {
      await render({ simple: false });
      const t = TestBed.inject(I18nService).t().nav;
      const labels = groups()[0].links.map((l) => l.label);
      expect(labels).toContain(t.collections);
      expect(labels).toContain(t.targets);
      expect(labels).not.toContain(t.postsShort);
    });

    it('offers to hide the advanced menu', async () => {
      await render({ simple: false });
      expect(toggle().textContent).toContain(TestBed.inject(I18nService).t().nav.lessMenu);
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('switches between the two menus with the button and remembers it', async () => {
    await render();
    const t = TestBed.inject(I18nService).t().nav;
    toggle().click();
    fixture.detectChanges();
    expect(groups().map((g) => g.label)).toContain(t.gEngine);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('0');
    toggle().click();
    fixture.detectChanges();
    expect(groups().map((g) => g.label)).not.toContain(t.gEngine);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('1');
  });

  describe('the owner group', () => {
    it('is shown to platform admins in both menus', async () => {
      await render({ data: { user: { role: 'admin' } } });
      const t = TestBed.inject(I18nService).t().nav;
      const owner = () => groups().find((g) => g.label === t.gOwner);
      expect(owner()!.links.map((l) => l.path)).toEqual([
        '/app/admin',
        '/app/admin/customers',
        '/app/admin/finance',
        '/app/admin/plans',
        '/app/admin/jobs',
      ]);
      toggle().click();
      fixture.detectChanges();
      expect(owner()).toBeDefined();
      // After the account group, before the preview.
      const labels = groups().map((g) => g.label);
      expect(labels.indexOf(t.gOwner)).toBe(labels.indexOf(t.gAccount) + 1);
      expect(labels.at(-1)).toBe(t.gPreview);
    });

    it('is not shown to shop users', async () => {
      await render();
      expect(groups().map((g) => g.label)).not.toContain(
        TestBed.inject(I18nService).t().nav.gOwner,
      );
      toggle().click();
      fixture.detectChanges();
      expect(groups().map((g) => g.label)).not.toContain(
        TestBed.inject(I18nService).t().nav.gOwner,
      );
    });
  });

  describe('the errors badge', () => {
    const failed = (id: string) =>
      apiPost({
        id,
        scheduledAt: '2026-10-03T09:00:00Z',
        status: 'failed',
        failureCode: 'network',
      });

    it('counts the open error reports, in both menus', async () => {
      await render({ data: { errors: [failed('e1'), failed('e2'), failed('e3')] } });
      const errors = () =>
        groups()
          .flatMap((g) => g.links)
          .find((l) => l.path === '/app/errors')!;
      expect(errors().badge).toBe('3');
      toggle().click();
      fixture.detectChanges();
      expect(errors().badge).toBe('3');
    });

    it('shows no badge when nothing is open', async () => {
      await render();
      expect(el.querySelector('.side .count')).toBeNull();
    });
  });

  describe('the current page', () => {
    const on = () =>
      groups()
        .flatMap((g) => g.links)
        .filter((l) => l.on)
        .map((l) => l.path);

    it('is marked, and only it', async () => {
      await render({ url: '/app/targets' });
      expect(on()).toEqual(['/app/targets']);
    });

    it('keeps "collections" marked on the composer, which edits a post of a collection', async () => {
      await render({ url: '/app/composer?col=c1' });
      expect(on()).toEqual(['/app/collections']);
      toggle().click();
      fixture.detectChanges();
      expect(on()).toEqual(['/app/collections']);
    });

    it('marks the customers item on a customer page but the overview only on its own', async () => {
      await render({ url: '/app/admin/customers/c1', data: { user: { role: 'admin' } } });
      expect(on()).toEqual(['/app/admin/customers']);
      await TestBed.inject(Router).navigateByUrl('/app/admin');
      fixture.detectChanges();
      expect(on()).toEqual(['/app/admin']);
    });

    it('marks the link for assistive technology', async () => {
      await render({ url: '/app/overview' });
      const current = el.querySelectorAll('.side a.nav[aria-current="page"]');
      expect(current).toHaveLength(1);
      expect(current[0].getAttribute('href')).toBe('/app/overview');
    });
  });
});

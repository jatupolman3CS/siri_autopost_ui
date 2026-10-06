import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SettingsStore } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
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
    it('keeps the posting flow, the calendar and the errors, then the account', async () => {
      await render();
      const all = TestBed.inject(I18nService).t();
      const t = all.nav;
      expect(groups().map((g) => g.label)).toEqual([t.gWorkspace, t.gAccount]);
      expect(groups()[0].links.map((l) => [l.path, l.label])).toEqual([
        ['/app/overview', t.overview],
        ['/app/posts', all.api.postsNav],
        ['/app/collections', t.collections],
        ['/app/targets', t.targets],
        ['/app/schedules', t.schedules],
        ['/app/calendar', t.calendar],
        ['/app/errors', t.errors],
      ]);
      expect(paths(t.gAccount)).toEqual(['/app/billing', '/app/team']);
    });

    it('has no item for the composer (its editor is a panel of the post library) or the engine pages', async () => {
      await render();
      const all = groups().flatMap((g) => g.links.map((l) => l.path));
      for (const gone of [
        '/app/composer',
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
    it('has the groups workspace, engine and account (no extension preview, no extension settings page)', async () => {
      await render({ simple: false });
      const t = TestBed.inject(I18nService).t().nav;
      expect(groups().map((g) => g.label)).toEqual([t.gWorkspace, t.gEngine, t.gAccount]);
      expect(paths(t.gWorkspace)).toEqual([
        '/app/overview',
        '/app/posts',
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
      const all = groups().flatMap((g) => g.links.map((l) => l.path));
      expect(all).not.toContain('/app/extension');
      expect(all).not.toContain('/app/campaigns');
    });

    it('keeps the names the simple menu gave its items', async () => {
      await render();
      const simple = groups()
        .flatMap((g) => g.links)
        .map((l) => [l.path, l.label]);
      toggle().click();
      fixture.detectChanges();
      const full = groups()
        .flatMap((g) => g.links)
        .map((l) => [l.path, l.label]);
      for (const [path, label] of simple) expect(full).toContainEqual([path, label]);
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
        '/app/admin/payment-test',
      ]);
      toggle().click();
      fixture.detectChanges();
      expect(owner()).toBeDefined();
      // Right after the account group, and last.
      const labels = groups().map((g) => g.label);
      expect(labels.indexOf(t.gOwner)).toBe(labels.indexOf(t.gAccount) + 1);
      expect(labels.at(-1)).toBe(t.gOwner);
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

  describe('the extension status in the top bar', () => {
    const status = () => el.querySelector<HTMLElement>('.top .ext-status')!;
    const settings = () => TestBed.inject(SettingsStore);
    const dot = () => status().querySelector<HTMLElement>('.dot')!.style.background;

    it('says "not paired" and links to the team page while no browser is paired', async () => {
      await render();
      settings().devices.set(0);
      fixture.detectChanges();
      expect(status().textContent).toContain(TestBed.inject(I18nService).t().api.extUnpaired);
      expect(status().getAttribute('href')).toBe('/app/team');
    });

    it('is one dot and "online" / "offline" with a single extension', async () => {
      await render();
      const t = TestBed.inject(I18nService).t();
      settings().devices.set(1);
      settings().devicesOnline.set(1);
      settings().extensionOnline.set(true);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(t.top.extOnline);
      expect(dot()).toContain('--color-success');
      settings().devicesOnline.set(0);
      settings().extensionOnline.set(false);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(t.top.extOffline);
      expect(dot()).toContain('--color-danger');
    });

    it('counts the extensions that are online when there are several: all, some, none', async () => {
      await render();
      const t = TestBed.inject(I18nService).t();
      settings().devices.set(3);
      settings().devicesOnline.set(3);
      settings().extensionOnline.set(true);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(fmt(t.api.extCount, { n: 3, m: 3 }));
      expect(status().textContent).toContain('3/3');
      expect(dot()).toContain('--color-success');
      settings().devicesOnline.set(1);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(fmt(t.api.extCount, { n: 1, m: 3 }));
      expect(dot()).toContain('--color-warning');
      settings().devicesOnline.set(0);
      settings().extensionOnline.set(false);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(fmt(t.api.extCount, { n: 0, m: 3 }));
      expect(dot()).toContain('--color-danger');
    });

    it('reads as offline during a simulated outage, whatever the count', async () => {
      await render();
      const t = TestBed.inject(I18nService).t();
      settings().devices.set(2);
      settings().devicesOnline.set(2);
      settings().extensionOnline.set(false);
      settings().simulatedOffline.set(true);
      fixture.detectChanges();
      expect(status().textContent!.trim()).toBe(t.top.extOffline);
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

    it('marks the post library on its own page, not the collections', async () => {
      await render({ url: '/app/posts' });
      expect(on()).toEqual(['/app/posts']);
    });

    it('keeps the post library marked while its editor is open (a new post or one being edited)', async () => {
      await render({ url: '/app/posts?new=1&collection=c1' });
      expect(on()).toEqual(['/app/posts']);
      toggle().click();
      fixture.detectChanges();
      expect(on()).toEqual(['/app/posts']);
      await TestBed.inject(Router).navigateByUrl('/app/posts?post=p1');
      fixture.detectChanges();
      expect(on()).toEqual(['/app/posts']);
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

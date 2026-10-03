import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiDevice, ApiMedia, ApiSnippet } from '../core/http/api.service';
import { LibraryStore } from '../core/data/library.store';
import { SettingsStore } from '../core/data/settings.store';
import { WorkspaceStore } from '../core/data/workspace.store';
import { I18nService } from '../core/i18n/i18n.service';
import {
  WS,
  answerWorkspaceLoads,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../testing/api-testing';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { ExtensionPageComponent } from './extension/extension-page.component';
import { LibraryPageComponent } from './library/library-page.component';
import { OfflinePageComponent } from './offline/offline-page.component';
import { OverviewPageComponent } from './overview/overview-page.component';

const device = (over: Partial<ApiDevice> = {}): ApiDevice => ({
  id: 'd1',
  name: 'Shop PC',
  browser: 'Chrome 130',
  version: '2.2.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: null,
  online: true,
  accountId: 'acc-1',
  jobsPaused: false,
  ...over,
});

describe('pages that must not claim what the system does not do', () => {
  let http: HttpTestingController;

  async function open<T>(
    page: Type<T>,
    data: Parameters<typeof signIn>[1] = {},
    after?: () => void,
  ) {
    http = provideApiTesting({
      imports: [page],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http, data);
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, data);
    await settle();
    after?.();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear(); // a spec may have switched the language
  });

  describe('overview', () => {
    it('shows "—", not zeros or a 100% rate, until the posts have arrived', async () => {
      http = provideApiTesting({
        imports: [OverviewPageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const fixture = TestBed.createComponent(OverviewPageComponent);
      fixture.detectChanges();
      await settle();
      // The posts are still on their way.
      const values = () =>
        [...(fixture.nativeElement as HTMLElement).querySelectorAll('.kpi .value')].map(
          (n) => n.textContent,
        );
      expect(values()).toEqual(['—', '—', '—', '—']);
      answerWorkspaceLoads(http, {
        posts: [
          apiPost({
            id: 'p',
            status: 'success',
            scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
          }),
        ],
      });
      await settle();
      fixture.detectChanges();
      expect(values()).toEqual(['1', '0', '100%', '0']);
    });

    it('has no success rate to show when nothing was sent or failed', async () => {
      const { el } = await open(OverviewPageComponent);
      expect([...el.querySelectorAll('.kpi .value')].map((n) => n.textContent)[2]).toBe('—');
    });
  });

  describe('library', () => {
    const media: ApiMedia = {
      id: 'm1',
      name: 'cat.png',
      contentType: 'image/png',
      size: 1000,
      kind: 'image',
      usedCount: 3,
      createdAt: '2026-10-01T00:00:00Z',
    } as ApiMedia;
    const snippet: ApiSnippet = {
      id: 's1',
      title: 'Hello',
      text: 'Hi there',
      usedCount: 0,
    } as ApiSnippet;

    it('keeps the "used N times" line for media (the API counts it) and drops it for snippets (it does not)', async () => {
      const { fixture, el } = await open(LibraryPageComponent, {}, () => {
        const lib = TestBed.inject(LibraryStore);
        lib.media.set([{ id: 'm1', name: 'cat.png', meta: '', kind: 'image', used: 3 }]);
        lib.snippets.set([{ id: snippet.id, title: snippet.title, text: snippet.text, used: 0 }]);
      });
      const used = TestBed.inject(I18nService).t().lib.usedN.replace('{n}', '3');
      expect(el.querySelector('.grid .card')!.textContent).toContain(used);
      el.querySelectorAll<HTMLButtonElement>('.tabs button')[1].click();
      fixture.detectChanges();
      const card = el.querySelector('.snip')!;
      expect(card.textContent).toContain('Hello');
      expect(card.textContent).not.toMatch(/ใช้แล้ว|Used \d/);
      expect(media.id).toBe('m1');
    });

    it('shows no counts in the tabs before the library has arrived', async () => {
      http = provideApiTesting({
        imports: [LibraryPageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const fixture = TestBed.createComponent(LibraryPageComponent);
      fixture.detectChanges();
      await settle();
      const tabs = () =>
        [...(fixture.nativeElement as HTMLElement).querySelectorAll('.tabs button')].map(
          (b) => b.textContent!,
        );
      expect(tabs().join('')).not.toMatch(/\(\d+\)/);
      answerWorkspaceLoads(http);
      await settle();
      fixture.detectChanges();
      expect(tabs().join('')).toMatch(/\(0\)/);
    });
  });

  describe('offline handling', () => {
    it('offers "reconnect" only while a simulation runs, whatever the real presence is', async () => {
      const settings = () => TestBed.inject(SettingsStore);
      // Devices are paired and none is online (really offline), but no simulation is on.
      const { fixture, el } = await open(OfflinePageComponent, {}, () => {
        settings().extensionOnline.set(false);
        settings().simulatedOffline.set(false);
        settings().devices.set(1);
      });
      const t = TestBed.inject(I18nService).t();
      const button = () => el.querySelector<HTMLButtonElement>('.sim .su-btn')!;
      expect(button().textContent!.trim()).toBe(t.off.simOff);
      // With a simulation running, the button ends it.
      settings().simulatedOffline.set(true);
      fixture.detectChanges();
      expect(button().textContent!.trim()).toBe(t.off.simOn);
    });
  });

  describe('extension popup', () => {
    it('shows the version the browser reported and pauses the real jobs', async () => {
      const { fixture, el } = await open(ExtensionPageComponent, { devices: [device()] });
      expect(el.querySelector('.pop-foot')!.textContent).toContain('2.2.0');
      expect(el.querySelector('.pop-foot')!.textContent).not.toContain('2.4.1');
      el.querySelector<HTMLButtonElement>('.pop-actions button')!.click();
      const req = http.expectOne({ method: 'PUT', url: `/api/workspaces/${WS}/devices/d1` });
      expect(req.request.body).toEqual({ name: null, jobsPaused: true });
      req.flush(device({ jobsPaused: true }));
      await settle();
      fixture.detectChanges();
      expect(TestBed.inject(WorkspaceStore).id()).toBe(WS);
    });

    it('is off for someone who may not pause devices', async () => {
      const { el } = await open(ExtensionPageComponent, {
        devices: [device()],
        workspace: { role: 'editor' },
      });
      expect(el.querySelector<HTMLButtonElement>('.pop-actions button')!.disabled).toBe(true);
    });
  });

  describe('labels in the dictionary', () => {
    it('names the calendar arrows and the dialog close button in the page language', async () => {
      const { fixture, el } = await open(CalendarPageComponent);
      const t = TestBed.inject(I18nService).t();
      const arrows = [...el.querySelectorAll('.nav-btn')].map((b) => b.getAttribute('aria-label'));
      expect(arrows).toEqual([t.api.prevMonth, t.api.nextMonth]);
      TestBed.inject(I18nService).setLang('en');
      fixture.detectChanges();
      expect([...el.querySelectorAll('.nav-btn')].map((b) => b.getAttribute('aria-label'))).toEqual(
        ['Previous month', 'Next month'],
      );
    });
  });
});

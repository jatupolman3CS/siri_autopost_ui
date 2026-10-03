import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../core/auth/token';
import { ApiRole } from '../core/http/api.service';
import { WorkspaceStore } from '../core/data/workspace.store';
import {
  answerWorkspaceLoads,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../testing/api-testing';
import { AntibanPageComponent } from './antiban/antiban-page.component';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { ErrorsPageComponent } from './errors/errors-page.component';
import { LibraryPageComponent } from './library/library-page.component';
import { OfflinePageComponent } from './offline/offline-page.component';

// A control that the API would answer with 403 must not be clickable: each page against the roles the API
// uses (Editor: posts, library; Admin: engine settings, simulation) and against assist mode.
describe('role gating of the pages', () => {
  let http: HttpTestingController;

  async function render<T>(
    page: Type<T>,
    role: ApiRole,
    data: Parameters<typeof signIn>[1] = {},
    assist = false,
  ): Promise<{ fixture: ComponentFixture<T>; el: HTMLElement }> {
    http = provideApiTesting({
      imports: [page],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    if (assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    await signIn(http, { ...data, workspace: { ...data.workspace, role } });
    // The page's own stores start loading when it is created.
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, data);
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const off = (el: HTMLElement, selector: string) =>
    [...el.querySelectorAll<HTMLButtonElement>(selector)].map((b) => b.disabled);

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  describe('error reports', () => {
    const failed = apiPost({
      id: 'e1',
      status: 'failed',
      failureCode: 'session',
      scheduledAt: new Date(Date.now() - 600_000).toISOString(),
    });

    it.each([
      ['viewer', true],
      ['editor', false],
      ['admin', false],
    ] as const)('%s: retry, sign in and skip off = %s', async (role, disabled) => {
      const { el } = await render(ErrorsPageComponent, role, { errors: [failed] });
      expect(off(el, '.btns button')).toEqual([disabled, disabled, disabled]);
    });

    it('is read-only in assist mode', async () => {
      const { el } = await render(ErrorsPageComponent, 'owner', { errors: [failed] }, true);
      expect(off(el, '.btns button')).toEqual([true, true, true]);
      expect(el.querySelector('.perm-note')).not.toBeNull();
    });

    it('shows what the extension reported instead of the generic reason', async () => {
      const { el } = await render(ErrorsPageComponent, 'editor', {
        errors: [{ ...failed, failureDetail: 'ไม่พบลิงก์ของกลุ่ม "ขายของ" ในส่วนขยาย' }],
      });
      const text = el.textContent!;
      expect(text).toContain('ไม่พบลิงก์ของกลุ่ม "ขายของ" ในส่วนขยาย');
      expect(text).not.toContain('TikTok');
    });
  });

  describe('library', () => {
    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)('%s: upload and new snippet off = %s', async (role, disabled) => {
      const { el } = await render(LibraryPageComponent, role);
      expect(off(el, '.actions button')).toEqual([disabled, disabled]);
    });

    it('is read-only in assist mode', async () => {
      const { el } = await render(LibraryPageComponent, 'owner', {}, true);
      expect(off(el, '.actions button')).toEqual([true, true]);
    });
  });

  describe('calendar', () => {
    const queued = apiPost({
      id: 'q1',
      status: 'queued',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)('%s: edit and delete off = %s', async (role, disabled) => {
      const { fixture, el } = await render(CalendarPageComponent, role, { posts: [queued] });
      fixture.componentRef.setInput('day', new Date(queued.scheduledAt).toLocaleDateString('sv'));
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(off(el, '.day-row .btns button')).toEqual([disabled, disabled]);
    });
  });

  describe('account safety', () => {
    it('lets only an admin save, and never offers the settings the extension ignores', async () => {
      const editor = await render(AntibanPageComponent, 'editor');
      expect(editor.el.querySelector<HTMLButtonElement>('.page-head button')!.disabled).toBe(true);
      expect(off(editor.el, 'input[type=range], input[type=number]').every(Boolean)).toBe(true);
      http.verify();
      TestBed.resetTestingModule();

      const admin = await render(AntibanPageComponent, 'admin');
      expect(admin.el.querySelector<HTMLButtonElement>('.page-head button')!.disabled).toBe(false);
      expect(off(admin.el, 'input[type=range], input[type=number]').some(Boolean)).toBe(false);
      // Typing and scrolling are honoured; shuffle, auto-pause and warm-up only look stored.
      const boxes = [...admin.el.querySelectorAll<HTMLInputElement>('.human input[type=checkbox]')];
      expect(boxes.map((b) => b.disabled)).toEqual([false, false, true, true, true]);
      expect(admin.el.querySelectorAll('.not-yet').length).toBe(3);
    });

    it('also locks typing and scrolling when the owner plan has no advanced anti-ban', async () => {
      const { el } = await render(AntibanPageComponent, 'admin', {
        workspace: { advancedAntiBan: false },
      });
      const boxes = [...el.querySelectorAll<HTMLInputElement>('.human input[type=checkbox]')];
      expect(boxes.every((b) => b.disabled)).toBe(true);
      expect(el.querySelector('.lock')).not.toBeNull();
    });

    it('decides "locked" by the workspace owner plan, not the signed-in user plan', async () => {
      // The signed-in user is on Free, but the workspace owner's plan has advanced anti-ban.
      const { el } = await render(AntibanPageComponent, 'admin', {
        user: { plan: 'free' },
        workspace: { advancedAntiBan: true },
      });
      expect(el.querySelector('.lock')).toBeNull();
    });
  });

  describe('offline handling', () => {
    it('lets only an admin save and simulate, and never offers reminders', async () => {
      const editor = await render(OfflinePageComponent, 'editor');
      expect(editor.el.querySelector<HTMLButtonElement>('.page-head button')!.disabled).toBe(true);
      expect(off(editor.el, '.sim .su-btn')).toEqual([true]);
      http.verify();
      TestBed.resetTestingModule();

      const admin = await render(OfflinePageComponent, 'admin');
      expect(admin.el.querySelector<HTMLButtonElement>('.page-head button')!.disabled).toBe(false);
      expect(off(admin.el, '.sim .su-btn')).toEqual([false]);
      // Skip and queue can be picked; "notify" is shown but cannot.
      expect(off(admin.el, '.cards .pc')).toEqual([false, false, true]);
      // LINE, email and push send nothing.
      expect(off(admin.el, '.stack input[type=checkbox]')).toEqual([true, true, true]);
    });
  });
});

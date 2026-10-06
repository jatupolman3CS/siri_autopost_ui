import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { ApiDevice, ApiMember, ApiRole } from '../../core/http/api.service';
import { DevicesStore } from '../../core/data/devices.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  WS,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { TeamPageComponent } from './team-page.component';

const member = (over: Partial<ApiMember>): ApiMember => ({
  id: 'm-1',
  userId: 'u-2',
  email: 'ann@shop.co',
  name: 'ann',
  role: 'editor',
  active: true,
  lastSeenAt: null,
  you: false,
  ...over,
});
const OWNER = member({ id: null, userId: 'u-1', email: 'owner@shop.co', role: 'owner', you: true });
const device = (id: string): ApiDevice => ({
  id,
  name: 'PC ' + id,
  browser: 'Chrome',
  version: '2.2.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: null,
  online: false,
  accountId: null,
  jobsPaused: false,
});

describe('TeamPageComponent', () => {
  let http: HttpTestingController;

  async function open(
    role: ApiRole,
    opts: {
      members?: ApiMember[];
      devices?: ApiDevice[];
      limits?: { seats: number | null; devices: number | null };
      assist?: boolean;
      /** Opened with ?pair=1. */
      pair?: boolean;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [TeamPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
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
      workspace: {
        role,
        limits: {
          accounts: null,
          posts: null,
          groups: null,
          images: null,
          libraryPosts: null,
          ...(opts.limits ?? { seats: 3, devices: 3 }),
        },
      },
    });
    const fixture = TestBed.createComponent(TeamPageComponent);
    if (opts.pair) fixture.componentRef.setInput('pair', '1');
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, { devices: opts.devices });
    http.expectOne(`/api/workspaces/${WS}/members`).flush(opts.members ?? [OWNER]);
    await settle();
    fixture.detectChanges();
    if (opts.pair) await settle();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const head = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('.page-head .actions button')].map(
      (b) => b.disabled,
    );
  const addDevice = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.head-row .su-btn')!;

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('takes the seat and device limits from the workspace (the owner plan), not the signed-in plan', async () => {
    // The caller's own plan is Free (one seat, one device), but the owner's workspace has more room.
    const { el } = await open('admin', {
      members: [OWNER, member({})],
      devices: [device('d1')],
      limits: { seats: 3, devices: 3 },
    });
    expect(head(el)).toEqual([false, false]); // new workspace, invite
    expect(addDevice(el).disabled).toBe(false);
    expect(el.textContent).toContain('3');
  });

  it('opens the pairing dialog at once when it is opened with ?pair=1 (and an admin has room)', async () => {
    const { fixture, el } = await open('owner', { devices: [], pair: true });
    fixture.detectChanges();
    http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/devices/pairing` }).flush({
      code: 'ABCD-EFGH',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    await settle();
    fixture.detectChanges();
    expect(
      el.querySelector('app-pair-device-modal .su-modal, app-pair-device-modal [role=dialog]'),
    ).not.toBeNull();
  });

  it('does not open the pairing dialog for a role that cannot pair, ?pair=1 or not', async () => {
    const { el } = await open('editor', { devices: [], pair: true });
    expect(
      el.querySelector('app-pair-device-modal .su-modal, app-pair-device-modal [role=dialog]'),
    ).toBeNull();
  });

  it('turns invite off when the seats are taken, and add device off when the devices are', async () => {
    const { el } = await open('owner', {
      members: [OWNER, member({}), member({ id: 'm-2', email: 'bo@shop.co', active: false })],
      devices: [device('d1')],
      limits: { seats: 3, devices: 1 },
    });
    expect(head(el)).toEqual([false, true]);
    expect(addDevice(el).disabled).toBe(true);
    expect(el.textContent).toMatch(/seats are taken|ที่นั่งเต็มแล้ว/);
  });

  it('turns every admin control off for an editor', async () => {
    const { el } = await open('editor', { members: [OWNER, member({})], devices: [device('d1')] });
    expect(head(el)[1]).toBe(true); // invite
    expect(addDevice(el).disabled).toBe(true);
    expect(el.querySelector('select.role-sel')).toBeNull();
    // No rename, pause or unbind buttons are offered at all.
    expect(el.querySelectorAll('.dev-actions button').length).toBe(0);
  });

  it('is read-only in assist mode: no new workspace, no invite, no new device, no role change', async () => {
    const { el } = await open('owner', {
      members: [OWNER, member({})],
      devices: [device('d1')],
      assist: true,
    });
    expect(head(el)).toEqual([true, true]);
    expect(addDevice(el).disabled).toBe(true);
    expect(el.querySelector('select.role-sel')).toBeNull();
    expect(el.querySelectorAll('.dev-actions button').length).toBe(0);
  });

  describe('automatic pause of a browser', () => {
    const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
    const lines = (el: HTMLElement) =>
      [...el.querySelectorAll('.dev .auto')].map((x) => x.textContent!.trim());

    it('says until when and why the engine paused a browser itself', async () => {
      const { el } = await open('admin', {
        devices: [
          {
            ...device('d1'),
            autoPausedUntil: inHours(0.5),
            autoPauseReason: 'Facebook เตือนว่าโพสต์ถี่เกินไป',
          },
          device('d2'),
        ],
      });
      const rows = [...el.querySelectorAll('.dev')];
      expect(rows).toHaveLength(2);
      expect(lines(el)).toHaveLength(1);
      expect(rows[0].querySelector('.auto')!.textContent).toContain(
        'Facebook เตือนว่าโพสต์ถี่เกินไป',
      );
      expect(rows[0].querySelector('.auto')!.textContent).toMatch(/พักอัตโนมัติถึง \d\d:\d\d: /);
      expect(rows[1].querySelector('.auto')).toBeNull();
    });

    it('shows the date when the pause lasts into another day, and nothing for one that has run out', async () => {
      const { el } = await open('admin', {
        devices: [
          { ...device('d1'), autoPausedUntil: inHours(40), autoPauseReason: 'บล็อก' },
          { ...device('d2'), autoPausedUntil: inHours(-1), autoPauseReason: 'หมดเวลาแล้ว' },
        ],
      });
      expect(lines(el)).toHaveLength(1);
      expect(lines(el)[0]).toMatch(/พักอัตโนมัติถึง .+ \d\d:\d\d: บล็อก/);
      expect(el.textContent).not.toContain('หมดเวลาแล้ว');
    });

    it('does not change what a person who paused the browser by hand sees', async () => {
      const { el } = await open('admin', { devices: [{ ...device('d1'), jobsPaused: true }] });
      expect(lines(el)).toEqual([]);
      expect(el.querySelector('.dev')!.textContent).toContain('พักรับงาน');
    });
  });

  it('puts the role select back when the API refuses the change', async () => {
    const { fixture, el } = await open('owner', { members: [OWNER, member({ role: 'editor' })] });
    const select = el.querySelector<HTMLSelectElement>('select.role-sel')!;
    expect(select.value).toBe('editor');
    select.value = 'admin';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne({ method: 'PUT', url: `/api/workspaces/${WS}/members/m-1` })
      .flush({ title: 'ทำไม่ได้' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    fixture.detectChanges();
    expect(select.value).toBe('editor');
  });

  it('creates a workspace once even when the button is pressed twice', async () => {
    const { fixture, el } = await open('owner');
    el.querySelectorAll<HTMLButtonElement>('.page-head .actions button')[0].click();
    fixture.detectChanges();
    const input = document.querySelector<HTMLInputElement>('.su-modal-body input')!;
    expect(input.getAttribute('maxlength')).toBe('120');
    input.value = 'ลูกค้า A';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const create = document.querySelector<HTMLButtonElement>('.su-modal-foot .su-btn-primary')!;
    create.click();
    fixture.detectChanges();
    expect(create.disabled).toBe(true);
    create.click();
    const post = http.expectOne({ method: 'POST', url: '/api/workspaces' });
    expect(post.request.body).toEqual({ name: 'ลูกค้า A' });
    post.flush({ ...TestBed.inject(WorkspaceStore).current()!, id: 'ws-2', name: 'ลูกค้า A' });
    await settle();
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
  });

  it('renames a device in a dialog that stops at 80 characters, and says names must be unique', async () => {
    const { fixture, el } = await open('admin', { devices: [device('d1')] });
    el.querySelector<HTMLButtonElement>('.dev-actions button:nth-of-type(1)')!.click();
    fixture.detectChanges();
    const input = document.querySelector<HTMLInputElement>('.su-modal-body input')!;
    expect(input.value).toBe('PC d1');
    expect(input.getAttribute('maxlength')).toBe('80');
    expect(document.querySelector('.su-modal-body')!.textContent).toContain(
      TestBed.inject(I18nService).t().api.engine.renameHint,
    );
  });

  it('has no "campaigns" button on a device any more, only rename, pause and unbind', async () => {
    const { el } = await open('admin', { devices: [device('d1')] });
    expect(el.querySelector('a[href="/app/campaigns"]')).toBeNull();
    expect(el.querySelectorAll('.dev-actions a')).toHaveLength(0);
    expect(el.querySelectorAll('.dev-actions button')).toHaveLength(3);
    expect(el.textContent).not.toContain('ชุดโพสต์ในส่วนขยาย');
  });

  describe('renaming to a name another extension has', () => {
    const rename = (fixture: { detectChanges(): void }, el: HTMLElement, name: string) => {
      el.querySelector<HTMLButtonElement>('.dev-actions button:nth-of-type(1)')!.click();
      fixture.detectChanges();
      const input = document.querySelector<HTMLInputElement>('.su-modal-body input')!;
      input.value = name;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      document.querySelector<HTMLButtonElement>('.su-modal-foot .su-btn-primary')!.click();
    };
    const url = `/api/workspaces/${WS}/devices/d1`;

    it("shows the server's refusal under the field, keeps the dialog open and the old name", async () => {
      const { fixture, el } = await open('admin', { devices: [device('d1'), device('d2')] });
      rename(fixture, el, 'PC d2');
      await settle();
      const put = http.expectOne({ method: 'PUT', url });
      expect(put.request.body).toEqual({ name: 'PC d2', jobsPaused: null });
      put.flush(
        { title: 'มีส่วนขยายชื่อ “PC d2” อยู่แล้วในเวิร์กสเปซนี้', status: 422 },
        { status: 422, statusText: 'Unprocessable' },
      );
      await settle();
      fixture.detectChanges();
      const err = document.querySelector('.su-modal-body .su-field-err');
      expect(err!.textContent).toBe('มีส่วนขยายชื่อ “PC d2” อยู่แล้วในเวิร์กสเปซนี้');
      // The dialog is still open, the name on the page is the old one and nothing was toasted.
      expect(document.querySelector('.su-modal-body input')).not.toBeNull();
      expect(el.textContent).toContain('PC d1');
      expect(el.querySelectorAll('.dev')[0].textContent).not.toContain('PC d2 ');
      expect(
        TestBed.inject(DevicesStore)
          .list()
          .find((d) => d.id === 'd1')!.name,
      ).toBe('PC d1');
      expect(TestBed.inject(NotificationService).toasts()).toEqual([]);
      // The save button is usable again (another name can be tried).
      expect(
        document.querySelector<HTMLButtonElement>('.su-modal-foot .su-btn-primary')!.disabled,
      ).toBe(false);
    });

    it('closes and says the new name when the server accepts it', async () => {
      const { fixture, el } = await open('admin', { devices: [device('d1'), device('d2')] });
      rename(fixture, el, 'Shop laptop');
      await settle();
      http.expectOne({ method: 'PUT', url }).flush({ ...device('d1'), name: 'Shop laptop' });
      // The account follows the device: the lists are read again.
      await settle();
      http.match((r) => r.method === 'GET');
      fixture.detectChanges();
      expect(document.querySelector('.su-modal-body input')).toBeNull();
      expect(el.querySelectorAll('.dev')[0].textContent).toContain('Shop laptop');
      expect(
        TestBed.inject(NotificationService)
          .toasts()
          .map((x) => x.message),
      ).toContain(fmt(TestBed.inject(I18nService).t().api.renamed, { d: 'Shop laptop' }));
    });

    it('does not send a name that is empty or unchanged', async () => {
      const { fixture, el } = await open('admin', { devices: [device('d1')] });
      rename(fixture, el, '   ');
      await settle();
      fixture.detectChanges();
      http.expectNone({ method: 'PUT', url });
      expect(document.querySelector('.su-modal-body .su-field-err')!.textContent).toBe(
        TestBed.inject(I18nService).t().api.renameEmpty,
      );
    });
  });

  describe('several extensions', () => {
    const badge = (el: HTMLElement) => el.querySelector('[data-testid=devices-online]');

    it('counts how many are online beside the title of the devices', async () => {
      const { el } = await open('admin', {
        devices: [
          { ...device('d1'), online: true },
          { ...device('d2'), online: false },
          { ...device('d3'), online: true },
        ],
        limits: { seats: 3, devices: 5 },
      });
      expect(badge(el)!.textContent!.trim()).toBe(
        fmt(TestBed.inject(I18nService).t().api.extCount, { n: 2, m: 3 }),
      );
    });

    it('shows no count for a single extension', async () => {
      const { el } = await open('admin', { devices: [device('d1')] });
      expect(badge(el)).toBeNull();
    });

    it('lists each extension by its own name', async () => {
      const { el } = await open('admin', {
        devices: [device('d1'), device('d2')],
        limits: { seats: 3, devices: 5 },
      });
      expect([...el.querySelectorAll('.dev .fs14')].map((n) => n.textContent!.trim())).toEqual([
        'PC d1',
        'PC d2',
      ]);
    });
  });
});

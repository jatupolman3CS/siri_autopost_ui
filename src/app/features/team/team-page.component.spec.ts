import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { ApiDevice, ApiMember, ApiRole } from '../../core/http/api.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
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
        limits: { accounts: null, posts: null, ...(opts.limits ?? { seats: 3, devices: 3 }) },
      },
    });
    const fixture = TestBed.createComponent(TeamPageComponent);
    fixture.detectChanges();
    await settle();
    answerWorkspaceLoads(http, { devices: opts.devices });
    http.expectOne(`/api/workspaces/${WS}/members`).flush(opts.members ?? [OWNER]);
    await settle();
    fixture.detectChanges();
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

  it('renames a device in a dialog that stops at 80 characters', async () => {
    const { fixture, el } = await open('admin', { devices: [device('d1')] });
    el.querySelector<HTMLButtonElement>('.dev-actions button:nth-of-type(1)')!.click();
    fixture.detectChanges();
    const input = document.querySelector<HTMLInputElement>('.su-modal-body input')!;
    expect(input.value).toBe('PC d1');
    expect(input.getAttribute('maxlength')).toBe('80');
  });
});

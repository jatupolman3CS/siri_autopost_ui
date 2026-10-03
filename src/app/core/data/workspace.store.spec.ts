import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { SessionStore } from './session.store';
import { WorkspaceStore } from './workspace.store';

describe('WorkspaceStore', () => {
  let http: HttpTestingController;
  let ws: WorkspaceStore;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    http = provideApiTesting();
    ws = TestBed.inject(WorkspaceStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('carries the owner limits and the anti-ban flag of every workspace', async () => {
    await signIn(http, {
      workspace: {
        limits: { accounts: 2, posts: 50, devices: null, seats: 1 },
        advancedAntiBan: false,
      },
    });
    expect(ws.loaded()).toBe(true);
    expect(ws.current()?.limits).toEqual({ accounts: 2, posts: 50, devices: null, seats: 1 });
    expect(ws.current()?.advancedAntiBan).toBe(false);
  });

  it('reads the list again when the plan changes, without emptying the stores', async () => {
    await signIn(http, { workspace: { limits: { accounts: 1, posts: 10, devices: 1, seats: 1 } } });
    const session = TestBed.inject(SessionStore);
    const before = ws.id();
    const change = session.setPlan('pro');
    http
      .expectOne('/api/billing/plan')
      .flush({ user: { ...session.user()!, plan: 'agency' }, checkoutUrl: null });
    await change;
    await settle();
    expect(ws.id()).toBe(before); // no reset
    http
      .expectOne('/api/workspaces')
      .flush([
        { ...WORKSPACE, limits: { accounts: null, posts: null, devices: null, seats: null } },
      ]);
    await settle();
    expect(ws.current()?.limits.seats).toBeNull();
  });

  it('retries a list that could not be read, then reports it loaded', async () => {
    const login = TestBed.inject(SessionStore).logIn('a@b.co', 'password1');
    http.expectOne('/api/auth/login').flush({
      token: 't',
      expiresAt: '2099-01-01',
      user: {
        id: 'u-1',
        email: 'a@b.co',
        name: 'a',
        role: 'user',
        plan: 'free',
        cycle: 'month',
        status: 'active',
      },
    });
    await login;
    await settle();
    http.expectOne('/api/workspaces').flush(null, { status: 503, statusText: 'x' });
    await settle();
    expect(ws.loaded()).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    http.expectOne('/api/workspaces').flush([WORKSPACE]);
    await settle();
    expect(ws.loaded()).toBe(true);
    expect(ws.id()).toBe(WORKSPACE.id);
    // The other stores' loads for the workspace are not part of this spec.
    for (const r of http.match((r) => r.url.startsWith(`/api/workspaces/${WORKSPACE.id}/`)))
      r.flush([]);
  });

  it('is empty again after signing out', async () => {
    await signIn(http);
    TestBed.inject(SessionStore).signOut();
    await settle();
    expect(ws.list()).toEqual([]);
    expect(ws.loaded()).toBe(false);
    expect(ws.id()).toBeNull();
  });
});

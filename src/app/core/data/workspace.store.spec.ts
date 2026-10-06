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
    const limits = {
      accounts: 2,
      posts: 50,
      devices: null,
      seats: 1,
      groups: 50,
      images: 200,
      libraryPosts: 200,
    };
    await signIn(http, { workspace: { limits, advancedAntiBan: false } });
    expect(ws.loaded()).toBe(true);
    expect(ws.current()?.limits).toEqual(limits);
    expect(ws.current()?.advancedAntiBan).toBe(false);
  });

  it('carries the AI and bump flags of the owner plan next to the others', async () => {
    await signIn(http, {
      workspace: { ai: true, bump: false, clientReports: false, notifications: true },
    });
    expect(ws.current()).toMatchObject({
      ai: true,
      bump: false,
      clientReports: false,
      notifications: true,
    });
  });

  describe('locks of the functions the owner plan lacks', () => {
    it('lock only once the workspaces have arrived, so a banner does not flash on a reload', async () => {
      expect(ws.aiLocked()).toBe(false);
      expect(ws.bumpLocked()).toBe(false);
      await signIn(http, { workspace: { ai: false, bump: false } });
      expect(ws.aiLocked()).toBe(true);
      expect(ws.bumpLocked()).toBe(true);
    });

    it('open for a plan that has them', async () => {
      await signIn(http, { workspace: { ai: true, bump: true } });
      expect(ws.aiLocked()).toBe(false);
      expect(ws.bumpLocked()).toBe(false);
    });

    it('follow the owner plan, not the signed-in member: a Pro owner has AI but not bumping', async () => {
      await signIn(http, { workspace: { role: 'editor' } }); // the helper's owner is on Pro
      expect(ws.aiLocked()).toBe(false);
      expect(ws.bumpLocked()).toBe(true);
    });
  });

  it('reads the list again when the plan changes, without emptying the stores', async () => {
    await signIn(http, { workspace: { limits: { ...WORKSPACE.limits, accounts: 1, posts: 10 } } });
    const session = TestBed.inject(SessionStore);
    const before = ws.id();
    const change = session.setPlan('pro');
    http
      .expectOne('/api/billing/plan')
      .flush({ user: { ...session.user()!, plan: 'agency' }, checkoutUrl: null });
    await change;
    await settle();
    expect(ws.id()).toBe(before); // no reset
    http.expectOne('/api/workspaces').flush([
      {
        ...WORKSPACE,
        limits: {
          accounts: null,
          posts: null,
          devices: null,
          seats: null,
          groups: null,
          images: null,
          libraryPosts: null,
        },
      },
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

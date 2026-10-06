import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiCustomer, ApiHealth, ApiTransaction } from '../http/api.service';
import { USER, provideApiTesting, settle } from '../../testing/api-testing';
import { AdminStore, bangkokParts } from './admin.store';
import { SessionStore } from './session.store';
import { promoStatus } from '../../features/admin/plans-page.component';

/** No override of any of the seven numbers: the plan's values apply. */
const NO_OVERRIDES = {
  accounts: null,
  posts: null,
  devices: null,
  seats: null,
  groups: null,
  images: null,
  libraryPosts: null,
};

const customer = (over: Partial<ApiCustomer> = {}): ApiCustomer => ({
  id: 'c1',
  name: 'Mali',
  email: 'mali@shop.co',
  plan: 'pro',
  status: 'active',
  since: '2026-01-05T00:00:00Z',
  cycle: 'month',
  accounts: 2,
  seats: 1,
  ext: '',
  lastActiveAt: null,
  paused: false,
  jobs: { ok: 3, failed: 1, queued: 2, running: 0 },
  devices: [],
  note: null,
  workspaces: 1,
  limits: NO_OVERRIDES,
  hasSubscription: false,
  renewsAt: null,
  cancelAtPeriodEnd: false,
  ...over,
});

const tx = (over: Partial<ApiTransaction> = {}): ApiTransaction => ({
  id: 't1',
  userId: 'c1',
  type: 'charge',
  amount: 790,
  plan: 'pro',
  cycle: 'month',
  promoCode: null,
  createdAt: '2026-09-01T03:00:00Z',
  receiptUrl: null,
  refundable: true,
  refundOfId: null,
  ...over,
});

const HEALTH: ApiHealth = {
  mrr: 790,
  mrrPrev: 0,
  churn: 0,
  churnPrev: 0,
  devicesActive: 1,
  devices: 2,
  successRate: 95,
  successRatePrev: null,
  apiP95Ms: 40,
  apiSamples: 10,
  dbMs: 1,
  queueDue: 0,
  queueNext24h: 3,
  latestExtension: '2.5.0',
  onLatestExtension: 1,
  errorRate24h: null,
  paymentsConnected: false,
  eventStreams: 0,
  deviceWaits: 0,
  eventsPublished: 0,
  eventsDropped: 0,
};

const SUMMARY = {
  basic: 0,
  pro: 1,
  agency: 0,
  revenue: [{ year: 2026, month: 9, amount: 790 }],
};
const PLANS = [
  {
    key: 'pro',
    price: 790,
    accounts: 10,
    posts: null,
    devices: 3,
    seats: 1,
    groups: 300,
    images: 1000,
    libraryPosts: 1000,
    features: ['advanced_anti_ban', 'notifications', 'auto_reply', 'ai', 'someday'],
  },
];

describe('AdminStore', () => {
  let http: HttpTestingController;
  let admin: AdminStore;

  /**
   * Answers every request the store has pending, by path: `replies` first, then what a refresh normally gets.
   * Returns the paths it served, so a test can say which requests an action sent.
   */
  function serve(replies: Record<string, object> = {}): string[] {
    const defaults: Record<string, object> = {
      '/api/admin/customers': [customer()],
      '/api/admin/promos': [],
      '/api/admin/jobs': [],
      '/api/admin/health': HEALTH,
      '/api/admin/audit': [],
      '/api/admin/summary': SUMMARY,
      '/api/admin/transactions': [tx()],
      '/api/plans': PLANS,
    };
    return http
      .match(() => true)
      .map((r) => {
        const path = r.request.url;
        r.flush(path in replies ? replies[path] : defaults[path]);
        return path + (r.request.params.get('customerId') ? '?c' : '');
      });
  }

  /**
   * Answers the requests an action sends, one wave after another, until the action has finished.
   * Resolves to what the action returned and the paths it asked for.
   */
  async function finish<T>(
    action: Promise<T>,
    replies: Record<string, object> = {},
  ): Promise<{ value: T; served: string[] }> {
    let done = false;
    const result = action.finally(() => (done = true));
    const served: string[] = [];
    while (!done) {
      served.push(...serve(replies));
      await settle();
    }
    return { value: await result, served };
  }

  async function load(customers: ApiCustomer[], transactions: ApiTransaction[] = [tx()]) {
    const done = admin.load();
    serve({ '/api/admin/customers': customers, '/api/admin/transactions': transactions });
    await done;
  }

  beforeEach(() => {
    http = provideApiTesting();
    admin = TestBed.inject(AdminStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('maps customers, money and the revenue months', async () => {
    await load([customer({ status: 'past_due', lastActiveAt: '2026-10-01T00:00:00Z' })]);
    const c = admin.customer('c1')!;
    expect(c.status).toBe('pastdue');
    expect(c.lastActive).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(admin.subs().pro).toBe(1);
    expect(admin.revenue()).toEqual([[2026, 8, 790]]);
    expect(admin.transactions()[0]).toMatchObject({ id: 't1', cust: 'c1', amount: 790 });
    expect(admin.loaded()).toBe(true);
    expect(admin.health()?.latestExtension).toBe('2.5.0');
  });

  it('counts money days and months on the Bangkok calendar, not the browser one', async () => {
    // 18:30 UTC on 30 Sep is 01:30 on 1 Oct in Bangkok.
    await load(
      [customer({ since: '2025-12-31T18:00:00Z' })],
      [tx({ createdAt: '2026-09-30T18:30:00Z' })],
    );
    expect(admin.transactions()[0].date).toEqual([2026, 9, 1]);
    expect(admin.customer('c1')!.since).toEqual([2026, 0]);
    expect(bangkokParts('2026-10-31T16:59:00Z')).toEqual([2026, 9, 31]);
    expect(bangkokParts('2026-10-31T17:00:00Z')).toEqual([2026, 10, 1]);
  });

  it('empties itself when someone else signs in, and drops an answer meant for the one before', async () => {
    await load([customer()]);
    const session = TestBed.inject(SessionStore);
    const login = session.logIn('admin@autopost.local', 'admin1234');
    http.expectOne('/api/auth/login').flush({
      token: 't',
      expiresAt: '2099-01-01',
      user: { ...USER, id: 'admin-1', role: 'admin' },
    });
    await login;
    await settle();
    expect(admin.customers()).toEqual([]);
    expect(admin.loaded()).toBe(false);
    expect(admin.health()).toBeNull();

    // A load that was in flight for the previous user must not fill the new user's pages.
    const stale = admin.load();
    const pending = http.match(() => true);
    session.signOut();
    await settle();
    for (const r of pending) r.flush(r.request.url === '/api/admin/customers' ? [customer()] : []);
    await stale;
    expect(admin.customers()).toEqual([]);
  });

  it('never throws when the server is down: it retries, and says it is not loaded', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const done = admin.load();
    for (const r of http.match(() => true)) r.flush(null, { status: 503, statusText: 'x' });
    await vi.advanceTimersByTimeAsync(2500);
    // The second attempt succeeds.
    serve();
    await done;
    expect(admin.loaded()).toBe(true);
  });

  it('loads a customer activity log', async () => {
    const done = admin.loadAudit('c1');
    const req = http.expectOne((r) => r.url === '/api/admin/audit');
    expect(req.request.params.get('customerId')).toBe('c1');
    req.flush([
      {
        id: 'a1',
        at: '2026-10-03T03:00:00Z',
        action: 'impersonated',
        actorId: 'admin',
        actorEmail: 'admin@autopost.local',
        customerId: 'c1',
        customerEmail: 'mali@shop.co',
        from: null,
        to: null,
      },
    ]);
    await done;
    expect(admin.audit()['c1'][0].action).toBe('impersonated');
  });

  it('suspends a customer, then re-reads the health, the money and the activity log', async () => {
    await load([customer()]);
    const done = admin.apply('c1', 'suspend', undefined, ' late payment ');
    http.expectOne('/api/admin/customers/c1/note').flush(customer({ note: 'late payment' }));
    await settle();
    const req = http.expectOne('/api/admin/customers/c1/status');
    expect(req.request.body).toEqual({ status: 'suspended' });
    req.flush(customer({ status: 'suspended', paused: true, note: 'late payment' }));
    // Suspending moves the MRR: the overview must not keep the old figure.
    const { served } = await finish(done, { '/api/admin/health': { ...HEALTH, mrr: 0 } });
    expect(served.sort()).toEqual(
      [
        '/api/admin/audit?c',
        '/api/admin/health',
        '/api/admin/summary',
        '/api/admin/transactions',
      ].sort(),
    );
    expect(admin.health()?.mrr).toBe(0);
    expect(admin.customer('c1')).toMatchObject({
      status: 'suspended',
      paused: true,
      note: 'late payment',
    });
  });

  it('refunds the given transaction, then re-reads the money, the health and the activity log', async () => {
    await load([customer()]);
    const done = admin.apply('c1', 'refund', 't1');
    http
      .expectOne('/api/admin/transactions/t1/refund')
      .flush(tx({ id: 't2', type: 'refund', amount: 790 }));
    const { served } = await finish(done, {
      '/api/admin/transactions': [tx({ id: 't2', type: 'refund', amount: 790 }), tx()],
    });
    expect(served).toContain('/api/admin/health');
    expect(served).toContain('/api/admin/audit?c');
    expect(admin.transactions().map((t) => t.type)).toEqual(['refund', 'charge']);
  });

  it('re-reads the money, the health and the log after a plan change', async () => {
    await load([customer()]);
    const done = admin.setPlan('c1', 'basic');
    http.expectOne('/api/admin/customers/c1/plan').flush(customer({ plan: 'basic' }));
    const { served } = await finish(done);
    expect(served.sort()).toEqual(
      [
        '/api/admin/audit?c',
        '/api/admin/health',
        '/api/admin/summary',
        '/api/admin/transactions',
      ].sort(),
    );
    expect(admin.customer('c1')!.plan).toBe('basic');
  });

  it('asks Stripe to collect a failed charge again and reloads the money and the customers', async () => {
    await load(
      [customer({ status: 'past_due' })],
      [tx({ id: 't9', type: 'failed', refundable: false })],
    );
    const done = admin.retryCharge('t9');
    http
      .expectOne({ method: 'POST', url: '/api/admin/transactions/t9/retry' })
      .flush(tx({ id: 't9', type: 'charge' }));
    const { value } = await finish(done, {
      '/api/admin/transactions': [tx({ id: 't9', type: 'charge' })],
      '/api/admin/customers': [customer({ status: 'active' })],
    });
    expect(value?.status).toBe('active');
    expect(admin.transactions()[0].type).toBe('charge');
  });

  it('keeps what Stripe says about a customer: subscription, renewal and scheduled cancellation', async () => {
    await load([
      customer({
        hasSubscription: true,
        renewsAt: '2026-11-01T00:00:00Z',
        cancelAtPeriodEnd: true,
      }),
    ]);
    expect(admin.customer('c1')).toMatchObject({ hasSubscription: true, cancelAtPeriodEnd: true });
    expect(admin.customer('c1')!.renewsAt).toEqual(new Date('2026-11-01T00:00:00Z'));
  });

  it('saves plan limits, where 0 means unlimited, and re-reads the health and the plan log', async () => {
    await load([customer()]);
    const done = admin.setPlanField('pro', 'devices', 0);
    const req = http.expectOne('/api/admin/plans/pro');
    // The body carries the seven numbers and the price, never the functions (the API fixes those).
    expect(req.request.body).toEqual({
      price: 790,
      accounts: 10,
      posts: null,
      devices: null,
      seats: 1,
      groups: 300,
      images: 1000,
      libraryPosts: 1000,
    });
    req.flush({ ...PLANS[0], devices: null });
    const { served } = await finish(done);
    expect(served).toContain('/api/admin/health');
    expect(served).toContain('/api/admin/audit'); // the platform-wide log, no customer
    expect(admin.plans().pro.devices).toBeNull();
    expect(admin.plans().basic.price).toBeGreaterThan(0); // the other plans are kept
  });

  it('reads the three new numbers and the functions of every plan, ignoring a function it does not know', async () => {
    await load([customer()]);
    expect(admin.plans().pro).toMatchObject({ groups: 300, images: 1000, libraryPosts: 1000 });
    expect(admin.plans().pro.features).toEqual([
      'advanced_anti_ban',
      'notifications',
      'auto_reply',
      'ai',
    ]);
    // A plan the API did not list keeps the shipped defaults.
    expect(admin.plans().agency.features).toContain('bump');
  });

  it('saves a new number of a plan: groups, images and library posts, empty = unlimited', async () => {
    await load([customer()]);
    const done = admin.setPlanField('pro', 'groups', 500);
    const req = http.expectOne('/api/admin/plans/pro');
    expect(req.request.body).toMatchObject({ groups: 500, images: 1000, libraryPosts: 1000 });
    req.flush({ ...PLANS[0], groups: 500 });
    await finish(done);
    expect(admin.plans().pro.groups).toBe(500);

    const more = admin.setPlanField('pro', 'images', 0);
    const again = http.expectOne('/api/admin/plans/pro');
    expect(again.request.body).toMatchObject({ groups: 500, images: null });
    again.flush({ ...PLANS[0], groups: 500, images: null });
    await finish(more);
    expect(admin.plans().pro.images).toBeNull();
  });

  it('sends all seven overrides of a customer, 0 = unlimited and null keeps the plan', async () => {
    await load([customer({ limits: { ...NO_OVERRIDES, accounts: 5 } })]);
    expect(admin.customer('c1')!.limits).toEqual({ accounts: 5 });
    const done = admin.setLimit('c1', 'libraryPosts', 0);
    const req = http.expectOne('/api/admin/customers/c1/limits');
    expect(req.request.body).toEqual({ ...NO_OVERRIDES, accounts: 5, libraryPosts: 0 });
    req.flush(customer({ limits: { ...NO_OVERRIDES, accounts: 5, libraryPosts: 0 } }));
    await finish(done);
    expect(admin.customer('c1')!.limits).toEqual({ accounts: 5, libraryPosts: 0 });
  });

  it('switches a promo code off and keeps the instant it expires', async () => {
    await load([customer()]);
    const promo = {
      code: 'LAUNCH20',
      discount: 'd20',
      uses: 3,
      expiresAt: '2099-12-31T16:59:00Z',
      active: true,
    };
    admin.promos.set([
      {
        code: 'LAUNCH20',
        discount: 'd20',
        uses: 3,
        expires: [2099, 11, 31],
        expiresAt: new Date(promo.expiresAt),
        active: true,
      },
    ]);
    const done = admin.setPromoActive('LAUNCH20', false);
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/promos/LAUNCH20/active' });
    expect(req.request.body).toEqual({ active: false });
    req.flush({ ...promo, active: false });
    await finish(done);
    expect(admin.promos()[0].active).toBe(false);
    expect(admin.promos()[0].expiresAt).toEqual(new Date('2099-12-31T16:59:00Z'));
    expect(admin.promos()[0].expires).toEqual([2099, 11, 31]);
  });

  it('tells an expired code from a switched-off one', () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const day = (d: string) => new Date(d);
    expect(promoStatus({ active: true, expiresAt: day('2026-12-31') }, now)).toBe('active');
    expect(promoStatus({ active: false, expiresAt: day('2026-12-31') }, now)).toBe('off');
    expect(promoStatus({ active: true, expiresAt: day('2026-09-30') }, now)).toBe('expired');
    expect(promoStatus({ active: false, expiresAt: day('2026-09-30') }, now)).toBe('expired');
  });
});

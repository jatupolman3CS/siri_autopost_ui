import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiCustomer, ApiTransaction } from '../http/api.service';
import { provideApiTesting, settle } from '../../testing/api-testing';
import { AdminStore } from './admin.store';

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
  limits: { accounts: null, posts: null, devices: null, seats: null },
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
  ...over,
});

describe('AdminStore', () => {
  let http: HttpTestingController;
  let admin: AdminStore;

  /** Answers the requests load() and the money reload send. */
  function answerMoney(transactions: ApiTransaction[]): void {
    http.expectOne('/api/admin/transactions').flush(transactions);
    http
      .expectOne('/api/admin/summary')
      .flush({ basic: 0, pro: 1, agency: 0, revenue: [{ year: 2026, month: 9, amount: 790 }] });
  }

  async function load(customers: ApiCustomer[], transactions: ApiTransaction[] = [tx()]) {
    const done = admin.load();
    http.expectOne('/api/admin/customers').flush(customers);
    http.expectOne('/api/admin/promos').flush([]);
    http.expectOne((r) => r.url === '/api/admin/jobs').flush([]);
    http
      .expectOne('/api/plans')
      .flush([{ key: 'pro', price: 790, accounts: 10, posts: null, devices: 3, seats: 1 }]);
    answerMoney(transactions);
    await done;
  }

  beforeEach(() => {
    http = provideApiTesting();
    admin = TestBed.inject(AdminStore);
  });

  afterEach(() => http.verify());

  it('maps customers, money and the revenue months', async () => {
    await load([customer({ status: 'past_due', lastActiveAt: '2026-10-01T00:00:00Z' })]);
    const c = admin.customer('c1')!;
    expect(c.status).toBe('pastdue');
    expect(c.lastActive).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(admin.subs().pro).toBe(1);
    expect(admin.revenue()).toEqual([[2026, 8, 790]]);
    expect(admin.transactions()[0]).toMatchObject({ id: 't1', cust: 'c1', amount: 790 });
    expect(admin.loaded()).toBe(true);
  });

  it('suspends a customer with the server answer', async () => {
    await load([customer()]);
    const done = admin.apply('c1', 'suspend', undefined, ' late payment ');
    http.expectOne('/api/admin/customers/c1/note').flush(customer({ note: 'late payment' }));
    await settle();
    const req = http.expectOne('/api/admin/customers/c1/status');
    expect(req.request.body).toEqual({ status: 'suspended' });
    req.flush(customer({ status: 'suspended', paused: true, note: 'late payment' }));
    await done;
    expect(admin.customer('c1')).toMatchObject({
      status: 'suspended',
      paused: true,
      note: 'late payment',
    });
  });

  it('refunds the given transaction and reloads the money', async () => {
    await load([customer()]);
    const done = admin.apply('c1', 'refund', 't1');
    http
      .expectOne('/api/admin/transactions/t1/refund')
      .flush(tx({ id: 't2', type: 'refund', amount: -790 }));
    await settle();
    answerMoney([tx({ id: 't2', type: 'refund', amount: -790 }), tx()]);
    await done;
    expect(admin.transactions().map((t) => t.type)).toEqual(['refund', 'charge']);
  });

  it('saves plan limits, where 0 means unlimited', async () => {
    await load([customer()]);
    const done = admin.setPlanField('pro', 'devices', 0);
    const req = http.expectOne('/api/admin/plans/pro');
    expect(req.request.body).toEqual({
      price: 790,
      accounts: 10,
      posts: null,
      devices: null,
      seats: 1,
    });
    req.flush({ key: 'pro', price: 790, accounts: 10, posts: null, devices: null, seats: 1 });
    await done;
    expect(admin.plans().pro.devices).toBeNull();
    expect(admin.plans().basic.price).toBeGreaterThan(0); // the other plans are kept
  });
});

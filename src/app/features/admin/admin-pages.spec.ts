import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminStore, toCustomer } from '../../core/data/admin.store';
import { Customer } from '../../core/data/models';
import { ApiCustomer } from '../../core/http/api.service';
import { provideApiTesting, settle } from '../../testing/api-testing';
import { AdminViewService } from './admin-view.service';
import { ADMIN_ROUTES, loadAdminData } from './admin.routes';
import { CustomerDetailPageComponent } from './customer-detail-page.component';
import { FinancePageComponent } from './finance-page.component';
import { JobsPageComponent } from './jobs-page.component';
import { PROMO_CODE_RE, PlansPageComponent } from './plans-page.component';

const apiCustomer = (over: Partial<ApiCustomer> = {}): ApiCustomer => ({
  id: 'c1',
  name: 'Mali',
  email: 'mali@shop.co',
  plan: 'pro',
  status: 'active',
  since: '2026-01-05T00:00:00Z',
  cycle: 'month',
  accounts: 4,
  seats: 2,
  ext: '2.2.0',
  lastActiveAt: null,
  paused: false,
  jobs: { ok: 7, failed: 3, queued: 2, running: 0 },
  devices: [],
  note: null,
  workspaces: 1,
  limits: { accounts: null, posts: null, devices: null, seats: null },
  hasSubscription: false,
  renewsAt: null,
  cancelAtPeriodEnd: false,
  ...over,
});

describe('admin pages', () => {
  let http: HttpTestingController;
  let admin: AdminStore;

  function setup(customers: Customer[] = [toCustomer(apiCustomer())]) {
    http = provideApiTesting({
      providers: [AdminViewService, provideRouter([{ path: '**', children: [] }])],
    });
    admin = TestBed.inject(AdminStore);
    admin.customers.set(customers);
    admin.loaded.set(true);
  }

  function render<T>(page: Type<T>, inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(page);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  describe('entering the admin area', () => {
    it('reads the data every time a page is entered, not once per page load', async () => {
      setup();
      const router = TestBed.inject(Router);
      router.resetConfig([
        { path: 'admin', canActivateChild: [loadAdminData], children: ADMIN_ROUTES[0].children! },
      ]);
      const load = vi.spyOn(admin, 'load').mockResolvedValue();
      await router.navigateByUrl('/admin');
      await router.navigateByUrl('/admin/jobs');
      await router.navigateByUrl('/admin/finance');
      expect(load).toHaveBeenCalledTimes(3);
    });
  });

  describe('customer page', () => {
    it('compares posts with what went out in 24 h, never counting the failed ones', () => {
      setup([
        toCustomer(apiCustomer({ limits: { accounts: 5, posts: 10, devices: 1, seats: 2 } })),
      ]);
      const { el } = render(CustomerDetailPageComponent, { id: 'c1' });
      const labels = [...el.querySelectorAll('.lr .small')].map((n) => n.textContent!.trim());
      // devices, accounts, posts, seats
      expect(labels[2]).toMatch(/7\D+10/); // ok 7 of 10: not 7 + 3 failed
      expect(labels[1]).toMatch(/4\D+5/);
      http.match(() => true).forEach((r) => r.flush([]));
    });

    it('says the device and seat limits are per workspace when the customer has several', () => {
      setup([
        toCustomer(
          apiCustomer({
            workspaces: 3,
            limits: { accounts: null, posts: null, devices: 1, seats: 2 },
          }),
        ),
      ]);
      const { el } = render(CustomerDetailPageComponent, { id: 'c1' });
      const labels = [...el.querySelectorAll('.lr .small')].map((n) => n.textContent!.trim());
      expect(labels[0]).toMatch(/3/); // "across 3 workspaces"
      expect(labels[3]).toMatch(/3/);
      expect(labels[1]).not.toMatch(/workspace|เวิร์กสเปซ/); // accounts are owner-wide
      http.match(() => true).forEach((r) => r.flush([]));
    });

    it('has no save button for limits (each change saves) and retry works with no failures counted', () => {
      setup([toCustomer(apiCustomer({ jobs: { ok: 1, failed: 0, queued: 0, running: 0 } }))]);
      const { el } = render(CustomerDetailPageComponent, { id: 'c1' });
      expect(el.querySelector('.access .save-row button')).toBeNull();
      const retry = [...el.querySelectorAll<HTMLButtonElement>('.panel-head .actions button')][1];
      expect(retry.disabled).toBe(false); // the API retries every failed post, not only the 24 h ones
      http.match(() => true).forEach((r) => r.flush([]));
    });

    it('does not offer to resume a suspended customer: the API would answer 422', () => {
      setup([toCustomer(apiCustomer({ status: 'suspended', paused: true }))]);
      const { el } = render(CustomerDetailPageComponent, { id: 'c1' });
      const pause = el.querySelector<HTMLButtonElement>('.panel-head .actions button')!;
      expect(pause.disabled).toBe(true);
      expect(pause.getAttribute('title')).toBeTruthy();
      http.match(() => true).forEach((r) => r.flush([]));
    });
  });

  describe('jobs page', () => {
    it('shows "—" before the data and never a 100% success rate when nothing finished', () => {
      setup([toCustomer(apiCustomer({ jobs: { ok: 0, failed: 0, queued: 1, running: 0 } }))]);
      admin.loaded.set(false);
      let { el } = render(JobsPageComponent);
      expect([...el.querySelectorAll('.kpi .value')].map((n) => n.textContent)).toEqual([
        '—',
        '—',
        '—',
        '—',
      ]);
      TestBed.resetTestingModule();

      setup([toCustomer(apiCustomer({ jobs: { ok: 0, failed: 0, queued: 1, running: 0 } }))]);
      ({ el } = render(JobsPageComponent));
      const values = [...el.querySelectorAll('.kpi .value')].map((n) => n.textContent);
      expect(values[3]).toBe('—');
      expect(values[1]).toBe('1');
    });

    it('lets retry run for a customer whose failed count (24 h) is zero, and blocks resuming a suspended one', () => {
      setup([
        toCustomer(apiCustomer({ jobs: { ok: 1, failed: 0, queued: 0, running: 0 } })),
        toCustomer(apiCustomer({ id: 'c2', status: 'suspended', paused: true })),
      ]);
      const { el } = render(JobsPageComponent);
      const buttons = [...el.querySelectorAll<HTMLButtonElement>('.tbl.jobs .td.tight button')];
      // [pause c1, retry c1, pause c2, retry c2]
      expect(buttons[1].disabled).toBe(false);
      expect(buttons[2].disabled).toBe(true);
    });
  });

  describe('finance page', () => {
    it('counts "this month" on the Bangkok calendar', () => {
      // 01:30 on 1 October in Bangkok, still 30 September in UTC and in the Americas.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-30T18:30:00Z'));
      setup();
      admin.transactions.set([
        { id: 't1', date: [2026, 9, 1], cust: 'c1', type: 'charge', amount: 790 },
        { id: 't2', date: [2026, 8, 30], cust: 'c1', type: 'charge', amount: 99 },
      ]);
      const { el } = render(FinancePageComponent);
      const collected = [...el.querySelectorAll('.kpi')].find((k) =>
        k.textContent!.includes('฿790'),
      );
      expect(collected).toBeTruthy();
      expect(el.textContent).not.toContain('฿889');
    });

    it('uses the server MRR, the overview figure', () => {
      setup();
      admin.health.set({ mrr: 1234 } as never);
      const { el } = render(FinancePageComponent);
      expect(el.querySelector('.kpi .value')!.textContent).toBe('฿1,234');
    });
  });

  describe('plans page', () => {
    const promo = (over: object) => ({
      code: 'LAUNCH20',
      discount: 'd20' as const,
      uses: 2,
      expires: [2099, 11, 31],
      expiresAt: new Date('2099-12-31T16:59:00Z'),
      active: true,
      ...over,
    });

    it('shows active, switched-off and expired codes apart, and can switch the first two', () => {
      setup();
      admin.promos.set([
        promo({ code: 'ONE' }),
        promo({ code: 'TWO', active: false }),
        promo({
          code: 'THREE',
          expiresAt: new Date('2020-01-01T00:00:00Z'),
          expires: [2020, 0, 1],
        }),
      ]);
      const { el } = render(PlansPageComponent);
      const rows = [...el.querySelectorAll('.promo-tbl .td')];
      const cell = (i: number, col: number) => rows[i * 6 + col];
      const statusOf = (i: number) => cell(i, 4).textContent!.trim();
      expect(new Set([0, 1, 2].map(statusOf)).size).toBe(3); // three different words
      expect(cell(0, 5).querySelector('button')).not.toBeNull();
      expect(cell(1, 5).querySelector('button')).not.toBeNull();
      expect(cell(2, 5).querySelector('button')).toBeNull(); // expired: nothing to switch
    });

    it('switches a code through the API', async () => {
      setup();
      admin.promos.set([promo({ code: 'ONE' })]);
      const { el } = render(PlansPageComponent);
      el.querySelector<HTMLButtonElement>('.promo-tbl .td button')!.click();
      const req = http.expectOne({ method: 'PUT', url: '/api/admin/promos/ONE/active' });
      expect(req.request.body).toEqual({ active: false });
      req.flush({
        code: 'ONE',
        discount: 'd20',
        uses: 2,
        expiresAt: '2099-12-31T16:59:00Z',
        active: false,
      });
      await settle();
      http.match(() => true).forEach((r) => r.flush([]));
    });

    it('accepts the codes the API accepts: 3-30 letters or digits', () => {
      for (const ok of ['ABC', 'SAVE20', 'A'.repeat(30), 'ABC123', 'NEWYEAR25'])
        expect(PROMO_CODE_RE.test(ok)).toBe(true);
      for (const bad of ['AB', 'A'.repeat(31), 'SAVE-20', 'SAVE 20', '', 'SAVE_20'])
        expect(PROMO_CODE_RE.test(bad)).toBe(false);
    });

    it('has no "save" button: each field saves when it changes', () => {
      setup();
      const { el } = render(PlansPageComponent);
      expect(el.querySelector('.page-head button')).toBeNull();
    });

    it('lists plan and promo changes from the platform-wide log', () => {
      setup();
      admin.globalAudit.set([
        {
          id: 'a1',
          at: '2026-10-03T03:00:00Z',
          action: 'plan_settings_changed',
          actorId: 'x',
          actorEmail: 'admin@autopost.local',
          customerId: null,
          customerEmail: null,
          from: null,
          to: 'pro price=790',
        },
        {
          id: 'a2',
          at: '2026-10-03T04:00:00Z',
          action: 'impersonated',
          actorId: 'x',
          actorEmail: 'admin@autopost.local',
          customerId: 'c1',
          customerEmail: null,
          from: null,
          to: null,
        },
      ]);
      const { el } = render(PlansPageComponent);
      expect(el.querySelectorAll('.row.ar').length).toBe(1);
    });
  });
});

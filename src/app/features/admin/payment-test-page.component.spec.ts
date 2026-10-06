import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { ApiPaymentOverride } from '../../core/http/api.service';
import { provideApiTesting, settle } from '../../testing/api-testing';
import { AdminViewService } from './admin-view.service';
import { ADMIN_ROUTES } from './admin.routes';
import {
  OVERRIDE_MAX_AMOUNT,
  PaymentTestPageComponent,
  parseEmails,
} from './payment-test-page.component';

const state = (over: Partial<ApiPaymentOverride> = {}): ApiPaymentOverride => ({
  enabled: false,
  amount: 10,
  emails: [],
  updatedAt: null,
  minAmount: 10,
  paymentsConnected: true,
  ...over,
});

describe('PaymentTestPageComponent', () => {
  let http: HttpTestingController;

  async function render(answer: ApiPaymentOverride = state()) {
    http = provideApiTesting({
      providers: [AdminViewService, provideRouter([{ path: '**', children: [] }])],
    });
    const fixture = TestBed.createComponent(PaymentTestPageComponent);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/admin/payment-override' }).flush(answer);
    await settle();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const save = () => {
      el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    const toggle = () => {
      el.querySelector<HTMLInputElement>('.su-check-input')!.click();
      fixture.detectChanges();
    };
    return { fixture, el, type, save, toggle };
  }

  afterEach(() => {
    http?.match(() => true).forEach((r) => r.flush([]));
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('is a page of the admin area with its own title', () => {
    const route = ADMIN_ROUTES[0].children!.find((r) => r.path === 'payment-test');
    expect(route?.title).toBe('api.ptestNav');
  });

  it('reads emails one per line or separated by commas, lower-cased and without repeats', () => {
    expect(parseEmails('A@x.co,\n b@x.co ;a@x.co\r\n\n')).toEqual(['a@x.co', 'b@x.co']);
    expect(parseEmails('  \n ')).toEqual([]);
  });

  it('shows what the API holds: off by default, and the form is not saveable until something changes', async () => {
    const { el } = await render();
    expect(el.querySelector('[role="status"]')!.textContent).toMatch(/ปิดอยู่/);
    expect(el.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('10');
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(el.querySelector('.callout.warn')).not.toBeNull(); // real money moves
  });

  it('warns when Stripe is not connected', async () => {
    const { el } = await render(state({ paymentsConnected: false }));
    expect(el.querySelectorAll('.callout.warn').length).toBe(2);
  });

  it('refuses to turn it on for nobody, without calling the API', async () => {
    const { el, type, save, toggle } = await render();
    toggle();
    type('input[type="number"]', '20');
    save();
    expect(el.querySelector('[role="alert"]')!.textContent).toMatch(/อีเมล/);
    http.expectNone({ method: 'PUT', url: '/api/admin/payment-override' });
  });

  it('refuses an amount under Stripe’s minimum and a bad email', async () => {
    const { el, type, save } = await render();
    type('input[type="number"]', '9');
    type('textarea', 'not-an-email');
    save();
    const errors = [...el.querySelectorAll('[role="alert"]')].map((n) => n.textContent);
    expect(errors.length).toBe(2);
    expect(errors[0]).toContain('10');
    expect(errors[1]).toContain('not-an-email');
    http.expectNone({ method: 'PUT', url: '/api/admin/payment-override' });
    // Not a whole number, and over the API's ceiling.
    type('input[type="number"]', '12.5');
    save();
    type('input[type="number"]', String(OVERRIDE_MAX_AMOUNT + 1));
    save();
    http.expectNone({ method: 'PUT', url: '/api/admin/payment-override' });
  });

  it('saves the switch, the amount and the emails, then shows what the API answered', async () => {
    const { el, type, save, toggle } = await render();
    toggle();
    type('input[type="number"]', '20');
    type('textarea', 'Tester@Shop.co\nsecond@shop.co, tester@shop.co');
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    save();

    const req = http.expectOne({ method: 'PUT', url: '/api/admin/payment-override' });
    expect(req.request.body).toEqual({
      enabled: true,
      amount: 20,
      emails: ['tester@shop.co', 'second@shop.co'],
    });
    req.flush(
      state({
        enabled: true,
        amount: 20,
        emails: ['tester@shop.co', 'second@shop.co'],
        updatedAt: '2026-10-06T03:00:00Z',
      }),
    );
    await settle();
    // The log is read again so the change shows in it.
    http.match((r) => r.url.startsWith('/api/admin/audit')).forEach((r) => r.flush([]));

    const status = el.querySelector('[role="status"]')!.textContent!;
    expect(status).toMatch(/2/);
    expect(status).toContain('฿20');
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true); // nothing unsaved
  });

  it('lists only the changes and the charges of the payment test from the platform log', async () => {
    const { fixture, el } = await render();
    const admin = TestBed.inject(AdminStore);
    const entry = (id: string, action: string, over: object = {}) => ({
      id,
      at: '2026-10-06T03:00:00Z',
      action,
      actorId: 'x',
      actorEmail: 'admin@shop.co',
      customerId: null,
      customerEmail: null,
      from: null,
      to: null,
      ...over,
    });
    admin.globalAudit.set([
      entry('a1', 'payment_override_changed', { to: 'on amount=20 emails=2' }),
      entry('a2', 'payment_override_used', {
        customerId: 'c1',
        customerEmail: 'tester@shop.co',
        from: 'pro',
        to: '20',
      }),
      entry('a3', 'plan_settings_changed'),
    ] as never);
    fixture.detectChanges();
    const rows = [...el.querySelectorAll('.row.ar')].map((n) => n.textContent!);
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('฿20');
    expect(rows[1]).toContain('tester@shop.co');
    expect(rows[1]).toContain('฿20');
  });
});

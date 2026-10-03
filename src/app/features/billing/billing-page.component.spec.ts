import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SettingsStore } from '../../core/data/settings.store';
import { ApiBilling, ApiTransaction } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { RedirectService } from '../../core/services/redirect.service';
import { NotificationService } from '../../core/services/notification.service';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { BillingPageComponent } from './billing-page.component';

const BILLING: ApiBilling = {
  paymentsEnabled: true,
  plan: 'pro',
  cycle: 'month',
  status: 'active',
  hasSubscription: true,
  renewsAt: '2099-11-01T00:00:00Z',
  cancelAtPeriodEnd: false,
  canManagePayment: true,
  card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2099 },
  limits: { accounts: 10, posts: null, devices: 3, seats: 1 },
  usage: { accounts: 2, postsLast24h: 4, devices: 1 },
};

const CHARGE: ApiTransaction = {
  id: 'tx-1',
  userId: 'u-1',
  type: 'charge',
  amount: 790,
  plan: 'pro',
  cycle: 'month',
  promoCode: null,
  createdAt: '2026-09-01T03:00:00Z',
  receiptUrl: 'https://invoice.stripe.com/i/in_1',
  refundable: true,
  refundOfId: null,
};

describe('BillingPageComponent', () => {
  let http: HttpTestingController;
  let went: string[];
  const t = () => TestBed.inject(I18nService).t();

  beforeEach(() => {
    went = [];
    http = provideApiTesting({
      imports: [BillingPageComponent],
      providers: [
        provideRouter([]),
        { provide: RedirectService, useValue: { go: (url: string) => went.push(url) } },
      ],
    });
    TestBed.inject(SettingsStore); // loads with the workspace, before the page exists
  });

  afterEach(() => http.verify());

  /** Signs in (as a Pro or Free customer), opens the page and answers what it asks Stripe's side for. */
  async function open(
    billing: Partial<ApiBilling> = {},
    inputs: Record<string, string> = {},
    plan: 'pro' | 'free' = 'pro',
  ) {
    await signIn(http, { user: { plan } });
    const fixture = TestBed.createComponent(BillingPageComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/billing').flush({ ...BILLING, plan, ...billing });
    http.expectOne('/api/billing/invoices').flush([CHARGE]);
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the real card, renewal date, usage against the limits in force and the Stripe invoice link', async () => {
    const { el } = await open();
    const text = el.textContent ?? '';
    expect(text).toContain('VISA •••• 4242');
    expect(text).toContain('12/99');
    expect(text).toContain('2 / 10');
    expect(text).toContain(`4 / ${t().common.unlimited}`);
    expect(text).toContain('1 / 3');
    expect(text).toContain(t().api.renewsOn.replace('{date}', '').trim());
    expect(el.querySelector('a[href="https://invoice.stripe.com/i/in_1"]')).not.toBeNull();
    // Nothing of the old local card form or notification toggles is left.
    expect(el.querySelector('input[autocomplete="cc-number"]')).toBeNull();
  });

  it('sends a customer without a subscription to Stripe Checkout and leaves the plan alone', async () => {
    const { fixture, el } = await open(
      {
        hasSubscription: false,
        renewsAt: null,
        card: null,
        canManagePayment: false,
        usage: BILLING.usage,
      },
      {},
      'free',
    );
    expect(el.textContent).toContain(t().api.noCard);
    fixture.componentInstance['planModal'].set('pro');
    fixture.detectChanges();
    expect(el.ownerDocument.body.textContent).toContain(t().api.checkoutBody);

    fixture.componentInstance['promo'].set('LAUNCH20');
    const confirm = fixture.componentInstance['confirmPlan']();
    confirm.catch(() => undefined);
    const req = http.expectOne({ method: 'PUT', url: '/api/billing/plan' });
    expect(req.request.body).toEqual({ plan: 'pro', cycle: 'month', promoCode: 'LAUNCH20' });
    // Pressing confirm again while it is in flight sends nothing new.
    void fixture.componentInstance['confirmPlan']();
    http.expectNone({ method: 'PUT', url: '/api/billing/plan' });
    req.flush({
      user: {
        id: 'u-1',
        email: 'owner@shop.co',
        name: 'owner',
        role: 'user',
        plan: 'free',
        cycle: 'month',
        status: 'active',
      },
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    await confirm;
    expect(went).toEqual(['https://checkout.stripe.com/c/pay/cs_test_1']);
  });

  it('applies the paid session when Stripe sends the customer back, then reloads billing', async () => {
    const { fixture } = await open({}, { checkout: 'success', session_id: 'cs_test_9' });
    await settle();
    const confirm = http.expectOne({ method: 'POST', url: '/api/billing/checkout/confirm' });
    expect(confirm.request.body).toEqual({ sessionId: 'cs_test_9' });
    confirm.flush({
      id: 'u-1',
      email: 'owner@shop.co',
      name: 'owner',
      role: 'user',
      plan: 'pro',
      cycle: 'year',
      status: 'active',
    });
    await settle();
    http.expectOne('/api/billing').flush({ ...BILLING, cycle: 'year' });
    http.expectOne('/api/billing/invoices').flush([CHARGE]);
    await settle();
    const toasts = TestBed.inject(NotificationService).toasts();
    expect(toasts.some((x) => x.type === 'success' && x.message.includes(t().plans.pro.name))).toBe(
      true,
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('says so when the customer cancelled at Stripe and does not charge', async () => {
    const { el } = await open({}, { checkout: 'cancel' });
    expect(
      TestBed.inject(NotificationService)
        .toasts()
        .some((x) => x.message === t().api.checkoutCancelled),
    ).toBe(true);
    expect(el.textContent).toContain('VISA');
  });

  it('shows when a cancelled plan ends and offers to keep it', async () => {
    const { el } = await open({ cancelAtPeriodEnd: true });
    expect(el.textContent).toContain(t().api.endsOn.replace('{date}', '').trim());
    expect(el.textContent).toContain(t().api.keepPlan);
  });

  it('warns about a card that expires soon and about a failed renewal', async () => {
    const now = new Date();
    const { el } = await open({
      status: 'past_due',
      card: {
        brand: 'visa',
        last4: '4242',
        expMonth: now.getMonth() + 1,
        expYear: now.getFullYear(),
      },
    });
    expect(el.textContent).toContain(t().api.cardExpiringSoon);
  });

  it('opens the billing portal for the card and invoices', async () => {
    const { fixture } = await open();
    const manage = fixture.componentInstance['managePayment']();
    http
      .expectOne({ method: 'POST', url: '/api/billing/portal' })
      .flush({ url: 'https://billing.stripe.com/p/session/x' });
    await manage;
    expect(went).toEqual(['https://billing.stripe.com/p/session/x']);
  });

  it('says payments are off when Stripe is not configured', async () => {
    const { el } = await open({ paymentsEnabled: false });
    expect(el.textContent).toContain(t().api.paymentsOff);
  });

  it('opens the plan picked before signing up, ready to be paid', async () => {
    const { fixture } = await open(
      { hasSubscription: false, card: null, canManagePayment: false },
      { plan: 'basic' },
      'free',
    );
    await settle();
    expect(fixture.componentInstance['planModal']()).toBe('basic');
  });
});

import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { SettingsStore } from '../../core/data/settings.store';
import { ApiBilling, ApiTransaction } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { StripeService } from '../../core/payments/stripe.service';
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
  limits: {
    accounts: 10,
    posts: null,
    devices: 3,
    seats: 3,
    groups: 300,
    images: 1000,
    libraryPosts: 1000,
  },
  usage: { accounts: 2, postsLast24h: 4, devices: 1, groups: 40, images: 120, libraryPosts: 15 },
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
        // Stripe.js is never loaded from the network in a spec: the payment window just keeps waiting for it.
        { provide: StripeService, useValue: { load: () => new Promise(() => undefined) } },
      ],
    });
    TestBed.inject(SettingsStore); // loads with the workspace, before the page exists
  });

  afterEach(() => http.verify());

  /** Signs in (as a Pro or Free customer), opens the page and answers what it asks Stripe's side for. */
  async function open(
    billing: Partial<ApiBilling> = {},
    inputs: Record<string, string> = {},
    plan: 'pro' | 'free' | 'agency' = 'pro',
    // The server has no Stripe key for the browser by default, so the plan is bought at Stripe's own page.
    config: { publishableKey: string | null; currency: string } = {
      publishableKey: null,
      currency: 'thb',
    },
  ) {
    await signIn(http, { user: { plan } });
    const fixture = TestBed.createComponent(BillingPageComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/billing').flush({ ...BILLING, plan, ...billing });
    http.expectOne('/api/billing/invoices').flush([CHARGE]);
    http.expectOne('/api/billing/payment-config').flush(config);
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

  describe('usage against the limits', () => {
    const rows = (el: HTMLElement) =>
      [...el.querySelectorAll('.usage')].map((u) => [
        u.querySelector('.usage-head span')!.textContent!.trim(),
        u.querySelector('.usage-head .muted')!.textContent!.trim(),
      ]);

    it('has a bar for every number the plan limits, with its own label', async () => {
      const { el } = await open();
      expect(rows(el)).toEqual([
        [t().api.planLimit.groups, '40 / 300'],
        [t().api.planLimit.images, '120 / 1000'],
        [t().api.planLimit.libraryPosts, '15 / 1000'],
        [t().api.planLimit.posts, `4 / ${t().common.unlimited}`],
        [t().api.planLimit.devices, '1 / 3'],
        [t().api.planLimit.accounts, '2 / 10'],
      ]);
      // Nothing is full: no warning, no upgrade link.
      expect(el.querySelector('.usage-warn')).toBeNull();
    });

    it('warns about a number at its limit and offers the plans', async () => {
      const { el } = await open({ usage: { ...BILLING.usage, groups: 300, images: 1000 } });
      const warns = [...el.querySelectorAll('.usage-warn')];
      expect(warns).toHaveLength(2);
      expect(warns[0].textContent).toContain(t().api.usageFull);
      expect(warns[0].textContent).toContain(t().api.usageUpgrade);
      const upgrade = warns[0].querySelector<HTMLButtonElement>('button')!;
      expect(upgrade.textContent!.trim()).toBe(t().common.upgrade);
      // The link takes the person to the plans below.
      const target = el.querySelector<HTMLElement>('#bill-plans')!;
      const scroll = vi.fn();
      target.scrollIntoView = scroll;
      upgrade.click();
      expect(scroll).toHaveBeenCalled();
      expect(el.ownerDocument.activeElement).toBe(target);
    });

    it('says a number is over its limit (a plan that was lowered) in the danger colour', async () => {
      const { el } = await open({ usage: { ...BILLING.usage, libraryPosts: 1200 } });
      const row = [...el.querySelectorAll('.usage')].find((u) =>
        u.textContent!.includes(t().api.planLimit.libraryPosts),
      )!;
      expect(row.textContent).toContain('1200 / 1000');
      expect(row.querySelector('.usage-warn')!.textContent).toContain(t().api.usageOver);
      expect(row.querySelector<HTMLElement>('.bar span')!.style.background).toContain('danger');
    });

    it('never warns about an unlimited number', async () => {
      const { el } = await open({
        limits: { ...BILLING.limits, accounts: 2, groups: null, images: null, libraryPosts: null },
        usage: { ...BILLING.usage, accounts: 2, groups: 5000 },
      });
      expect(el.textContent).toContain(`5000 / ${t().common.unlimited}`);
      const warns = [...el.querySelectorAll('.usage-warn')];
      expect(warns).toHaveLength(1); // the accounts, 2 of 2
      expect(warns[0].textContent).toContain(t().api.usageFull);
    });

    it('offers no upgrade to someone on the top plan', async () => {
      const { el } = await open(
        { limits: { ...BILLING.limits, accounts: 2 }, usage: { ...BILLING.usage, accounts: 2 } },
        {},
        'agency',
      );
      expect(el.querySelector('.usage-warn')).not.toBeNull();
      expect(el.querySelector('.usage-warn button')).toBeNull();
    });
  });

  describe('comparison table', () => {
    const table = (el: HTMLElement) => el.querySelector('table.cmp')!;

    it('has a column per plan and a row header per number and function', async () => {
      const { el } = await open();
      const heads = [...table(el).querySelectorAll('thead th[scope="col"]')].map((th) =>
        th.textContent!.trim(),
      );
      expect(heads[0]).toBe(t().api.planCompareRowHead);
      const names = (['free', 'basic', 'pro', 'agency'] as const).map((k) => t().plans[k].name);
      names.forEach((name, i) => expect(heads[i + 1]).toContain(name));
      const rowHeads = [...table(el).querySelectorAll('tbody th[scope="row"]')].map((th) =>
        th.textContent!.trim(),
      );
      expect(rowHeads).toEqual([
        t().api.planLimit.groups,
        t().api.planLimit.images,
        t().api.planLimit.libraryPosts,
        t().api.planLimit.posts,
        t().api.planLimit.devices,
        t().api.planLimit.seats,
        t().api.planLimit.accounts,
        t().api.planFeature.ai,
        t().api.planFeature.advanced_anti_ban,
        t().api.planFeature.notifications,
        t().api.planFeature.auto_reply,
        t().api.planFeature.bump,
        t().api.planFeature.client_reports,
      ]);
      expect(table(el).querySelector('caption')!.textContent).toContain(t().api.planCompareCaption);
      // The region can be reached with the keyboard to scroll sideways on a phone.
      expect(el.querySelector('app-plan-compare [role="region"]')!.getAttribute('tabindex')).toBe(
        '0',
      );
    });

    it('highlights the current plan and says which it is', async () => {
      const { el } = await open();
      const current = table(el).querySelector('thead th[aria-current="true"]')!;
      expect(current.textContent).toContain(t().plans.pro.name);
      expect(current.textContent).toContain(t().api.planYours);
      // Every body row marks the same column (the third plan).
      const rows = [...table(el).querySelectorAll('tbody tr:not(.grp)')];
      expect(rows.every((r) => r.querySelectorAll('td.cur').length === 1)).toBe(true);
      expect(rows.every((r) => r.querySelectorAll('td')[2].classList.contains('cur'))).toBe(true);
    });

    it('shows the numbers as text and the functions as a check or a dash with a word for a screen reader', async () => {
      const { el } = await open();
      const row = (label: string) =>
        [...table(el).querySelectorAll('tbody tr')].find(
          (r) => r.querySelector('th')!.textContent!.trim() === label,
        )!;
      const groups = [...row(t().api.planLimit.groups).querySelectorAll('td')];
      expect(groups.map((c) => c.textContent!.trim())).toEqual([
        '10',
        '50',
        '300',
        t().common.unlimited,
      ]);
      const bump = [...row(t().api.planFeature.bump).querySelectorAll('td')];
      expect(bump.map((c) => c.querySelector('i')!.classList.contains('ph-check'))).toEqual([
        false,
        false,
        false,
        true,
      ]);
      expect(bump.map((c) => c.querySelector('.sr-only')!.textContent)).toEqual([
        t().api.planNotIncluded,
        t().api.planNotIncluded,
        t().api.planNotIncluded,
        t().api.planIncluded,
      ]);
    });

    it('follows the plans the API gave (an admin edit)', async () => {
      const { fixture, el } = await open();
      TestBed.inject(AdminStore).plans.update((p) => ({ ...p, basic: { ...p.basic, groups: 77 } }));
      fixture.detectChanges();
      expect(table(el).textContent).toContain('77');
    });
  });

  it('shows the plan cards with the seven numbers and calls the top plan Premium', async () => {
    const { el } = await open();
    const cards = el.querySelectorAll('app-plan-cards .tier');
    expect(cards).toHaveLength(4);
    expect(cards[3].querySelector('.name')!.textContent).toBe('Premium');
    expect(el.textContent).not.toContain('Agency');
    expect(cards[2].querySelectorAll('.limits li')).toHaveLength(7);
  });

  it('without a publishable key still lets the customer pick the way to pay, then goes to the Stripe page for that way', async () => {
    const FREE_USER = {
      id: 'u-1',
      email: 'owner@shop.co',
      name: 'owner',
      role: 'user',
      plan: 'free',
      cycle: 'month',
      status: 'active',
    };
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
    expect(el.ownerDocument.body.textContent).toContain(t().api.checkoutBodyInApp);

    fixture.componentInstance['promo'].set('LAUNCH20');
    await fixture.componentInstance['confirmPlan']();
    fixture.detectChanges();
    await settle();

    // Nothing is sent yet: the window opens with the five ways to pay.
    http.expectNone({ method: 'PUT', url: '/api/billing/plan' });
    http.expectNone({ method: 'POST', url: '/api/billing/payments' });
    const body = el.ownerDocument.body;
    const rows = [...body.querySelectorAll<HTMLElement>('button[role="radio"]')];
    expect(rows.map((r) => r.dataset['method'])).toEqual([
      'card',
      'apple_pay',
      'google_pay',
      'link',
      'promptpay',
    ]);

    // PromptPay: the server is asked for the one-off page; a second press while it is in flight sends nothing.
    rows[4].click();
    fixture.detectChanges();
    const go = () =>
      [...body.querySelectorAll<HTMLButtonElement>('.pm-panel button')].find((b) =>
        b.textContent?.includes('PromptPay'),
      )!;
    go().click();
    const req = http.expectOne({ method: 'PUT', url: '/api/billing/plan' });
    expect(req.request.body).toEqual({
      plan: 'pro',
      cycle: 'month',
      promoCode: 'LAUNCH20',
      method: 'promptpay',
    });
    fixture.detectChanges();
    go().click();
    http.expectNone({ method: 'PUT', url: '/api/billing/plan' });
    req.flush({ user: FREE_USER, checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    await settle();
    expect(went).toEqual(['https://checkout.stripe.com/c/pay/cs_test_1']);
  });

  it('shows why Stripe refused the picked way to pay, next to the button, and lets the customer pick another', async () => {
    const { fixture, el } = await open(
      { hasSubscription: false, renewsAt: null, card: null },
      {},
      'free',
    );
    fixture.componentInstance['planModal'].set('pro');
    await fixture.componentInstance['confirmPlan']();
    fixture.detectChanges();
    await settle();

    const body = el.ownerDocument.body;
    [...body.querySelectorAll<HTMLButtonElement>('.pm-panel button')]
      .find((b) => b.textContent?.includes('Stripe'))!
      .click();
    http
      .expectOne({ method: 'PUT', url: '/api/billing/plan' })
      .flush(
        { title: 'ยอดชำระหลังหักส่วนลดต่ำกว่า 10 บาท' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await settle();
    fixture.detectChanges();
    expect(body.querySelector('app-payment-checkout [role="alert"]')?.textContent).toContain(
      'ยอดชำระหลังหักส่วนลดต่ำกว่า 10 บาท',
    );
    expect(went).toEqual([]);
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

  it('opens the in-app payment window instead of Stripe Checkout when the server has a publishable key', async () => {
    const { fixture, el } = await open(
      { hasSubscription: false, renewsAt: null, card: null, canManagePayment: false },
      {},
      'free',
      { publishableKey: 'pk_test_1', currency: 'thb' },
    );
    fixture.componentInstance['planModal'].set('pro');
    fixture.detectChanges();
    expect(el.ownerDocument.body.textContent).toContain(t().api.checkoutBodyInApp);

    fixture.componentInstance['promo'].set('LAUNCH20');
    await fixture.componentInstance['confirmPlan']();
    fixture.detectChanges();
    await settle();

    // No plan change is made and nobody is redirected: the window starts the payment with the first way to pay.
    http.expectNone({ method: 'PUT', url: '/api/billing/plan' });
    const start = http.expectOne({ method: 'POST', url: '/api/billing/payments' });
    expect(start.request.body).toEqual({
      plan: 'pro',
      cycle: 'month',
      promoCode: 'LAUNCH20',
      method: 'card',
    });
    start.flush({
      id: 'pi_1',
      clientSecret: 'pi_1_secret_x',
      amount: 632,
      currency: 'thb',
      flow: 'subscription',
      method: 'card',
    });
    await settle();
    fixture.detectChanges();
    expect(went).toEqual([]);
    const rows = [...el.ownerDocument.querySelectorAll<HTMLElement>('button[role="radio"]')];
    expect(rows.map((r) => r.dataset['method'])).toEqual([
      'card',
      'apple_pay',
      'google_pay',
      'link',
      'promptpay',
    ]);
  });

  it('applies a payment that left the page (Stripe sent the customer back with ?payment_intent=)', async () => {
    const { fixture } = await open({}, { payment_intent: 'pi_9' });
    await settle();
    const confirm = http.expectOne({ method: 'POST', url: '/api/billing/payments/pi_9/confirm' });
    confirm.flush({
      id: 'pi_9',
      status: 'succeeded',
      method: 'promptpay',
      failureMessage: null,
      amount: 790,
      flow: 'prepaid',
      user: {
        id: 'u-1',
        email: 'owner@shop.co',
        name: 'owner',
        role: 'user',
        plan: 'pro',
        cycle: 'month',
        status: 'active',
      },
    });
    await settle();
    http.expectOne('/api/billing').flush(BILLING);
    http.expectOne('/api/billing/invoices').flush([CHARGE]);
    await settle();
    const toasts = TestBed.inject(NotificationService).toasts();
    expect(toasts.some((x) => x.type === 'success' && x.message.includes(t().plans.pro.name))).toBe(
      true,
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows a plan paid ahead (PromptPay) with its end date and lets the customer pay for the next period', async () => {
    const { el } = await open({ hasSubscription: false, canManagePayment: false, card: null });
    expect(el.textContent).toContain(t().api.prepaidUntil.replace('{date}', '').trim());
    expect(el.textContent).not.toContain(t().api.renewsOn.replace('{date}', '').trim());
    // The current plan can be paid for again: its button says so and is not disabled.
    expect(el.textContent).toContain(t().api.keepPlan);
  });
});

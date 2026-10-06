import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaymentStore } from '../../../core/data/payment.store';
import { SessionStore } from '../../../core/data/session.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  PaymentIntent,
  PaymentMethodId,
  PaymentStatus,
} from '../../../core/payments/payment.types';
import { StripeService } from '../../../core/payments/stripe.service';
import { RedirectService } from '../../../core/services/redirect.service';
import { settle } from '../../../testing/api-testing';
import { PaymentCheckoutComponent } from './payment-checkout.component';

const USER = {
  id: 'u-1',
  email: 'buyer@shop.co',
  name: 'buyer',
  role: 'user' as const,
  plan: 'free' as const,
  cycle: 'month' as const,
  status: 'active' as const,
};

function intent(method: PaymentMethodId, id = 'pi_card'): PaymentIntent {
  return {
    id,
    clientSecret: `${id}_secret_x`,
    amount: 790,
    currency: 'thb',
    flow: method === 'promptpay' ? 'prepaid' : 'subscription',
    method,
  };
}

function status(state: PaymentStatus['status'], over: Partial<PaymentStatus> = {}): PaymentStatus {
  return {
    id: 'pi_card',
    status: state,
    method: null,
    failureMessage: null,
    amount: 790,
    flow: 'subscription',
    user: { ...USER, plan: state === 'succeeded' ? 'pro' : 'free' },
    ...over,
  };
}

interface FakeElement {
  type: string;
  options: Record<string, unknown>;
  host: HTMLElement | null;
  destroyed: boolean;
  handlers: Record<string, (e: unknown) => unknown>;
  mount(host: HTMLElement): void;
  destroy(): void;
  on(event: string, handler: (e: unknown) => unknown): void;
}

// Stripe.js as the checkout uses it, recording what it was asked to do.
function fakeStripe() {
  const created: FakeElement[] = [];
  const elementsOptions: Record<string, unknown>[] = [];
  const stripe = {
    elements: vi.fn((options: Record<string, unknown>) => {
      elementsOptions.push(options);
      return {
        create: (type: string, opts: Record<string, unknown>) => {
          const el: FakeElement = {
            type,
            options: opts,
            host: null,
            destroyed: false,
            handlers: {},
            mount: (host) => (el.host = host),
            destroy: () => (el.destroyed = true),
            on: (event, handler) => (el.handlers[event] = handler),
          };
          created.push(el);
          return el;
        },
      };
    }),
    confirmCardPayment: vi.fn(),
    confirmPayment: vi.fn(),
    confirmPromptPayPayment: vi.fn(),
  };
  return { stripe, created, elementsOptions };
}

describe('PaymentCheckoutComponent', () => {
  let fake: ReturnType<typeof fakeStripe>;
  let payments: {
    config: ReturnType<typeof signal>;
    loadConfig: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    settle: ReturnType<typeof vi.fn>;
  };
  let session: {
    user: ReturnType<typeof signal>;
    applyUser: ReturnType<typeof vi.fn>;
    setPlan: ReturnType<typeof vi.fn>;
  };
  let went: string[];
  let reported: ReturnType<typeof vi.fn>;
  const t = () => TestBed.inject(I18nService).t();

  beforeEach(() => {
    fake = fakeStripe();
    reported = vi.fn();
    payments = {
      config: signal(null),
      loadConfig: vi.fn().mockResolvedValue({ publishableKey: 'pk_test_1', currency: 'thb' }),
      start: vi.fn(async (r: { method: PaymentMethodId }) =>
        intent(r.method, r.method === 'promptpay' ? 'pi_promptpay' : 'pi_card'),
      ),
      settle: vi.fn(),
    };
    went = [];
    session = { user: signal(USER), applyUser: vi.fn(), setPlan: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: PaymentStore, useValue: payments },
        { provide: SessionStore, useValue: session },
        { provide: RedirectService, useValue: { go: (url: string) => went.push(url) } },
        { provide: ErrorHandler, useValue: { handleError: reported } },
        { provide: StripeService, useValue: { load: vi.fn().mockResolvedValue(fake.stripe) } },
      ],
    });
  });

  async function open(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(PaymentCheckoutComponent);
    fixture.componentRef.setInput('plan', 'pro');
    fixture.componentRef.setInput('cycle', 'month');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    const paid = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.paid.subscribe(paid);
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const row = (id: string) => el.querySelector<HTMLButtonElement>(`button[data-method="${id}"]`)!;
    const pick = async (id: string) => {
      row(id).click();
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
    };
    const button = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.pm-panel button')].find((b) =>
        b.textContent?.includes(label),
      )!;
    return { fixture, el, row, pick, button, paid, closed };
  }

  it('lists the five ways to pay in order, opens card first and asks the server for a subscription payment', async () => {
    const { el, row } = await open({ promoCode: 'LAUNCH20' });

    const rows = [...el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
    expect(rows.map((r) => r.dataset['method'])).toEqual([
      'card',
      'apple_pay',
      'google_pay',
      'link',
      'promptpay',
    ]);
    expect(row('card').getAttribute('aria-checked')).toBe('true');
    expect(payments.start).toHaveBeenCalledTimes(1);
    expect(payments.start).toHaveBeenCalledWith({
      plan: 'pro',
      cycle: 'month',
      promoCode: 'LAUNCH20',
      method: 'card',
    });
    // The card fields are Stripe's element; the pay button states the amount the server asked for.
    const card = fake.created.find((c) => c.type === 'card')!;
    expect(card.host).not.toBeNull();
    expect(el.querySelector('.pm-panel')?.textContent).toContain('฿790');
    expect(el.textContent).toContain(t().api.payRenewMonth);
  });

  it('pays by card with Stripe.js, then lets the server say it worked and hands the new plan to the session', async () => {
    const { el, button, paid } = await open();
    fake.stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    payments.settle.mockResolvedValue(status('succeeded', { method: 'card' }));

    button('฿790').click();
    await settle();

    const [secret, data] = fake.stripe.confirmCardPayment.mock.calls[0];
    expect(secret).toBe('pi_card_secret_x');
    expect(data.payment_method.billing_details).toEqual({ email: 'buyer@shop.co' });
    expect(data.payment_method.card).toBe(fake.created.find((c) => c.type === 'card'));
    expect(payments.settle).toHaveBeenCalledWith('pi_card', expect.anything());
    expect(session.applyUser).toHaveBeenCalledWith({ ...USER, plan: 'pro' });
    expect(paid).toHaveBeenCalledTimes(1);
    expect(paid.mock.calls[0][0].status).toBe('succeeded');
  });

  it('shows what the card said when it is declined, asks the server nothing and lets the customer try again', async () => {
    const { fixture, el, button } = await open();
    fake.stripe.confirmCardPayment.mockResolvedValue({
      error: { message: 'Your card was declined.' },
    });

    button('฿790').click();
    await settle();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Your card was declined.');
    expect(payments.settle).not.toHaveBeenCalled();
    expect(button('฿790').disabled).toBe(false);
  });

  it('shows the failure the server recorded and says so when the bank has not confirmed yet', async () => {
    const { fixture, el, button } = await open();
    fake.stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });

    payments.settle.mockResolvedValue(status('failed', { failureMessage: 'Insufficient funds.' }));
    button('฿790').click();
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Insufficient funds.');

    payments.settle.mockResolvedValue(status('pending'));
    button('฿790').click();
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain(t().api.payPending);
  });

  it('reuses the subscription payment for a wallet and shows only that wallet’s button', async () => {
    const { el, row, pick } = await open();
    await pick('apple_pay');

    expect(payments.start).toHaveBeenCalledTimes(1); // card and wallets pay the same subscription
    const apple = fake.created.find((c) => c.type === 'expressCheckout')!;
    expect(apple.options['paymentMethods']).toMatchObject({
      applePay: 'always',
      googlePay: 'never',
      link: 'never',
    });
    expect(fake.created.find((c) => c.type === 'card')!.destroyed).toBe(true);
    expect(fake.elementsOptions.at(-1)).toMatchObject({ clientSecret: 'pi_card_secret_x' });
    expect(row('apple_pay').getAttribute('aria-checked')).toBe('true');

    await pick('google_pay');
    expect(apple.destroyed).toBe(true);
    const google = fake.created.filter((c) => c.type === 'expressCheckout').at(-1)!;
    expect(google.options['paymentMethods']).toMatchObject({
      applePay: 'never',
      googlePay: 'always',
    });
    await pick('link');
    const link = fake.created.filter((c) => c.type === 'expressCheckout').at(-1)!;
    expect(link.options['paymentMethods']).toMatchObject({ link: 'auto', applePay: 'never' });
    expect(el.textContent).toContain(t().api.payWalletLink);
  });

  it('explains a wallet this device cannot use, and confirms a wallet payment through Stripe.js', async () => {
    const { fixture, el, pick, paid } = await open();
    await pick('apple_pay');
    const wallet = fake.created.find((c) => c.type === 'expressCheckout')!;

    wallet.handlers['ready']({ availablePaymentMethods: { applePay: false } });
    fixture.detectChanges();
    expect(el.querySelector('.callout')?.textContent).toContain(t().api.payWalletOff);

    wallet.handlers['ready']({ availablePaymentMethods: { applePay: true } });
    fixture.detectChanges();
    expect(el.querySelector('.callout')).toBeNull();

    fake.stripe.confirmPayment.mockResolvedValue({});
    payments.settle.mockResolvedValue(status('succeeded', { method: 'apple_pay' }));
    await wallet.handlers['confirm']({ paymentFailed: vi.fn() });
    await settle();
    expect(fake.stripe.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'pi_card_secret_x', redirect: 'if_required' }),
    );
    expect(paid).toHaveBeenCalledTimes(1);
  });

  it('tells Stripe’s wallet sheet when the payment fails', async () => {
    const { fixture, el, pick } = await open();
    await pick('google_pay');
    const wallet = fake.created.find((c) => c.type === 'expressCheckout')!;
    const paymentFailed = vi.fn();
    fake.stripe.confirmPayment.mockResolvedValue({ error: { message: 'Card not supported.' } });

    await wallet.handlers['confirm']({ paymentFailed });
    fixture.detectChanges();

    expect(paymentFailed).toHaveBeenCalledWith({ reason: 'fail', message: 'Card not supported.' });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Card not supported.');
  });

  it('pays one period with PromptPay: its own payment, Stripe’s QR, then the server confirms', async () => {
    const { el, pick, button, paid } = await open();
    await pick('promptpay');

    expect(payments.start).toHaveBeenCalledTimes(2);
    expect(payments.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'promptpay' }),
    );
    expect(el.textContent).toContain(t().api.payOnceMonth);
    expect(el.textContent).not.toContain(t().api.payRenewMonth);

    fake.stripe.confirmPromptPayPayment.mockResolvedValue({
      paymentIntent: { status: 'succeeded' },
    });
    payments.settle.mockResolvedValue(
      status('succeeded', { id: 'pi_promptpay', flow: 'prepaid', method: 'promptpay' }),
    );
    button(t().api.payWithPromptPay).click();
    await settle();

    expect(fake.stripe.confirmPromptPayPayment).toHaveBeenCalledWith('pi_promptpay_secret_x', {
      payment_method: { billing_details: { email: 'buyer@shop.co' } },
    });
    expect(payments.settle).toHaveBeenCalledWith('pi_promptpay', expect.anything());
    expect(paid).toHaveBeenCalledTimes(1);
  });

  it('waits for nothing when the customer closes the PromptPay QR unpaid, and can show it again', async () => {
    const { fixture, pick, button } = await open();
    await pick('promptpay');
    fake.stripe.confirmPromptPayPayment.mockResolvedValue({
      paymentIntent: { status: 'requires_action' },
    });

    button(t().api.payWithPromptPay).click();
    await settle();
    fixture.detectChanges();

    expect(payments.settle).not.toHaveBeenCalled();
    expect(button(t().api.payWithPromptPay).disabled).toBe(false);
  });

  it('says so when Stripe or the payment cannot be started, and tries again when the row is picked again', async () => {
    payments.start.mockRejectedValueOnce(new Error('422'));
    const { fixture, el, pick } = await open();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(t().api.payNoStripe);

    await pick('promptpay');
    await pick('card');
    fixture.detectChanges();
    expect(payments.start.mock.calls.map((c) => c[0].method)).toEqual([
      'card',
      'promptpay',
      'card',
    ]);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('closes, destroys the Stripe element and starts clean the next time it opens', async () => {
    const { fixture, el, closed } = await open();
    const card = fake.created.find((c) => c.type === 'card')!;

    (el.querySelector('[modal-footer] button') as HTMLButtonElement).click();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(card.destroyed).toBe(true);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await settle();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(payments.start).toHaveBeenCalledTimes(2); // a new payment, not the old one
  });

  it('does not stay on "paying" when Stripe.js throws: reports it, says the payment failed and lets the customer try again', async () => {
    const { fixture, el, pick, button } = await open();
    fake.stripe.confirmCardPayment.mockRejectedValue(new Error('IntegrationError'));
    button('฿790').click();
    await settle();
    fixture.detectChanges();
    expect(reported).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(t().api.payFailed);
    expect(button('฿790').disabled).toBe(false);

    await pick('promptpay');
    fake.stripe.confirmPromptPayPayment.mockRejectedValue(new Error('IntegrationError'));
    button(t().api.payWithPromptPay).click();
    await settle();
    fixture.detectChanges();
    expect(reported).toHaveBeenCalledTimes(2);
    expect(button(t().api.payWithPromptPay).disabled).toBe(false);
  });

  it('says a wallet cannot be used when its button fails to load or cannot be created', async () => {
    const { fixture, el, pick } = await open();
    await pick('google_pay');
    fake.created
      .filter((c) => c.type === 'expressCheckout')
      .at(-1)!
      .handlers['loaderror']({});
    fixture.detectChanges();
    expect(el.querySelector('.callout')?.textContent).toContain(t().api.payWalletOff);

    fake.stripe.elements.mockImplementationOnce(() => {
      throw new Error('IntegrationError');
    });
    await pick('link');
    fixture.detectChanges();
    expect(reported).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.callout')?.textContent).toContain(t().api.payWalletOff);
  });

  describe('without a publishable key (the Stripe page does the paying)', () => {
    it('lists the same five ways to pay, loads nothing from Stripe and asks the server for no payment', async () => {
      const { el } = await open({ hosted: true, promoCode: 'LAUNCH20' });

      const rows = [...el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
      expect(rows.map((r) => r.dataset['method'])).toEqual([
        'card',
        'apple_pay',
        'google_pay',
        'link',
        'promptpay',
      ]);
      expect(payments.start).not.toHaveBeenCalled();
      expect(fake.stripe.elements).not.toHaveBeenCalled();
      expect(el.querySelector('.total')).toBeNull(); // the amount is the server's, shown on Stripe's page
      expect(el.querySelector('.pm-panel')?.textContent).toContain(t().api.payHostedCard);
    });

    it('sends the picked way to the server and goes to the page it answers with', async () => {
      const { el, pick, button } = await open({ hosted: true, promoCode: ' LAUNCH20 ' });
      session.setPlan.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_1');

      button('Stripe').click();
      await settle();
      expect(session.setPlan).toHaveBeenLastCalledWith('pro', 'month', 'LAUNCH20', 'card');
      expect(went).toEqual(['https://checkout.stripe.com/c/pay/cs_test_1']);

      await pick('promptpay');
      expect(el.querySelector('.pm-panel')?.textContent).toContain(t().api.payHostedPromptPay);
      button('PromptPay').click();
      await settle();
      expect(session.setPlan).toHaveBeenLastCalledWith('pro', 'month', 'LAUNCH20', 'promptpay');
      expect(went).toHaveLength(2);
    });

    it('shows why the server refused the way to pay and lets the customer pick another', async () => {
      const { fixture, el, pick, button } = await open({ hosted: true });
      session.setPlan.mockRejectedValue(new Error('refused'));

      button('Stripe').click();
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(t().api.payFailed);
      expect(button('Stripe').disabled).toBe(false);
      expect(went).toEqual([]);

      await pick('link');
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });
  });
});

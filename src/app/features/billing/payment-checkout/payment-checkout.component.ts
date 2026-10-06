import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ErrorHandler,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type {
  Stripe,
  StripeCardElement,
  StripeElements,
  StripeExpressCheckoutElement,
} from '@stripe/stripe-js';
import { PaymentStore } from '../../../core/data/payment.store';
import { PlanKey } from '../../../core/data/models';
import { SessionStore } from '../../../core/data/session.store';
import { problemMessage } from '../../../core/http/problem-details';
import { baht } from '../../../core/i18n/format';
import { I18nService, fmt } from '../../../core/i18n/i18n.service';
import {
  PAYMENT_METHODS,
  PaymentFlow,
  PaymentIntent,
  PaymentMethodId,
  PaymentStatus,
  flowOf,
} from '../../../core/payments/payment.types';
import { StripeService } from '../../../core/payments/stripe.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import {
  PaymentMethodListComponent,
  PaymentMethodRow,
} from '../../../shared/components/payment-method-list/payment-method-list.component';
import { PaymentHostDirective } from './payment-host.directive';

type Phase = 'preparing' | 'ready' | 'paying' | 'waiting' | 'done';
type Wallet = 'apple_pay' | 'google_pay' | 'link';

const APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#1e6ce2',
    fontFamily: "'IBM Plex Sans Thai', system-ui, sans-serif",
    borderRadius: '8px',
  },
} as const;

// The payment window of a plan purchase. The five ways to pay are our own list (app-payment-method-list);
// what happens behind a row is Stripe.js:
//   card                     Stripe card element + confirmCardPayment
//   Apple Pay, Google Pay,   Stripe's Express Checkout Element showing only that wallet's button (Stripe draws
//   Link                     the official button and its payment sheet) + confirmPayment
//   PromptPay                confirmPromptPayPayment: Stripe's modal shows the QR
// The server makes the PaymentIntent (card and the wallets pay a Stripe subscription, PromptPay is one prepaid
// period) and is the only one that says whether it worked: after Stripe.js reports back, the payment is
// confirmed against the server, which reads Stripe (the webhook applies the same result, either may come first).
@Component({
  selector: 'app-payment-checkout',
  imports: [ModalComponent, PaymentMethodListComponent, PaymentHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-checkout.component.html',
  styleUrl: './payment-checkout.component.scss',
})
export class PaymentCheckoutComponent {
  readonly open = input(false);
  readonly plan = input<PlanKey>('pro');
  readonly cycle = input<'month' | 'year'>('month');
  readonly promoCode = input('');
  readonly closed = output<void>();
  /** The payment went through and the server applied it. */
  readonly paid = output<PaymentStatus>();

  private readonly payments = inject(PaymentStore);
  private readonly stripes = inject(StripeService);
  private readonly session = inject(SessionStore);
  private readonly errors = inject(ErrorHandler);
  protected readonly t = inject(I18nService).t;

  protected readonly method = signal<PaymentMethodId>('card');
  protected readonly phase = signal<Phase>('preparing');
  protected readonly intent = signal<PaymentIntent | null>(null);
  protected readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);
  /** The wallet of the open row cannot be used on this device or browser. */
  protected readonly walletOff = signal(false);

  protected readonly email = computed(() => this.session.user()?.email ?? '');
  protected readonly busy = computed(() => this.phase() === 'paying' || this.phase() === 'waiting');
  protected readonly title = computed(() =>
    fmt(this.t().bill.confirmTitle, { plan: this.t().plans[this.plan()].name }),
  );
  protected readonly total = computed(() => {
    const i = this.intent();
    return i ? baht(i.amount) : '';
  });
  protected readonly payLabel = computed(() => fmt(this.t().api.payAmount, { amt: this.total() }));

  protected readonly rows = computed<PaymentMethodRow[]>(() => {
    const a = this.t().api;
    const label: Record<PaymentMethodId, [string, string]> = {
      card: [a.pmCard, a.pmCardHint],
      apple_pay: ['Apple Pay', a.pmApplePayHint],
      google_pay: ['Google Pay', a.pmGooglePayHint],
      link: ['Link', a.pmLinkHint],
      promptpay: ['PromptPay', a.pmPromptPayHint],
    };
    return PAYMENT_METHODS.map((id) => ({ id, label: label[id][0], hint: label[id][1] }));
  });

  /** What the open row means for the plan afterwards: it renews by itself, or it is paid for one period. */
  protected readonly modeNote = computed(() => {
    const a = this.t().api;
    const year = this.cycle() === 'year';
    if (flowOf(this.method()) === 'prepaid') return year ? a.payOnceYear : a.payOnceMonth;
    return year ? a.payRenewYear : a.payRenewMonth;
  });

  protected readonly walletNote = computed(() => {
    const a = this.t().api;
    const m = this.method();
    return m === 'apple_pay'
      ? a.payWalletApple
      : m === 'google_pay'
        ? a.payWalletGoogle
        : a.payWalletLink;
  });

  // One PaymentIntent per flow, made when a row of that flow is first opened and reused when the customer
  // changes their mind between card, Apple Pay, Google Pay and Link (they all pay the same subscription).
  private readonly intents = new Map<PaymentFlow, Promise<PaymentIntent>>();
  private stripe: Stripe | null = null;
  private card: StripeCardElement | null = null;
  private cleanup: (() => void) | null = null;
  private abort = new AbortController();

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? void this.begin() : this.reset()));
    });
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  protected onPick(id: PaymentMethodId | null): void {
    if (!id || id === this.method() || this.busy()) return;
    this.method.set(id);
    void this.prepare(id);
  }

  /** The payment could not be started: ask for it again. */
  protected retry(): void {
    void this.prepare(this.method());
  }

  protected close(): void {
    if (this.phase() === 'paying') return;
    this.reset();
    this.closed.emit();
  }

  // --- the rows -------------------------------------------------------------------------------------

  /** The card fields exist: mount Stripe's card element in them. */
  protected mountCard(host: HTMLElement): void {
    const stripe = this.stripe;
    if (!stripe) return;
    try {
      const card = stripe.elements({ locale: 'th', appearance: APPEARANCE }).create('card', {
        hidePostalCode: true,
        style: { base: { fontSize: '16px' } },
      });
      card.mount(host);
      this.card = card;
      this.cleanup = () => {
        card.destroy();
        this.card = null;
      };
    } catch (e) {
      this.errors.handleError(e);
      this.message.set({ kind: 'error', text: this.t().api.payNoStripe });
    }
  }

  protected async payCard(): Promise<void> {
    const { stripe, card } = this;
    const intent = this.intent();
    if (!stripe || !card || !intent || this.busy()) return;
    this.begun();
    await this.guarded(async () => {
      const { error } = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: { card, billing_details: { email: this.email() } },
      });
      if (error) return this.declined(error.message);
      await this.finish(intent.id);
    });
  }

  /** The box for a wallet's button exists: Stripe's Express Checkout Element shows only this wallet. */
  protected mountWallet(wallet: Wallet, host: HTMLElement): void {
    const stripe = this.stripe;
    const intent = this.intent();
    if (!stripe || !intent) return;
    let elements: StripeElements;
    let button: StripeExpressCheckoutElement;
    try {
      elements = stripe.elements({
        clientSecret: intent.clientSecret,
        locale: 'th',
        appearance: APPEARANCE,
      });
      button = elements.create('expressCheckout', {
        paymentMethods: {
          applePay: wallet === 'apple_pay' ? 'always' : 'never',
          googlePay: wallet === 'google_pay' ? 'always' : 'never',
          link: wallet === 'link' ? 'auto' : 'never',
          amazonPay: 'never',
          paypal: 'never',
          klarna: 'never',
        },
        buttonHeight: 48,
      });
    } catch (e) {
      this.errors.handleError(e);
      this.walletOff.set(true);
      return;
    }
    button.on('ready', (e) => {
      const key =
        wallet === 'apple_pay' ? 'applePay' : wallet === 'google_pay' ? 'googlePay' : 'link';
      if (this.method() === wallet) this.walletOff.set(!e.availablePaymentMethods?.[key]);
    });
    // The wallet's button could not be made (blocked script, a key Stripe refuses): say so, do not leave a gap.
    button.on('loaderror', () => {
      if (this.method() === wallet) this.walletOff.set(true);
    });
    button.on('confirm', async (e) => {
      this.begun();
      await this.guarded(
        async () => {
          const { error } = await stripe.confirmPayment({
            elements,
            clientSecret: intent.clientSecret,
            confirmParams: { return_url: `${location.origin}/app/billing` },
            redirect: 'if_required',
          });
          if (error) {
            e.paymentFailed({ reason: 'fail', message: error.message });
            return this.declined(error.message);
          }
          await this.finish(intent.id);
        },
        () => e.paymentFailed({ reason: 'fail' }),
      );
    });
    try {
      button.mount(host);
      this.cleanup = () => button.destroy();
    } catch (e) {
      this.errors.handleError(e);
      this.walletOff.set(true);
    }
  }

  protected async payPromptPay(): Promise<void> {
    const stripe = this.stripe;
    const intent = this.intent();
    if (!stripe || !intent || this.busy()) return;
    this.begun();
    await this.guarded(async () => {
      // Stripe shows the QR in its own modal and answers when the customer paid or closed it.
      const { error, paymentIntent } = await stripe.confirmPromptPayPayment(intent.clientSecret, {
        payment_method: { billing_details: { email: this.email() } },
      });
      if (error) return this.declined(error.message);
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        await this.finish(intent.id);
      } else {
        // The QR was closed unpaid: nothing to wait for, the customer can show it again.
        this.phase.set('ready');
      }
    });
  }

  // --- the flow -------------------------------------------------------------------------------------

  /** Stripe.js can throw (an integration error, a lost connection): the window must not stay on "paying". */
  private async guarded(run: () => Promise<void>, onError?: () => void): Promise<void> {
    try {
      await run();
    } catch (e) {
      this.errors.handleError(e);
      onError?.();
      this.declined();
    }
  }

  private async begin(): Promise<void> {
    this.reset();
    this.method.set('card');
    await this.prepare('card');
  }

  private reset(): void {
    this.abort.abort();
    this.abort = new AbortController();
    this.destroyElement();
    this.intents.clear();
    this.intent.set(null);
    this.message.set(null);
    this.walletOff.set(false);
    this.phase.set('preparing');
  }

  private destroyElement(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.card = null;
  }

  private async prepare(method: PaymentMethodId): Promise<void> {
    this.destroyElement();
    this.intent.set(null);
    this.message.set(null);
    this.walletOff.set(false);
    this.phase.set('preparing');
    const flow = flowOf(method);
    let made = this.intents.get(flow);
    if (!made) {
      made = this.payments.start({
        plan: this.plan(),
        cycle: this.cycle(),
        promoCode: this.promoCode().trim() || undefined,
        method,
      });
      this.intents.set(flow, made);
    }
    try {
      const key = (await this.payments.loadConfig()).publishableKey;
      if (!key) throw new Error('no publishable key');
      const [intent, stripe] = await Promise.all([made, this.stripes.load(key)]);
      if (this.method() !== method || !this.open()) return; // the customer moved on meanwhile
      this.stripe = stripe;
      this.intent.set(intent);
      this.phase.set('ready');
    } catch (e) {
      this.intents.delete(flow); // a failed start is made again on the next try
      if (this.method() !== method) return;
      // The server's own reason when it refused (no Stripe, a bad code), else Stripe.js did not load.
      this.message.set({ kind: 'error', text: problemMessage(e) ?? this.t().api.payNoStripe });
      this.phase.set('ready');
    }
  }

  private begun(): void {
    this.message.set(null);
    this.phase.set('paying');
  }

  private declined(reason?: string): void {
    this.message.set({ kind: 'error', text: reason || this.t().api.payFailed });
    this.phase.set('ready');
  }

  /** Stripe.js is done: the server says whether the money arrived. */
  private async finish(id: string): Promise<void> {
    const a = this.t().api;
    const signal = this.abort.signal;
    this.phase.set('waiting');
    try {
      const status = await this.payments.settle(id, { signal });
      if (signal.aborted) return;
      if (status.status === 'succeeded') {
        this.destroyElement();
        this.phase.set('done');
        this.session.applyUser(status.user);
        this.paid.emit(status);
      } else if (status.status === 'failed') {
        this.declined(status.failureMessage ?? undefined);
      } else {
        this.message.set({ kind: 'info', text: a.payPending });
        this.phase.set('ready');
      }
    } catch {
      if (!signal.aborted) this.message.set({ kind: 'info', text: a.payPending });
      this.phase.set('ready');
    }
  }
}

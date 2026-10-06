import type {
  ApiCycle,
  ApiPaymentConfig,
  ApiPaymentFlow,
  ApiPaymentIntent,
  ApiPaymentMethod,
  ApiPaymentState,
  ApiPaymentStatus,
  ApiPlan,
} from '../http/api.service';

// What the in-app checkout works with: the five ways to pay, in the order they are shown, and the shapes
// that /api/billing/payment-config, /payments and /payments/{id}/confirm answer with (generated from the API).

/** card, apple_pay, google_pay, link, promptpay. */
export type PaymentMethodId = ApiPaymentMethod;

/** The order of the list: the same on every device, a wallet the device cannot use is explained, not hidden. */
export const PAYMENT_METHODS: readonly PaymentMethodId[] = [
  'card',
  'apple_pay',
  'google_pay',
  'link',
  'promptpay',
];

/**
 * subscription: the plan renews by itself (card, Apple Pay, Google Pay and Link all pay a Stripe subscription).
 * prepaid: one payment for one period, no renewal. PromptPay is a single-use method that Stripe cannot put
 * on a subscription, so it buys the plan for one month or one year at a time.
 */
export type PaymentFlow = ApiPaymentFlow;

export function flowOf(method: PaymentMethodId): PaymentFlow {
  return method === 'promptpay' ? 'prepaid' : 'subscription';
}

/** pending, succeeded or failed: the server's own record of the payment. */
export type PaymentState = ApiPaymentState;

/** `publishableKey` null: the server has no Stripe key for the browser, so Stripe's own page is used. */
export type PaymentConfig = ApiPaymentConfig;

/** What the window asks to pay for. */
export interface PaymentRequest {
  plan: ApiPlan;
  cycle: ApiCycle;
  promoCode?: string;
  method: PaymentMethodId;
}

/** `id` is the Stripe PaymentIntent (pi_...); `amount` is baht to pay now, promo code included. */
export type PaymentIntent = ApiPaymentIntent;

/** Where a payment stands, with the customer as the server now has them (the new plan once it succeeded). */
export type PaymentStatus = ApiPaymentStatus;

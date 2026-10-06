import { Injectable } from '@angular/core';
import { Stripe, loadStripe } from '@stripe/stripe-js';

/**
 * Loads Stripe.js from js.stripe.com (never bundled: Stripe requires it to come from them, and card data
 * must only ever be typed into the iframes it makes). One instance per publishable key. A separate service so
 * tests can put a fake Stripe in its place.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly loaded = new Map<string, Promise<Stripe>>();

  load(publishableKey: string): Promise<Stripe> {
    let stripe = this.loaded.get(publishableKey);
    if (!stripe) {
      stripe = loadStripe(publishableKey, { locale: 'th' }).then((s) => {
        if (!s) throw new Error('Stripe.js did not load');
        return s;
      });
      this.loaded.set(publishableKey, stripe);
      // A failed load (offline) must not be remembered: the next try goes to the network again.
      stripe.catch(() => this.loaded.delete(publishableKey));
    }
    return stripe;
  }
}

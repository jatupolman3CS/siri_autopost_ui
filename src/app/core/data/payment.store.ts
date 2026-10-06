import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import {
  PaymentConfig,
  PaymentIntent,
  PaymentRequest,
  PaymentStatus,
} from '../payments/payment.types';

export interface SettleOptions {
  /** Pause between two looks at Stripe while the payment is pending. */
  intervalMs?: number;
  /** Stops waiting after this long; the last status (still pending) is returned. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

// The in-app checkout's calls to the server. The page never decides whether a payment worked: it asks
// /payments/{id}/confirm, where the server reads the PaymentIntent from Stripe (the webhook applies the same
// result, whichever comes first wins).
@Injectable({ providedIn: 'root' })
export class PaymentStore {
  private readonly api = inject(ApiService);

  /** Null until loaded; `publishableKey` null inside means the server has no Stripe key for the browser. */
  readonly config = signal<PaymentConfig | null>(null);

  async loadConfig(): Promise<PaymentConfig> {
    const known = this.config();
    if (known) return known;
    const config = await this.api.paymentConfig();
    this.config.set(config);
    return config;
  }

  /** Whether the in-app checkout can run: the server handed out a publishable key. */
  readonly ready = () => !!this.config()?.publishableKey;

  start(request: PaymentRequest): Promise<PaymentIntent> {
    return this.api.startPayment(request);
  }

  confirm(id: string): Promise<PaymentStatus> {
    return this.api.confirmPayment(id);
  }

  /**
   * Asks the server about a payment until it is no longer pending (a PromptPay QR can wait for minutes), the
   * time is up, or the caller gives up. A failed look (the network, a 5xx) is tried again: it says nothing
   * about the payment.
   */
  async settle(id: string, options: SettleOptions = {}): Promise<PaymentStatus> {
    const { intervalMs = 2000, timeoutMs = 15 * 60_000, signal } = options;
    const until = Date.now() + timeoutMs;
    let last: PaymentStatus | null = null;
    for (;;) {
      try {
        last = await this.confirm(id);
        if (last.status !== 'pending') return last;
      } catch (e) {
        if (!last && Date.now() + intervalMs >= until) throw e;
      }
      if (signal?.aborted || Date.now() + intervalMs >= until) break;
      await sleep(intervalMs, signal);
      if (signal?.aborted) break;
    }
    if (last) return last;
    throw new Error('Payment status is unknown');
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}

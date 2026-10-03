import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ApiBilling, ApiService, ApiTransaction } from '../http/api.service';
import { RedirectService } from '../services/redirect.service';
import { SessionStore } from './session.store';

// The signed-in customer's billing: plan state, card and charges from Stripe via /api/billing. Loaded when
// the billing page opens (it asks Stripe for the card), emptied when the user goes away or changes.
@Injectable({ providedIn: 'root' })
export class BillingStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly redirect = inject(RedirectService);

  readonly info = signal<ApiBilling | null>(null);
  readonly invoices = signal<ApiTransaction[]>([]);
  readonly loaded = signal(false);

  constructor() {
    const userId = () => this.session.user()?.id ?? null;
    effect(() => {
      userId();
      untracked(() => {
        this.info.set(null);
        this.invoices.set([]);
        this.loaded.set(false);
      });
    });
  }

  async load(): Promise<void> {
    const [info, invoices] = await Promise.all([this.api.billing(), this.api.invoices()]);
    this.info.set(info);
    this.invoices.set(invoices);
    this.loaded.set(true);
  }

  /** Opens Stripe's billing portal (card, invoices, cancel) in this tab; it returns to the billing page. */
  async openPortal(): Promise<void> {
    this.redirect.go((await this.api.billingPortal()).url);
  }

  /** Goes to a Stripe Checkout address. */
  checkout(url: string): void {
    this.redirect.go(url);
  }
}

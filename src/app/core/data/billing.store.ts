import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiBilling, ApiBillingProfile, ApiService, ApiTransaction } from '../http/api.service';
import { RedirectService } from '../services/redirect.service';
import { SessionStore } from './session.store';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unionpay' | 'card';

export interface Notifications {
  notifyFailed: boolean;
  notifyExpiring: boolean;
  notifyRenewal: boolean;
}

export function cardBrand(number: string): CardBrand {
  const n = number.replace(/\D/g, '');
  const two = Number(n.slice(0, 2));
  const four = Number(n.slice(0, 4));
  if (n.startsWith('4')) return 'visa';
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  if (two === 34 || two === 37) return 'amex';
  if (four >= 3528 && four <= 3589) return 'jcb';
  if (two === 62) return 'unionpay';
  return 'card';
}

export function parseExpiry(text: string): { month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? { month, year: 2000 + Number(match[2]) } : null;
}

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
  readonly profile = signal<ApiBillingProfile | null>(null);
  readonly profileLoaded = signal(false);
  readonly card = computed(() => this.profile()?.card ?? null);
  readonly paymentsConnected = computed(() => this.profile()?.paymentsConnected ?? false);

  constructor() {
    // Only a different customer reloads the profile, not every refresh of the same user object.
    const userId = computed(() => this.session.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        this.info.set(null);
        this.invoices.set([]);
        this.loaded.set(false);
        this.profile.set(null);
        this.profileLoaded.set(false);
        if (id) void this.loadProfile();
      });
    });
  }

  async load(): Promise<void> {
    const [info, invoices] = await Promise.all([this.api.billing(), this.api.invoices()]);
    this.info.set(info);
    this.invoices.set(invoices);
    this.loaded.set(true);
  }

  async loadProfile(): Promise<void> {
    this.profile.set(await this.api.billingProfile());
    this.profileLoaded.set(true);
    this.loaded.set(true);
  }

  async saveNotifications(patch: Partial<Notifications>): Promise<void> {
    const before = this.profile();
    if (!before) return;
    const next: Notifications = {
      notifyFailed: before.notifyFailed,
      notifyExpiring: before.notifyExpiring,
      notifyRenewal: before.notifyRenewal,
      ...patch,
    };
    this.profile.set({ ...before, ...next });
    try {
      this.profile.set(await this.api.saveBillingNotifications(next));
    } catch (error) {
      this.profile.set(before);
      throw error;
    }
  }

  async saveCard(number: string, expiry: string): Promise<void> {
    const parsed = parseExpiry(expiry);
    if (!parsed) throw new Error('expiry');
    const digits = number.replace(/\D/g, '');
    this.profile.set(
      await this.api.savePaymentMethod({
        brand: cardBrand(digits),
        last4: digits.slice(-4),
        expMonth: parsed.month,
        expYear: parsed.year,
      }),
    );
  }

  async removeCard(): Promise<void> {
    this.profile.set(await this.api.removePaymentMethod());
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

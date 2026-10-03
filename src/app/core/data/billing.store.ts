import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiBillingProfile, ApiService } from '../http/api.service';
import { SessionStore } from './session.store';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unionpay' | 'card';

export interface Notifications {
  notifyFailed: boolean;
  notifyExpiring: boolean;
  notifyRenewal: boolean;
}

/** The brand a card number belongs to (by its leading digits); only this and the last four digits leave the form. */
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

/** "MM/YY" to month and four-digit year; null when it is not a month. */
export function parseExpiry(text: string): { month: number; year: number } | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? { month, year: 2000 + Number(m[2]) } : null;
}

// The signed-in customer's billing preferences and card on file (/api/billing/profile). The card is only
// what a payment provider returns: brand, last four digits and expiry. The number and the CVC typed into
// the form never leave it (see BillingPageComponent.confirmCard).
@Injectable({ providedIn: 'root' })
export class BillingStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

  readonly profile = signal<ApiBillingProfile | null>(null);
  readonly loaded = signal(false);
  readonly card = computed(() => this.profile()?.card ?? null);
  /** False until a payment provider is connected: charges are recorded, not collected. */
  readonly paymentsConnected = computed(() => this.profile()?.paymentsConnected ?? false);

  constructor() {
    // Reloads whenever the signed-in user changes (sign-in, sign-out, an admin's assist session).
    const userId = computed(() => this.session.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        this.profile.set(null);
        this.loaded.set(false);
        if (id) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    const p = await this.api.billingProfile();
    this.profile.set(p);
    this.loaded.set(true);
  }

  /** Shows the new choice at once; a refusal puts the old one back. */
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
    } catch (e) {
      this.profile.set(before);
      throw e;
    }
  }

  /** Throws the API's refusal (an expired card, for one) for the form to show. */
  async saveCard(number: string, expiry: string): Promise<void> {
    const exp = parseExpiry(expiry);
    if (!exp) throw new Error('expiry');
    const digits = number.replace(/\D/g, '');
    this.profile.set(
      await this.api.savePaymentMethod({
        brand: cardBrand(digits),
        last4: digits.slice(-4),
        expMonth: exp.month,
        expYear: exp.year,
      }),
    );
  }

  async removeCard(): Promise<void> {
    this.profile.set(await this.api.removePaymentMethod());
  }
}

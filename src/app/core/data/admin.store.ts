import { Injectable, signal } from '@angular/core';
import { CLOCK, dateParts, seedDate, seedMonth } from './clock';
import {
  Customer,
  CustomerStatus,
  DiscountKey,
  LimitKey,
  PlanKey,
  PlanLimits,
  Promo,
  Transaction,
} from './models';
import { SEED } from './seed.data';

export type AdminAction = 'suspend' | 'ban' | 'refund' | 'assist' | 'restore';

// Platform-owner data: customers, payments, plan prices and promo codes.
// Plan limits are also what the customer-facing billing page reads.
@Injectable({ providedIn: 'root' })
export class AdminStore {
  readonly customers = signal<Customer[]>(
    SEED.customers.map((c) => ({
      ...c,
      since: seedMonth(c.since),
      devices: c.devices.map((d) => ({ ...d })),
      jobs: { ...c.jobs },
      limits: {},
    })),
  );
  readonly transactions = signal<Transaction[]>(
    SEED.transactions.map((x) => ({ ...x, date: dateParts(seedDate(x.date)) })),
  );
  readonly promos = signal<Promo[]>(
    SEED.promos.map((p) => ({ ...p, expires: dateParts(seedDate(p.expires)) })),
  );
  readonly plans = signal<Record<PlanKey, PlanLimits>>(structuredClone(SEED.planLimits));
  readonly subs = SEED.subs;
  readonly revenue = SEED.revenue.map((r) => [...seedMonth(r), r[2]]);

  customer(id: string): Customer | undefined {
    return this.customers().find((c) => c.id === id);
  }

  private update(id: string, fn: (c: Customer) => Partial<Customer>): void {
    this.customers.update((list) => list.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)));
  }

  /** Runs an admin action; a refund adds a refund transaction (of txId, or the plan price). */
  apply(id: string, action: AdminAction, txId?: string): void {
    const c = this.customer(id);
    if (!c) return;
    const status: CustomerStatus =
      action === 'suspend'
        ? 'suspended'
        : action === 'ban'
          ? 'banned'
          : action === 'restore'
            ? 'active'
            : c.status;
    const paused =
      action === 'suspend' || action === 'ban' ? true : action === 'restore' ? false : c.paused;
    if (action === 'refund') {
      const src = txId ? this.transactions().find((x) => x.id === txId) : undefined;
      const amount = src ? src.amount : this.plans()[c.plan].price || 0;
      this.transactions.update((list) => [
        { id: 'tx' + Date.now(), date: dateParts(CLOCK.now), cust: c.id, type: 'refund', amount },
        ...list,
      ]);
    }
    this.update(id, () => ({ status, paused }));
  }

  setPlan(id: string, plan: PlanKey): void {
    this.update(id, () => ({ plan, limits: {} }));
  }

  setLimit(id: string, key: LimitKey, value: number): void {
    this.update(id, (c) => ({ limits: { ...(c.limits ?? {}), [key]: Math.max(0, value || 0) } }));
  }

  revokeDevice(id: string, index: number): void {
    this.update(id, (c) => ({ devices: c.devices.filter((_, j) => j !== index) }));
  }

  togglePaused(id: string): void {
    this.update(id, (c) => ({ paused: !c.paused }));
  }

  /** Moves failed jobs back to the queue; returns how many. */
  retryFailed(id: string): number {
    const n = this.customer(id)?.jobs.failed ?? 0;
    if (n) this.update(id, (c) => ({ jobs: { ...c.jobs, failed: 0, queued: c.jobs.queued + n } }));
    return n;
  }

  retryCharge(txId: string): Customer | undefined {
    const x = this.transactions().find((y) => y.id === txId);
    if (!x) return undefined;
    this.transactions.update((list) =>
      list.map((y) => (y.id === txId ? { ...y, type: 'charge', date: dateParts(CLOCK.now) } : y)),
    );
    this.customers.update((list) =>
      list.map((z) =>
        z.id === x.cust && z.status === 'pastdue' ? { ...z, status: 'active', note: undefined } : z,
      ),
    );
    return this.customer(x.cust);
  }

  setPlanField(plan: PlanKey, field: keyof PlanLimits, value: number): void {
    const n = Math.max(0, value || 0);
    this.plans.update((p) => ({
      ...p,
      [plan]: { ...p[plan], [field]: field === 'price' ? n : n || null },
    }));
  }

  addPromo(code: string, discount: DiscountKey): void {
    const end = new Date(CLOCK.now.getFullYear(), 11, 31);
    this.promos.update((list) => [
      { code, discount, uses: 0, expires: dateParts(end), active: true },
      ...list,
    ]);
  }
}

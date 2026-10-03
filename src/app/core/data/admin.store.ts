import { Injectable, inject, signal } from '@angular/core';
import {
  ApiAdminJob,
  ApiAuditEntry,
  ApiCustomer,
  ApiCustomerStatus,
  ApiHealth,
  ApiPlanSetting,
  ApiPromo,
  ApiService,
  ApiTransaction,
} from '../http/api.service';
import { Customer, DiscountKey, LimitKey, PlanKey, PlanLimits, Promo, Transaction } from './models';
import { SEED } from './seed.data';

export type AdminAction = 'suspend' | 'ban' | 'refund' | 'assist' | 'restore';

const LIMIT_KEYS: LimitKey[] = ['accounts', 'posts', 'devices', 'seats'];

const dateParts = (iso: string): number[] => {
  const d = new Date(iso);
  return [d.getFullYear(), d.getMonth(), d.getDate()];
};

export function toCustomer(c: ApiCustomer): Customer {
  const since = new Date(c.since);
  const limits: Partial<Record<LimitKey, number>> = {};
  for (const k of LIMIT_KEYS) if (c.limits[k] != null) limits[k] = c.limits[k]!;
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    plan: c.plan,
    status: c.status === 'past_due' ? 'pastdue' : c.status,
    since: [since.getFullYear(), since.getMonth()],
    cycle: c.cycle,
    accounts: c.accounts,
    seats: c.seats,
    ext: c.ext,
    lastActive: c.lastActiveAt ? new Date(c.lastActiveAt) : null,
    paused: c.paused,
    jobs: { ok: c.jobs.ok, failed: c.jobs.failed, queued: c.jobs.queued, running: c.jobs.running },
    devices: c.devices.map((d) => ({
      id: d.id,
      n: d.name,
      b: d.browser,
      seen: d.lastSeenAt ? new Date(d.lastSeenAt) : null,
      online: d.online,
      i: 'ph-desktop',
    })),
    note: c.note ?? undefined,
    limits,
    workspaces: c.workspaces,
  };
}

const toTx = (t: ApiTransaction): Transaction => ({
  id: t.id,
  date: dateParts(t.createdAt),
  cust: t.userId,
  type: t.type,
  amount: t.amount,
});

const toPromo = (p: ApiPromo): Promo => ({
  code: p.code,
  discount: p.discount as DiscountKey,
  uses: p.uses,
  expires: dateParts(p.expiresAt),
  active: p.active,
});

function toPlans(list: ApiPlanSetting[]): Record<PlanKey, PlanLimits> {
  const out = structuredClone(SEED.planLimits);
  for (const p of list)
    out[p.key] = {
      price: p.price,
      accounts: p.accounts,
      posts: p.posts,
      devices: p.devices,
      seats: p.seats,
    };
  return out;
}

// Platform-owner data from /api/admin (customers, payments, promo codes, revenue) and the
// plans from the public /api/plans, which the customer-facing pages read too. Without a
// payment provider, charges are recorded (plan changes), not collected.
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(ApiService);

  readonly customers = signal<Customer[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly promos = signal<Promo[]>([]);
  /** The design's values until /api/plans answers. */
  readonly plans = signal<Record<PlanKey, PlanLimits>>(structuredClone(SEED.planLimits));
  readonly subs = signal<Record<'basic' | 'pro' | 'agency', number>>({
    basic: 0,
    pro: 0,
    agency: 0,
  });
  /** [year, month0, net baht] for the last 12 months. */
  readonly revenue = signal<number[][]>([]);
  /** Newest posts across the platform (jobs page) and per customer (detail page). */
  readonly jobs = signal<ApiAdminJob[]>([]);
  readonly customerJobs = signal<Record<string, ApiAdminJob[]>>({});
  /** Live KPIs and system health for the overview (null until loaded). */
  readonly health = signal<ApiHealth | null>(null);
  /** Activity log per customer, newest first. */
  readonly audit = signal<Record<string, ApiAuditEntry[]>>({});
  readonly loaded = signal(false);

  async loadPlans(): Promise<void> {
    try {
      this.plans.set(toPlans(await this.api.plans()));
    } catch {
      // Keep the design's values; the server refuses changes that do not fit its own.
    }
  }

  /** Everything the admin pages show. */
  async load(): Promise<void> {
    const [customers, tx, promos, summary, jobs, health] = await Promise.all([
      this.api.adminCustomers(),
      this.api.adminTransactions(),
      this.api.adminPromos(),
      this.api.adminSummary(),
      this.api.adminJobs(undefined, 40),
      this.api.adminHealth(),
      this.loadPlans(),
    ]);
    this.health.set(health);
    this.customers.set(customers.map(toCustomer));
    this.transactions.set(tx.map(toTx));
    this.promos.set(promos.map(toPromo));
    this.subs.set({ basic: summary.basic, pro: summary.pro, agency: summary.agency });
    this.revenue.set(summary.revenue.map((r) => [r.year, r.month - 1, r.amount]));
    this.jobs.set(jobs);
    this.loaded.set(true);
  }

  async loadCustomerJobs(id: string): Promise<void> {
    const list = await this.api.adminJobs(id, 8);
    this.customerJobs.update((m) => ({ ...m, [id]: list }));
  }

  async loadAudit(id: string): Promise<void> {
    const list = await this.api.adminAudit(id, 30);
    this.audit.update((m) => ({ ...m, [id]: list }));
  }

  customer(id: string): Customer | undefined {
    return this.customers().find((c) => c.id === id);
  }

  private replace(c: ApiCustomer): void {
    const next = toCustomer(c);
    this.customers.update((list) => list.map((x) => (x.id === next.id ? next : x)));
  }

  private async reloadMoney(): Promise<void> {
    const [tx, summary] = await Promise.all([
      this.api.adminTransactions(),
      this.api.adminSummary(),
    ]);
    this.transactions.set(tx.map(toTx));
    this.subs.set({ basic: summary.basic, pro: summary.pro, agency: summary.agency });
    this.revenue.set(summary.revenue.map((r) => [r.year, r.month - 1, r.amount]));
  }

  /**
   * Runs an admin action. A refund refunds txId, or the customer's latest charge. "assist" only
   * keeps the note: signing in as the customer is not available. The note is saved with every action.
   */
  async apply(id: string, action: AdminAction, txId?: string, note?: string): Promise<void> {
    if (note?.trim()) this.replace(await this.api.adminSetNote(id, note.trim()));
    const status: Partial<Record<AdminAction, ApiCustomerStatus>> = {
      suspend: 'suspended',
      ban: 'banned',
      restore: 'active',
    };
    if (status[action]) this.replace(await this.api.adminSetStatus(id, status[action]!));
    if (action === 'refund') {
      await (txId ? this.api.adminRefund(txId) : this.api.adminRefundLatest(id));
      await this.reloadMoney();
    }
  }

  async setPlan(id: string, plan: PlanKey): Promise<void> {
    this.replace(await this.api.adminSetPlan(id, plan));
    await this.reloadMoney();
  }

  /** 0 = unlimited; the other limits keep their overrides. */
  async setLimit(id: string, key: LimitKey, value: number): Promise<void> {
    const c = this.customer(id);
    if (!c) return;
    const limits = {
      accounts: null,
      posts: null,
      devices: null,
      seats: null,
      ...(c.limits ?? {}),
    } as Record<LimitKey, number | null>;
    limits[key] = Math.max(0, value || 0);
    this.replace(await this.api.adminSetLimits(id, limits));
  }

  async revokeDevice(id: string, index: number): Promise<void> {
    const d = this.customer(id)?.devices[index];
    if (d) this.replace(await this.api.adminRevokeDevice(id, d.id));
  }

  async togglePaused(id: string): Promise<void> {
    const c = this.customer(id);
    if (c) this.replace(await this.api.adminSetPaused(id, !c.paused));
  }

  /** Moves failed posts back to the queue; returns how many. */
  async retryFailed(id: string): Promise<number> {
    const n = await this.api.adminRetryFailed(id);
    const [customers, jobs] = await Promise.all([
      this.api.adminCustomers(),
      this.api.adminJobs(undefined, 40),
    ]);
    this.customers.set(customers.map(toCustomer));
    this.jobs.set(jobs);
    if (this.customerJobs()[id]) await this.loadCustomerJobs(id);
    return n;
  }

  /** Records that a failed charge was paid (no payment provider is connected). */
  async retryCharge(txId: string): Promise<Customer | undefined> {
    const tx = await this.api.adminRecordPayment(txId);
    await this.reloadMoney();
    this.customers.set((await this.api.adminCustomers()).map(toCustomer));
    return this.customer(tx.userId);
  }

  async setPlanField(plan: PlanKey, field: keyof PlanLimits, value: number): Promise<void> {
    const n = Math.max(0, value || 0);
    const cur = { ...this.plans()[plan], [field]: field === 'price' ? n : n || null };
    const saved = await this.api.adminUpdatePlan(plan, {
      price: cur.price,
      accounts: cur.accounts,
      posts: cur.posts,
      devices: cur.devices,
      seats: cur.seats,
    });
    this.plans.update((p) =>
      toPlans([...Object.entries(p).map(([key, v]) => ({ key, ...v }) as ApiPlanSetting), saved]),
    );
  }

  async addPromo(code: string, discount: DiscountKey): Promise<void> {
    const p = await this.api.adminCreatePromo(code, discount);
    this.promos.update((list) => [toPromo(p), ...list]);
  }

  async setPromoActive(code: string, active: boolean): Promise<void> {
    const p = await this.api.adminSetPromoActive(code, active);
    this.promos.update((list) => list.map((x) => (x.code === p.code ? toPromo(p) : x)));
  }
}

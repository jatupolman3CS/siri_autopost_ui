import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { loadWithRetry } from './loading';
import { Customer, DiscountKey, LimitKey, PlanKey, PlanLimits, Promo, Transaction } from './models';
import { SEED } from './seed.data';
import { SessionStore } from './session.store';

export type AdminAction = 'suspend' | 'ban' | 'refund' | 'assist' | 'restore';

const LIMIT_KEYS: LimitKey[] = ['accounts', 'posts', 'devices', 'seats'];
/** How many entries of the platform-wide activity log are read (plan and promo changes are the ones shown). */
const GLOBAL_AUDIT_TAKE = 100;

const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/**
 * [year, month0, day] on the Bangkok calendar, where the server counts the months of money (revenue, the
 * "this month" of the finance page) and the days of charges and promo codes. Bangkok has no daylight saving.
 */
export function bangkokParts(date: Date | string): number[] {
  const d = new Date(new Date(date).getTime() + BANGKOK_OFFSET_MS);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

export function toCustomer(c: ApiCustomer): Customer {
  const [sinceYear, sinceMonth] = bangkokParts(c.since);
  const limits: Partial<Record<LimitKey, number>> = {};
  for (const k of LIMIT_KEYS) if (c.limits[k] != null) limits[k] = c.limits[k]!;
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    plan: c.plan,
    status: c.status === 'past_due' ? 'pastdue' : c.status,
    since: [sinceYear, sinceMonth],
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
    hasSubscription: c.hasSubscription,
    renewsAt: c.renewsAt ? new Date(c.renewsAt) : null,
    cancelAtPeriodEnd: c.cancelAtPeriodEnd,
  };
}

const toTx = (t: ApiTransaction): Transaction => ({
  id: t.id,
  date: bangkokParts(t.createdAt),
  cust: t.userId,
  type: t.type,
  amount: t.amount,
  refundable: t.refundable,
  refundOf: t.refundOfId,
  receiptUrl: t.receiptUrl,
});

const toPromo = (p: ApiPromo): Promo => ({
  code: p.code,
  discount: p.discount as DiscountKey,
  uses: p.uses,
  expires: bangkokParts(p.expiresAt),
  expiresAt: new Date(p.expiresAt),
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
// plans from the public /api/plans, which the customer-facing pages read too. Charges and
// refunds are what Stripe reports; refunding and retrying a charge go through Stripe. The admin
// pages call load() whenever they are entered, and every action re-reads what it may have moved
// (the money, the health figures, the customer's activity log). The data belongs to the signed-in
// user: another sign-in (or an assist session) empties it, and an answer for the previous one is dropped.
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

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
  /** Platform-wide activity log (plan settings and promo codes belong to no customer), newest first. */
  readonly globalAudit = signal<ApiAuditEntry[]>([]);
  /** Everything has arrived at least once for this user: the pages show "—" instead of zeros until then. */
  readonly loaded = signal(false);
  private generation = 0;
  private lastUser = this.session.user()?.id ?? null;

  constructor() {
    const userId = computed(() => this.session.user()?.id ?? null);
    // Only a different user empties the data; the effect's first run (the same user) must not drop a load
    // that has already started.
    effect(() => {
      const id = userId();
      untracked(() => {
        if (id === this.lastUser) return;
        this.lastUser = id;
        this.reset();
      });
    });
  }

  /** Forgets everything of the previous user (the plans are public and stay). */
  private reset(): void {
    this.generation++;
    this.customers.set([]);
    this.transactions.set([]);
    this.promos.set([]);
    this.subs.set({ basic: 0, pro: 0, agency: 0 });
    this.revenue.set([]);
    this.jobs.set([]);
    this.customerJobs.set({});
    this.health.set(null);
    this.audit.set({});
    this.globalAudit.set([]);
    this.loaded.set(false);
  }

  async loadPlans(): Promise<void> {
    try {
      this.plans.set(toPlans(await this.api.plans()));
    } catch {
      // Keep the design's values; the server refuses changes that do not fit its own.
    }
  }

  /**
   * Everything the admin pages show. Called each time an admin page is entered; it never throws: a server
   * that is down is retried a few times, and `loaded` says whether the data came.
   */
  async load(): Promise<void> {
    const gen = this.generation;
    const ok = await loadWithRetry(
      async () => {
        const [customers, tx, promos, summary, jobs, health, audit] = await Promise.all([
          this.api.adminCustomers(),
          this.api.adminTransactions(),
          this.api.adminPromos(),
          this.api.adminSummary(),
          this.api.adminJobs(undefined, 40),
          this.api.adminHealth(),
          this.api.adminAudit(undefined, GLOBAL_AUDIT_TAKE),
          this.loadPlans(),
        ]);
        if (gen !== this.generation) return;
        this.health.set(health);
        this.customers.set(customers.map(toCustomer));
        this.transactions.set(tx.map(toTx));
        this.promos.set(promos.map(toPromo));
        this.subs.set({ basic: summary.basic, pro: summary.pro, agency: summary.agency });
        this.revenue.set(summary.revenue.map((r) => [r.year, r.month - 1, r.amount]));
        this.jobs.set(jobs);
        this.globalAudit.set(audit);
        this.loaded.set(true);
      },
      () => gen === this.generation,
    );
    if (!ok && gen === this.generation) this.loaded.set(false);
  }

  async loadCustomerJobs(id: string): Promise<void> {
    const gen = this.generation;
    const list = await this.api.adminJobs(id, 8);
    if (gen === this.generation) this.customerJobs.update((m) => ({ ...m, [id]: list }));
  }

  async loadAudit(id: string): Promise<void> {
    const gen = this.generation;
    const list = await this.api.adminAudit(id, 30);
    if (gen === this.generation) this.audit.update((m) => ({ ...m, [id]: list }));
  }

  async loadGlobalAudit(): Promise<void> {
    const gen = this.generation;
    const list = await this.api.adminAudit(undefined, GLOBAL_AUDIT_TAKE);
    if (gen === this.generation) this.globalAudit.set(list);
  }

  async loadHealth(): Promise<void> {
    const gen = this.generation;
    const health = await this.api.adminHealth();
    if (gen === this.generation) this.health.set(health);
  }

  customer(id: string): Customer | undefined {
    return this.customers().find((c) => c.id === id);
  }

  private replace(c: ApiCustomer): void {
    const next = toCustomer(c);
    this.customers.update((list) => list.map((x) => (x.id === next.id ? next : x)));
  }

  private async reloadMoney(): Promise<void> {
    const gen = this.generation;
    const [tx, summary] = await Promise.all([
      this.api.adminTransactions(),
      this.api.adminSummary(),
    ]);
    if (gen !== this.generation) return;
    this.transactions.set(tx.map(toTx));
    this.subs.set({ basic: summary.basic, pro: summary.pro, agency: summary.agency });
    this.revenue.set(summary.revenue.map((r) => [r.year, r.month - 1, r.amount]));
  }

  /**
   * Re-reads what an admin action may have moved, so no page keeps showing the old figures: the money
   * (transactions, subscriber counts, revenue), the health numbers (MRR, devices, success rate) and the
   * customer's activity log. A refresh that fails leaves what is shown; the action itself has succeeded.
   */
  private async refreshAfter(
    id: string | null,
    what: { money?: boolean; health?: boolean } = {},
  ): Promise<void> {
    await Promise.allSettled([
      what.money ? this.reloadMoney() : undefined,
      what.health ? this.loadHealth() : undefined,
      id ? this.loadAudit(id) : this.loadGlobalAudit(),
    ]);
  }

  /**
   * Runs an admin action. A refund refunds txId, or the customer's latest charge, through Stripe.
   * "assist" only keeps the note (the page signs in as the customer, see SessionStore.startAssist).
   * The note is saved with every action.
   */
  async apply(id: string, action: AdminAction, txId?: string, note?: string): Promise<void> {
    if (note?.trim()) this.replace(await this.api.adminSetNote(id, note.trim()));
    const status: Partial<Record<AdminAction, ApiCustomerStatus>> = {
      suspend: 'suspended',
      ban: 'banned',
      restore: 'active',
    };
    if (status[action]) this.replace(await this.api.adminSetStatus(id, status[action]!));
    if (action === 'refund')
      await (txId ? this.api.adminRefund(txId) : this.api.adminRefundLatest(id));
    // A suspended customer's subscription stops counting in the MRR, a refund moves the revenue. "Assist" and
    // a note change nothing of that: only the activity log.
    await this.refreshAfter(id, action === 'assist' ? {} : { money: true, health: true });
  }

  async setPlan(id: string, plan: PlanKey): Promise<void> {
    this.replace(await this.api.adminSetPlan(id, plan));
    await this.refreshAfter(id, { money: true, health: true });
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
    await this.refreshAfter(id);
  }

  async revokeDevice(id: string, index: number): Promise<void> {
    const d = this.customer(id)?.devices[index];
    if (!d) return;
    this.replace(await this.api.adminRevokeDevice(id, d.id));
    await this.refreshAfter(id, { health: true });
  }

  async togglePaused(id: string): Promise<void> {
    const c = this.customer(id);
    if (!c) return;
    this.replace(await this.api.adminSetPaused(id, !c.paused));
    await this.refreshAfter(id, { health: true });
  }

  /** Moves failed posts back to the queue; returns how many. */
  async retryFailed(id: string): Promise<number> {
    const n = await this.api.adminRetryFailed(id);
    const gen = this.generation;
    const [customers, jobs] = await Promise.all([
      this.api.adminCustomers(),
      this.api.adminJobs(undefined, 40),
    ]);
    if (gen === this.generation) {
      this.customers.set(customers.map(toCustomer));
      this.jobs.set(jobs);
    }
    if (this.customerJobs()[id]) await this.loadCustomerJobs(id);
    await this.refreshAfter(id, { health: true });
    return n;
  }

  /** Asks Stripe to collect a failed invoice again; when it works the row becomes a paid charge. */
  async retryCharge(txId: string): Promise<Customer | undefined> {
    const tx = await this.api.adminRetryPayment(txId);
    await this.reloadMoney();
    const gen = this.generation;
    const customers = await this.api.adminCustomers();
    if (gen === this.generation) this.customers.set(customers.map(toCustomer));
    await this.refreshAfter(tx.userId, { health: true });
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
    await this.refreshAfter(null, { health: true });
  }

  async addPromo(code: string, discount: DiscountKey): Promise<void> {
    const p = await this.api.adminCreatePromo(code, discount);
    this.promos.update((list) => [toPromo(p), ...list]);
    await this.refreshAfter(null);
  }

  async setPromoActive(code: string, active: boolean): Promise<void> {
    const p = await this.api.adminSetPromoActive(code, active);
    this.promos.update((list) => list.map((x) => (x.code === p.code ? toPromo(p) : x)));
    await this.refreshAfter(null);
  }
}

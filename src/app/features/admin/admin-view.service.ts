import { Injectable, computed, inject } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import {
  Customer,
  CustomerStatus,
  LimitKey,
  PlanKey,
  STATUS_DOT,
  TxType,
} from '../../core/data/models';
import { perMonth } from '../../core/data/plans';
import { SEED } from '../../core/data/seed.data';
import { baht, displayYear, fmtDate, hm, monthName } from '../../core/i18n/format';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import { ApiAdminJob, ApiAuditAction, ApiAuditEntry } from '../../core/http/api.service';

export const CUSTOMER_STATUS: Record<
  CustomerStatus,
  ['sActive' | 'sTrial' | 'sPastDue' | 'sSuspended' | 'sBanned', string]
> = {
  active: ['sActive', 'var(--color-success)'],
  trial: ['sTrial', 'var(--color-primary)'],
  pastdue: ['sPastDue', 'var(--color-warning)'],
  suspended: ['sSuspended', 'var(--color-danger)'],
  banned: ['sBanned', 'var(--color-danger)'],
};

export interface JobRow {
  time: string;
  customer: string;
  customerId?: string;
  icon: string;
  platformName: string;
  target: string;
  text: string;
  dot: string;
  statusLabel: string;
}

// View helpers shared by the platform-admin screens. Provided by admin.routes.ts.
@Injectable()
export class AdminViewService {
  private readonly admin = inject(AdminStore);
  private readonly i18n = inject(I18nService);

  /**
   * MRR per paid plan: what every paying customer (active or past due) pays a month at their own
   * billing cycle. The same definition as the server's (GET /api/admin/health).
   */
  readonly mrr = computed(() => {
    const t = this.i18n.t();
    const paying = this.admin
      .customers()
      .filter((c) => (c.status === 'active' || c.status === 'pastdue') && c.plan !== 'free');
    const rows = (['basic', 'pro', 'agency'] as const).map((k) => {
      const mine = paying.filter((c) => c.plan === k);
      return { k, amt: mine.reduce((n, c) => n + this.priceOf(c), 0), subs: mine.length };
    });
    const total = rows.reduce((n, x) => n + x.amt, 0);
    const max = Math.max(1, ...rows.map((x) => x.amt));
    const ready = this.admin.loaded();
    return {
      total,
      // "—" until the customers have arrived, not ฿0 and 0 subscribers.
      rows: rows.map((x) => ({
        name: t.plans[x.k].name,
        amount: ready ? baht(x.amt) : '—',
        subs: ready ? x.subs : '—',
        pct: ready ? Math.round((x.amt / max) * 100) : 0,
      })),
    };
  });

  /** All transactions, newest first. */
  readonly txRows = computed(() => {
    const refunded = new Set(this.admin.transactions().map((x) => x.refundOf));
    const t = this.i18n.t().adm;
    const li = this.i18n.li();
    const TY: Record<TxType, [string, string]> = {
      charge: [t.tyCharge, 'var(--color-success)'],
      refund: [t.tyRefund, 'var(--color-warning)'],
      failed: [t.tyFailed, 'var(--color-danger)'],
    };
    const name = (id: string) => this.admin.customer(id)?.name ?? '';
    return [...this.admin.transactions()]
      .sort((a, b) => txDate(b.date).getTime() - txDate(a.date).getTime())
      .map((x) => ({
        id: x.id,
        cust: x.cust,
        raw: x,
        date: fmtDate(txDate(x.date), li),
        customer: name(x.cust),
        type: TY[x.type][0],
        dot: TY[x.type][1],
        amount: (x.type === 'refund' ? '−' : '') + baht(x.amount),
        canRetry: x.type === 'failed',
        canRefund: !!x.refundable && !refunded.has(x.id),
      }));
  });

  /** One activity-log row: when, what, the values involved, and who did it. */
  auditRow(e: ApiAuditEntry) {
    const t = this.i18n.t();
    const plan = (k: string | null) => (k && k in t.plans ? t.plans[k as PlanKey].name : (k ?? ''));
    const status = (k: string | null) => {
      const s = (k === 'past_due' ? 'pastdue' : k) as CustomerStatus | null;
      return s && s in CUSTOMER_STATUS ? t.adm[CUSTOMER_STATUS[s][0]] : (k ?? '');
    };
    const detail: Partial<Record<ApiAuditAction, string>> = {
      plan_changed: `${plan(e.from)} → ${plan(e.to)}`,
      status_changed: `${status(e.from)} → ${status(e.to)}`,
      pause_changed: e.to === 'paused' ? t.adm.pauseJobs : t.adm.resumeJobs,
      limits_changed: e.to ?? '',
      note_changed: e.to ?? '',
      device_revoked: e.to ?? '',
      failed_retried: e.to ?? '',
      refunded: e.to ? baht(Number(e.to)) : '',
      payment_recorded: e.to ? baht(Number(e.to)) : '',
      payment_retried: e.to ? baht(Number(e.to)) : '',
    };
    const at = new Date(e.at);
    return {
      id: e.id,
      time: `${fmtDate(at, this.i18n.li())} ${hm(at)}`,
      label: t.api.actions[e.action],
      detail: detail[e.action] ?? '',
      // A change Stripe made on its own has no person behind it.
      by: fmt(t.api.auditBy, { e: e.actorEmail || t.api.auditSystem }),
    };
  }

  statusLabel(c: Customer): { label: string; dot: string } {
    const [key, dot] = CUSTOMER_STATUS[c.status];
    return { label: this.i18n.t().adm[key], dot };
  }

  /** Plan limits with this customer's overrides applied (null = unlimited). */
  effectiveLimits(c: Customer): Record<LimitKey, number | null> {
    const p = this.admin.plans()[c.plan];
    const o = c.limits ?? {};
    const pick = (k: LimitKey) => (o[k] !== undefined ? Number(o[k]) || null : p[k]);
    return {
      devices: pick('devices'),
      accounts: pick('accounts'),
      posts: pick('posts'),
      seats: pick('seats'),
    };
  }

  since(c: Customer): string {
    const li = this.i18n.li();
    return `${monthName(c.since[1], li)} ${displayYear(c.since[0], li)}`;
  }

  /** What the customer pays per month at their own billing cycle (yearly is 20% off). */
  priceOf(c: Customer): number {
    return perMonth(this.admin.plans(), c.plan, c.cycle);
  }

  /** Admin jobs (newest first) as list rows. */
  jobRows(list: ApiAdminJob[]): JobRow[] {
    const t = this.i18n.t();
    return list.map((j) => {
      const platform = SEED.platforms[j.platform];
      const at = new Date(j.scheduledAt);
      return {
        time: `${fmtDate(at, this.i18n.li())} ${hm(at)}`,
        customer: j.customer,
        customerId: j.customerId,
        icon: platform.icon,
        platformName: platform.name,
        target: j.target,
        text: j.content,
        dot: STATUS_DOT[j.status],
        statusLabel: t.status[j.status],
      };
    });
  }

  /** A customer's newest jobs (loaded on demand by the detail page). */
  jobs(c: Customer, n: number): JobRow[] {
    return this.jobRows((this.admin.customerJobs()[c.id] ?? []).slice(0, n));
  }

  /** "now", "12 นาทีที่แล้ว", "3 วันที่แล้ว"... for last-seen times. */
  ago(d: Date | null): string {
    return ago(this.i18n.t(), d);
  }
}

export function txDate(parts: number[]): Date {
  return new Date(parts[0], parts[1], parts[2]);
}

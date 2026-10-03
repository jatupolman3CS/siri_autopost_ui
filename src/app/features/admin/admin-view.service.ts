import { Injectable, computed, inject } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { CLOCK } from '../../core/data/clock';
import {
  Customer,
  CustomerStatus,
  LimitKey,
  PostStatus,
  STATUS_DOT,
  TxType,
} from '../../core/data/models';
import { CONTENTS } from '../../core/data/sample';
import { SEED } from '../../core/data/seed.data';
import { baht, displayYear, fmtDate, hm, monthName } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';

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

  /** MRR per paid plan from subscriber counts and current prices. */
  readonly mrr = computed(() => {
    const plans = this.admin.plans();
    const t = this.i18n.t();
    const rows = (['basic', 'pro', 'agency'] as const).map((k) => ({
      k,
      amt: (plans[k].price || 0) * this.admin.subs[k],
      subs: this.admin.subs[k],
    }));
    const total = rows.reduce((n, x) => n + x.amt, 0);
    const max = Math.max(...rows.map((x) => x.amt));
    return {
      total,
      rows: rows.map((x) => ({
        name: t.plans[x.k].name,
        amount: baht(x.amt),
        subs: x.subs,
        pct: Math.round((x.amt / max) * 100),
      })),
    };
  });

  /** All transactions, newest first. */
  readonly txRows = computed(() => {
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
        canRefund: x.type === 'charge',
      }));
  });

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

  priceOf(c: Customer): number {
    return this.admin.plans()[c.plan].price || 0;
  }

  /** Recent jobs of a customer: deterministic sample around now, like the design prototype. */
  jobs(c: Customer, n: number): JobRow[] {
    const li = this.i18n.li();
    const t = this.i18n.t();
    let seed = 7;
    for (const ch of c.id) seed = (seed * 31 + ch.charCodeAt(0)) & 0x7fffffff;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const now = CLOCK.now.getTime();
    let tm = now + 20 * 60000;
    const out: (JobRow & { ts: number })[] = [];
    for (let i = 0; i < n; i++) {
      tm -= (7 + Math.floor(rnd() * 34)) * 60000;
      const tg = SEED.targets[Math.floor(rnd() * SEED.targets.length)];
      const r = rnd();
      const status: PostStatus = c.paused
        ? 'skipped'
        : tm > now
          ? 'queued'
          : i === 1 && c.jobs.running
            ? 'posting'
            : r < 0.1
              ? 'failed'
              : 'success';
      const platform = SEED.platforms[tg.p];
      out.push({
        ts: tm,
        time: hm(new Date(tm)),
        customer: c.name,
        icon: platform.icon,
        platformName: platform.name,
        target: tg.t[li],
        text: CONTENTS[Math.floor(rnd() * CONTENTS.length)][li],
        dot: STATUS_DOT[status],
        statusLabel: t.status[status],
      });
    }
    return out;
  }
}

export function txDate(parts: number[]): Date {
  return new Date(parts[0], parts[1], parts[2]);
}

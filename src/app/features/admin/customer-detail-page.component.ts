import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAction, AdminStore, bangkokParts } from '../../core/data/admin.store';
import { Customer, LimitKey, PLAN_ORDER, PlanKey } from '../../core/data/models';
import { baht, fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { AdminActionModalComponent, AdminActionRequest } from './admin-action-modal.component';
import { AdminViewService } from './admin-view.service';

const BLANK: Customer = {
  id: '',
  name: '…',
  email: '',
  plan: 'free',
  status: 'active',
  since: [new Date().getFullYear(), new Date().getMonth()],
  cycle: 'month',
  accounts: 0,
  seats: 1,
  ext: '',
  lastActive: null,
  paused: false,
  jobs: { ok: 0, failed: 0, queued: 0, running: 0 },
  devices: [],
};

@Component({
  selector: 'app-customer-detail-page',
  imports: [RouterLink, SelectFieldComponent, AdminActionModalComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-detail-page.component.html',
  styleUrl: './customer-detail-page.component.scss',
})
export class CustomerDetailPageComponent {
  /** Route param :id */
  readonly id = input.required<string>();

  private readonly notify = inject(NotificationService);
  private readonly admin = inject(AdminStore);
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(AdminViewService);
  protected readonly t = this.i18n.t;
  protected readonly request = signal<AdminActionRequest | null>(null);

  /** A blank row while the admin data loads (or for an unknown id). */
  protected readonly c = computed(() => this.admin.customer(this.id()) ?? BLANK);

  constructor() {
    // The store re-reads the activity log after every action; opening the page reads it once.
    effect(() => {
      const id = this.id();
      if (id)
        untracked(() => {
          this.admin.loadCustomerJobs(id).catch(() => undefined);
          this.admin.loadAudit(id).catch(() => undefined);
        });
    });
  }

  protected readonly auditRows = computed(() =>
    (this.admin.audit()[this.id()] ?? []).map((e) => this.view.auditRow(e)),
  );

  protected readonly head = computed(() => {
    const c = this.c();
    const st = this.view.statusLabel(c);
    return {
      initial: c.name.charAt(0).toUpperCase(),
      planName: this.t().plans[c.plan].name,
      statusLabel: st.label,
      dot: st.dot,
      since: this.view.since(c),
    };
  });

  protected readonly actions = computed(() => {
    const c = this.c();
    const list: AdminAction[] =
      c.status === 'banned'
        ? ['restore', 'assist']
        : c.status === 'suspended'
          ? ['restore', 'ban', 'refund', 'assist']
          : ['suspend', 'ban', 'refund', 'assist'];
    return list.map((a) => ({ a, label: this.t().adm[a], primary: a === 'restore' }));
  });

  protected readonly planOptions = computed(() =>
    PLAN_ORDER.map((k) => ({ value: k, label: this.t().plans[k].name })),
  );

  protected readonly tiles = computed(() => {
    const c = this.c();
    const a = this.t().adm;
    const li = this.i18n.li();
    const [nowYear, nowMonth] = bangkokParts(new Date());
    const months = Math.max(1, (nowYear - c.since[0]) * 12 + (nowMonth - c.since[1]) + 1);
    // Charges minus refunds recorded for this customer.
    const paid = this.admin
      .transactions()
      .filter((x) => x.cust === c.id)
      .reduce(
        (n, x) => n + (x.type === 'charge' ? x.amount : x.type === 'refund' ? -x.amount : 0),
        0,
      );
    // What Stripe will charge next: only a live subscription renews, and a cancelled one just ends.
    const renews = c.renewsAt ? fmtDate(c.renewsAt, li, true) : '';
    const next = c.hasSubscription && !c.cancelAtPeriodEnd;
    const period = this.view.priceOf(c) * (c.cycle === 'year' ? 12 : 1);
    const nextNote = !c.hasSubscription
      ? c.plan === 'free'
        ? ''
        : this.t().api.noCharge
      : c.cancelAtPeriodEnd
        ? fmt(this.t().api.endsOn, { date: renews })
        : `${c.cycle === 'year' ? a.cycleY : a.cycleM} · ${renews}`;
    return [
      {
        label: a.nextInvoice,
        value: next ? baht(period) : '—',
        note: nextNote,
      },
      { label: a.lifetime, value: baht(paid), note: `${months} ${a.months}` },
      {
        label: a.paymentStatus,
        value: c.status === 'pastdue' ? a.paymentFail : a.paymentOk,
        note: c.status === 'pastdue' ? a.nPastDue : '',
      },
    ];
  });

  protected readonly tx = computed(() => this.view.txRows().filter((x) => x.cust === this.c().id));

  protected readonly jobStats = computed(() => {
    const c = this.c();
    const a = this.t().adm;
    return [
      { label: a.jOk, value: c.jobs.ok },
      { label: a.jFailed, value: c.jobs.failed },
      { label: a.jQueued, value: c.jobs.queued },
      { label: a.jRunning, value: c.paused ? 0 : c.jobs.running },
    ];
  });
  protected readonly jobs = computed(() => this.view.jobs(this.c(), 8));

  protected readonly limitRows = computed(() => {
    const c = this.c();
    const a = this.t().adm;
    const lim = this.view.effectiveLimits(c);
    const planDef = this.admin.plans()[c.plan];
    const workspaces = c.workspaces ?? 1;
    // Accounts and posts are counted over all of the customer's workspaces (and so are the numbers here);
    // devices and seats are limits of each workspace, so with several the totals cannot be compared 1:1.
    // Posts are what went out in the last 24 hours (sent or waiting for a group admin), never the failed ones.
    // The API does not count a customer's groups, library images and library posts (the server counts them over
    // all the customer's workspaces), so those rows show only the limit in force (used = null).
    const rows: [LimitKey, string, number | null, boolean][] = [
      ['devices', a.devLimit, c.devices.length, true],
      ['accounts', a.accLimit, c.accounts, false],
      ['posts', a.postLimit, c.jobs.ok, false],
      ['seats', a.seatLimit, c.seats, true],
      ['groups', this.t().api.planLimit.groups, null, false],
      ['images', this.t().api.planLimit.images, null, false],
      ['libraryPosts', this.t().api.planLimit.libraryPosts, null, false],
    ];
    return rows.map(([k, label, used, perWorkspace]) => {
      const m = lim[k] ? String(lim[k]) : '∞';
      return {
        k,
        label,
        value: c.limits?.[k] !== undefined ? c.limits[k] : planDef[k] || 0,
        usedLabel:
          used === null
            ? fmt(this.t().api.limitInForce, { m })
            : fmt(perWorkspace && workspaces > 1 ? this.t().api.usedOfPerWs : a.usedOf, {
                n: used,
                m,
                w: workspaces,
              }),
      };
    });
  });

  protected readonly devices = computed(() =>
    this.c().devices.map((d) => ({
      name: d.n,
      browser: d.b,
      seen: d.online ? this.t().api.deviceOnline : this.view.ago(d.seen),
      icon: d.i,
    })),
  );

  protected run(action: AdminAction, tx?: string): void {
    this.request.set({ id: this.c().id, action, tx });
  }

  protected async setPlan(v: string): Promise<void> {
    const c = this.c();
    await this.admin.setPlan(c.id, v as PlanKey);
    this.notify.success(
      fmt(this.t().adm.planChanged, { c: c.name, p: this.t().plans[v as PlanKey].name }),
    );
  }

  protected setLimit(k: LimitKey, v: string): void {
    void this.admin.setLimit(this.c().id, k, parseInt(v, 10));
  }

  protected async revoke(i: number): Promise<void> {
    await this.admin.revokeDevice(this.c().id, i);
    this.notify.info(this.t().adm.revokeDone);
  }

  /** A suspended or banned customer is paused by the API, and cannot be resumed before being restored. */
  protected readonly blocked = computed(() => ['suspended', 'banned'].includes(this.c().status));

  protected async toggleJobs(): Promise<void> {
    const c = this.c();
    if (this.blocked() && c.paused) return;
    await this.admin.togglePaused(c.id);
    const a = this.t().adm;
    this.notify.show(
      c.paused ? 'success' : 'info',
      fmt(c.paused ? a.jobsResumed : a.jobsPaused, { c: c.name }),
    );
  }

  protected async retryFailed(): Promise<void> {
    const n = await this.admin.retryFailed(this.c().id);
    this.notify.info(n ? fmt(this.t().adm.retried, { n }) : this.t().api.nothingToRetry);
  }

  protected async retryCharge(txId: string): Promise<void> {
    const c = await this.admin.retryCharge(txId);
    this.notify.success(fmt(this.t().adm.chargeRetried, { c: c?.name ?? '' }));
  }

  /** Current page of this customer's invoices. */
  protected readonly txPager = new Pager(20);
  protected readonly pageTx = computed(() => this.txPager.slice(this.tx()));

  /** Current page of this customer's recent jobs. */
  protected readonly jobsPager = new Pager(20);
  protected readonly pageJobs = computed(() => this.jobsPager.slice(this.jobs()));

  /** Current page of this customer's activity log. */
  protected readonly auditPager = new Pager(20);
  protected readonly pageAudit = computed(() => this.auditPager.slice(this.auditRows()));

  /** Current page of the bound devices. */
  protected readonly devPager = new Pager(20);
  protected readonly pageDevices = computed(() => this.devPager.slice(this.devices()));
}

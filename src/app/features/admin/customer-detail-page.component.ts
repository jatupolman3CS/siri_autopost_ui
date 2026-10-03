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
import { AdminAction, AdminStore } from '../../core/data/admin.store';
import { Customer, LimitKey, PLAN_ORDER, PlanKey } from '../../core/data/models';
import { baht, fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
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
  imports: [RouterLink, SelectFieldComponent, AdminActionModalComponent],
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
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.admin.loadCustomerJobs(id));
    });
    // Every change to the customer row comes from an admin action: refresh their activity log.
    effect(() => {
      const c = this.admin.customer(this.id());
      if (c) untracked(() => void this.admin.loadAudit(c.id));
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
    const now = new Date();
    const months = Math.max(
      1,
      (now.getFullYear() - c.since[0]) * 12 + (now.getMonth() - c.since[1]) + 1,
    );
    // Charges minus refunds recorded for this customer.
    const paid = this.admin
      .transactions()
      .filter((x) => x.cust === c.id)
      .reduce(
        (n, x) => n + (x.type === 'charge' ? x.amount : x.type === 'refund' ? -x.amount : 0),
        0,
      );
    const active = ['active', 'pastdue', 'trial'].includes(c.status);
    const billable = active && c.plan !== 'free';
    const price = this.view.priceOf(c);
    const nextDate = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 1), li, true);
    return [
      {
        label: a.nextInvoice,
        value: billable ? baht(Math.round(price * (c.cycle === 'year' ? 12 * 0.8 : 1))) : '—',
        note: billable ? `${c.cycle === 'year' ? a.cycleY : a.cycleM} · ${nextDate}` : '',
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
    const rows: [LimitKey, string, number][] = [
      ['devices', a.devLimit, c.devices.length],
      ['accounts', a.accLimit, c.accounts],
      ['posts', a.postLimit, c.jobs.ok + c.jobs.failed],
      ['seats', a.seatLimit, c.seats],
    ];
    return rows.map(([k, label, used]) => ({
      k,
      label,
      value: c.limits?.[k] !== undefined ? c.limits[k] : planDef[k] || 0,
      usedLabel: fmt(a.usedOf, { n: used, m: lim[k] ? String(lim[k]) : '∞' }),
    }));
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

  protected saveLimits(): void {
    this.notify.success(fmt(this.t().adm.limitsSaved, { c: this.c().name }));
  }

  protected async revoke(i: number): Promise<void> {
    await this.admin.revokeDevice(this.c().id, i);
    this.notify.info(this.t().adm.revokeDone);
  }

  protected async toggleJobs(): Promise<void> {
    const c = this.c();
    await this.admin.togglePaused(c.id);
    const a = this.t().adm;
    this.notify.show(
      c.paused ? 'success' : 'info',
      fmt(c.paused ? a.jobsResumed : a.jobsPaused, { c: c.name }),
    );
  }

  protected async retryFailed(): Promise<void> {
    const n = await this.admin.retryFailed(this.c().id);
    if (n) this.notify.success(fmt(this.t().adm.retried, { n }));
  }

  protected async retryCharge(txId: string): Promise<void> {
    const c = await this.admin.retryCharge(txId);
    this.notify.success(fmt(this.t().adm.chargeRetried, { c: c?.name ?? '' }));
  }
}

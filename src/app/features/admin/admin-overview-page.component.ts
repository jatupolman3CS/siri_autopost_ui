import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { baht, signed } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-admin-overview-page',
  imports: [RouterLink, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-overview-page.component.html',
  styleUrl: './admin-overview-page.component.scss',
})
export class AdminOverviewPageComponent {
  private readonly admin = inject(AdminStore);
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(AdminViewService);
  protected readonly t = this.i18n.t;

  /** Live figures from /api/admin/health; "—" until they arrive. */
  protected readonly kpis = computed(() => {
    const a = this.t().adm;
    const api = this.t().api;
    const h = this.admin.health();
    const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`);
    if (!h) return [a.mrr, a.churn, a.dae, a.tsr].map((label) => ({ label, value: '—', note: '' }));
    const mrrChange = h.mrrPrev ? `${signed((100 * (h.mrr - h.mrrPrev)) / h.mrrPrev)}%` : '—';
    return [
      { label: a.mrr, value: baht(h.mrr), note: fmt(api.vs30, { d: mrrChange }) },
      {
        label: a.churn,
        value: pct(h.churn),
        note: fmt(api.churnVs, { d: signed(h.churn - h.churnPrev) }),
      },
      {
        label: a.dae,
        value: h.devicesActive.toLocaleString(),
        note: fmt(api.devicesActive, { n: h.devicesActive, total: h.devices }),
      },
      {
        label: a.tsr,
        value: pct(h.successRate),
        note: h.successRate == null ? api.noData : fmt(api.tsrVs, { p: pct(h.successRatePrev) }),
      },
    ];
  });
  protected readonly health = computed(() => {
    const api = this.t().api;
    const h = this.admin.health();
    if (!h) return [];
    const ok = 'var(--color-success)';
    const warn = 'var(--color-warning)';
    const onLatest =
      h.latestExtension && h.devices ? Math.round((100 * h.onLatestExtension) / h.devices) : null;
    return [
      {
        label: fmt(api.hApi, { n: h.apiSamples }),
        value: h.apiP95Ms == null ? '—' : `${h.apiP95Ms} ms`,
        dot: (h.apiP95Ms ?? 0) <= 500 ? ok : warn,
      },
      { label: api.hDb, value: `${h.dbMs} ms`, dot: h.dbMs <= 100 ? ok : warn },
      {
        label: api.hLive,
        value: `${h.eventStreams.toLocaleString()} · ${h.deviceWaits.toLocaleString()}`,
        dot: h.eventsDropped === 0 ? ok : warn,
      },
      {
        label: api.hQueue,
        value: `${h.queueDue.toLocaleString()} · ${h.queueNext24h.toLocaleString()}`,
        dot: h.queueDue === 0 ? ok : warn,
      },
      {
        label: fmt(api.hExt, { v: h.latestExtension ?? '—' }),
        value: onLatest == null ? '—' : `${onLatest}%`,
        dot: onLatest == null || onLatest >= 90 ? ok : warn,
      },
      {
        label: api.hErr,
        value: h.errorRate24h == null ? '—' : `${h.errorRate24h.toFixed(1)}%`,
        dot: (h.errorRate24h ?? 0) <= 10 ? ok : warn,
      },
      {
        label: api.hPay,
        value: h.paymentsConnected ? 'OK' : api.payNone,
        dot: h.paymentsConnected ? ok : warn,
      },
    ];
  });
  protected readonly attention = computed(() => {
    const a = this.t().adm;
    const cs = this.admin.customers();
    const latest = this.admin.health()?.latestExtension;
    // "—" until the customers have arrived, not "0 customers past due".
    const n = (v: number) => (this.admin.loaded() ? v : '—');
    return [
      {
        icon: 'ph-warning-circle',
        color: 'var(--color-warning)',
        text: fmt(a.aPastDue, { n: n(cs.filter((c) => c.status === 'pastdue').length) }),
        link: '/app/admin/finance',
      },
      {
        icon: 'ph-x-circle',
        color: 'var(--color-danger)',
        text: fmt(a.aFailedJobs, { n: n(cs.reduce((n, c) => n + c.jobs.failed, 0)) }),
        link: '/app/admin/jobs',
      },
      {
        icon: 'ph-arrow-circle-up',
        color: 'var(--color-text-muted)',
        text: fmt(a.aOldExt, {
          n: n(
            latest
              ? cs.filter((c) => c.ext && c.ext !== latest && c.status !== 'banned').length
              : 0,
          ),
        }),
        link: '/app/admin/customers',
      },
    ];
  });
  protected readonly recent = computed(() => this.view.txRows().slice(0, 5));

  /** Current page of the latest transactions. */
  protected readonly pager = new Pager(20);
  protected readonly pageRecent = computed(() => this.pager.slice(this.recent()));
}

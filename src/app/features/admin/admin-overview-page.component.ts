import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { baht } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-admin-overview-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().adm.title }}</h1>
          <p>{{ t().adm.sub }}</p>
        </div>
      </div>
      <div class="kpis">
        @for (k of kpis(); track k.label) {
          <div class="panel kpi">
            <span class="label">{{ k.label }}</span
            ><span class="value">{{ k.value }}</span
            ><span class="note">{{ k.note }}</span>
          </div>
        }
      </div>
      <div class="grid-2eq">
        <section class="panel">
          <h2 class="h2 mb8">{{ t().adm.mrrByPlan }}</h2>
          @for (r of view.mrr().rows; track r.name) {
            <div class="mrr">
              <div class="mrr-head">
                <span class="fw5">{{ r.name }}</span
                ><span
                  >{{ r.amount }} <span class="muted">· {{ r.subs }} {{ t().adm.subs }}</span></span
                >
              </div>
              <div class="bar thick"><span [style.width.%]="r.pct"></span></div>
            </div>
          }
        </section>
        <section class="panel">
          <h2 class="h2 mb4">{{ t().adm.health }}</h2>
          @for (h of health(); track h.label) {
            <div class="row h">
              <span class="dot" [style.background]="h.dot"></span
              ><span class="grow">{{ h.label }}</span
              ><span class="fw5">{{ h.value }}</span>
            </div>
          }
        </section>
      </div>
      <div class="grid-2eq">
        <section class="panel">
          <h2 class="h2 mb4">{{ t().adm.attention }}</h2>
          @for (a of attention(); track a.icon) {
            <div class="row att">
              <i class="ph" [class]="a.icon" [style.color]="a.color"></i>
              <span class="grow">{{ a.text }}</span>
              <a class="su-btn su-btn-sm su-btn-ghost" [routerLink]="a.link">{{
                t().adm.manage
              }}</a>
            </div>
          }
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2 class="h2">{{ t().adm.transactions }}</h2>
            <a class="su-btn su-btn-sm su-btn-ghost" routerLink="/app/admin/finance">{{
              t().common.viewAll
            }}</a>
          </div>
          @for (x of recent(); track x.id) {
            <div class="row tx">
              <span class="w64 muted">{{ x.date }}</span>
              <span class="grow ellipsis">{{ x.customer }}</span>
              <span class="status"
                ><span class="dot" [style.background]="x.dot"></span>{{ x.type }}</span
              >
              <span class="fw5 amt">{{ x.amount }}</span>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .mb4 {
      margin-bottom: 4px;
    }
    .mb8 {
      margin-bottom: 8px;
    }
    .mrr {
      padding: 8px 0;
    }
    .mrr-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 14px;
      flex-wrap: wrap;
    }
    .row.h {
      padding: 9px 0;
    }
    .row.att {
      padding: 6px 0;
      > .ph {
        font-size: 20px;
        flex-shrink: 0;
      }
    }
    .row.tx {
      padding: 8px 0;
    }
    .w64 {
      width: 64px;
      flex-shrink: 0;
    }
    .amt {
      width: 84px;
      text-align: right;
    }
  `,
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
    const signed = (n: number, digits = 1) =>
      `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;
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
    return [
      {
        icon: 'ph-warning-circle',
        color: 'var(--color-warning)',
        text: fmt(a.aPastDue, { n: cs.filter((c) => c.status === 'pastdue').length }),
        link: '/app/admin/finance',
      },
      {
        icon: 'ph-x-circle',
        color: 'var(--color-danger)',
        text: fmt(a.aFailedJobs, { n: cs.reduce((n, c) => n + c.jobs.failed, 0) }),
        link: '/app/admin/jobs',
      },
      {
        icon: 'ph-arrow-circle-up',
        color: 'var(--color-text-muted)',
        text: fmt(a.aOldExt, {
          n: latest
            ? cs.filter((c) => c.ext && c.ext !== latest && c.status !== 'banned').length
            : 0,
        }),
        link: '/app/admin/customers',
      },
    ];
  });
  protected readonly recent = computed(() => this.view.txRows().slice(0, 5));
}

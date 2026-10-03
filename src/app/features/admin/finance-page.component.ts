import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { CLOCK } from '../../core/data/clock';
import { baht, monthName } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { AdminActionModalComponent, AdminActionRequest } from './admin-action-modal.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-finance-page',
  imports: [AdminActionModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().nav.adminFinance }}</h1>
          <p>{{ t().adm.finSub }}</p>
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
          <h2 class="h2 mb12">{{ t().adm.revByMonth }}</h2>
          <div class="bars rev">
            @for (r of revBars(); track r.label) {
              <div class="col">
                <span>{{ r.amount }}</span>
                <div class="rbar" [style.height.%]="r.h"></div>
                <span>{{ r.label }}</span>
              </div>
            }
          </div>
        </section>
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
      </div>
      <section class="panel">
        <h2 class="h2 mb8">{{ t().adm.transactions }}</h2>
        <div class="tbl-wrap">
          <div class="tbl txs">
            <div class="th">{{ t().adm.date }}</div>
            <div class="th">{{ t().adm.customer }}</div>
            <div class="th">{{ t().adm.type }}</div>
            <div class="th">{{ t().adm.amount }}</div>
            <div class="th">{{ t().common.actions }}</div>
            @for (x of view.txRows(); track x.id) {
              <div class="td muted">{{ x.date }}</div>
              <div class="td fw5">{{ x.customer }}</div>
              <div class="td">
                <span class="status"
                  ><span class="dot" [style.background]="x.dot"></span>{{ x.type }}</span
                >
              </div>
              <div class="td">{{ x.amount }}</div>
              <div class="td tight">
                @if (x.canRetry) {
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-secondary"
                    (click)="retry(x.id)"
                  >
                    {{ t().adm.retryCharge }}
                  </button>
                }
                @if (x.canRefund) {
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-ghost"
                    (click)="request.set({ id: x.cust, action: 'refund', tx: x.id })"
                  >
                    {{ t().adm.refund }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </section>
    </div>
    <app-admin-action-modal [request]="request()" (closed)="request.set(null)" />
  `,
  styles: `
    .mb8 {
      margin-bottom: 8px;
    }
    .mb12 {
      margin-bottom: 12px;
    }
    .rev {
      height: 160px;
    }
    .rbar {
      width: 100%;
      max-width: 44px;
      background: var(--color-primary);
      border-radius: 4px 4px 0 0;
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
    .txs {
      grid-template-columns:
        minmax(90px, 1fr) minmax(200px, 2fr) minmax(130px, 1fr) minmax(100px, 1fr)
        max-content;
      min-width: 720px;
    }
  `,
})
export class FinancePageComponent {
  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(AdminViewService);
  protected readonly t = this.i18n.t;
  protected readonly request = signal<AdminActionRequest | null>(null);

  protected readonly kpis = computed(() => {
    const a = this.t().adm;
    const total = this.view.mrr().total;
    const y = CLOCK.now.getFullYear();
    const m = CLOCK.now.getMonth();
    const thisMonth = this.admin.transactions().filter((x) => x.date[0] === y && x.date[1] === m);
    const charges = thisMonth.filter((x) => x.type === 'charge');
    const failed = thisMonth.filter((x) => x.type === 'failed');
    const refunded = thisMonth.filter((x) => x.type === 'refund').reduce((n, x) => n + x.amount, 0);
    return [
      { label: a.mrr, value: baht(total), note: a.mrrNote },
      { label: a.arr, value: baht(total * 12), note: 'MRR × 12' },
      {
        label: a.collected,
        value: baht(charges.reduce((n, x) => n + x.amount, 0)),
        note: `${charges.length} ${a.tyCharge}`,
      },
      {
        label: a.failedCharges,
        value: failed.length,
        note: baht(failed.reduce((n, x) => n + x.amount, 0)),
      },
      { label: a.refunds, value: baht(refunded), note: a.refundsNote },
    ];
  });

  protected readonly revBars = computed(() => {
    const li = this.i18n.li();
    const max = Math.max(...this.admin.revenue.map((r) => r[2]));
    return this.admin.revenue.map((r) => ({
      label: monthName(r[1], li),
      amount: baht(Math.round(r[2] / 1000)) + 'k',
      h: Math.max(6, Math.round((r[2] / max) * 100)),
    }));
  });

  protected retry(txId: string): void {
    const c = this.admin.retryCharge(txId);
    this.notify.success(fmt(this.t().adm.chargeRetried, { c: c?.name ?? '' }));
  }
}

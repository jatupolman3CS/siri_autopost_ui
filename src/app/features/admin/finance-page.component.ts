import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { baht, monthName, signed } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { AdminActionModalComponent, AdminActionRequest } from './admin-action-modal.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-finance-page',
  imports: [AdminActionModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-page.component.html',
  styleUrl: './finance-page.component.scss',
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
    const h = this.admin.health();
    const mrrNote = h?.mrrPrev
      ? fmt(this.t().api.vs30, { d: `${signed((100 * (h.mrr - h.mrrPrev)) / h.mrrPrev)}%` })
      : '';
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const thisMonth = this.admin.transactions().filter((x) => x.date[0] === y && x.date[1] === m);
    const charges = thisMonth.filter((x) => x.type === 'charge');
    const failed = thisMonth.filter((x) => x.type === 'failed');
    const refunded = thisMonth.filter((x) => x.type === 'refund').reduce((n, x) => n + x.amount, 0);
    return [
      { label: a.mrr, value: baht(total), note: mrrNote },
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
    const rev = this.admin.revenue();
    const max = Math.max(1, ...rev.map((r) => r[2]));
    return rev.map((r) => ({
      label: monthName(r[1], li),
      amount: baht(Math.round(r[2] / 1000)) + 'k',
      h: Math.max(6, Math.round((r[2] / max) * 100)),
    }));
  });

  protected async retry(txId: string): Promise<void> {
    const c = await this.admin.retryCharge(txId);
    this.notify.success(fmt(this.t().adm.chargeRetried, { c: c?.name ?? '' }));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { baht } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-customers-page',
  imports: [RouterLink, InputFieldComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers-page.component.html',
  styleUrl: './customers-page.component.scss',
})
export class CustomersPageComponent {
  private readonly admin = inject(AdminStore);
  private readonly view = inject(AdminViewService);
  protected readonly t = inject(I18nService).t;
  protected readonly q = signal('');

  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.admin
      .customers()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .map((c) => {
        const lim = this.view.effectiveLimits(c);
        const st = this.view.statusLabel(c);
        const mrr = c.status === 'active' || c.status === 'pastdue' ? this.view.priceOf(c) : 0;
        return {
          id: c.id,
          link: ['/app/admin/customers', c.id],
          name: c.name,
          email: c.email,
          planName: this.t().plans[c.plan].name,
          dot: st.dot,
          statusLabel: st.label,
          mrr: baht(mrr),
          devices: `${c.devices.length} / ${lim.devices ? lim.devices : '∞'}`,
          jobs: `${c.jobs.ok} · ${c.jobs.failed} · ${c.jobs.queued}`,
        };
      });
  });

  /** Current page of the customer rows. */
  protected readonly pager = new Pager(20);
  protected readonly pageRows = computed(() => this.pager.slice(this.rows()));
}

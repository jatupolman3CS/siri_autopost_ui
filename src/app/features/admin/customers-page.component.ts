import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { baht } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-customers-page',
  imports: [RouterLink, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head end">
        <div>
          <h1>{{ t().nav.adminCustomers }}</h1>
          <p>{{ t().adm.custSub }}</p>
        </div>
        <app-input-field
          class="search"
          [label]="t().adm.search"
          [placeholder]="t().adm.search"
          [(value)]="q"
        />
      </div>
      <section class="panel">
        <div class="tbl-wrap">
          <div class="tbl cust">
            <div class="th">{{ t().adm.customer }}</div>
            <div class="th">{{ t().adm.plan }}</div>
            <div class="th">{{ t().common.status }}</div>
            <div class="th">MRR</div>
            <div class="th">{{ t().adm.devicesCol }}</div>
            <div class="th">{{ t().adm.jobsCol }}</div>
            <div class="th">{{ t().common.actions }}</div>
            @for (c of rows(); track c.id) {
              <div class="td col">
                <a class="link-btn" [routerLink]="c.link">{{ c.name }}</a>
                <span class="small muted">{{ c.email }}</span>
              </div>
              <div class="td">{{ c.planName }}</div>
              <div class="td">
                <span class="status"
                  ><span class="dot" [style.background]="c.dot"></span>{{ c.statusLabel }}</span
                >
              </div>
              <div class="td">{{ c.mrr }}</div>
              <div class="td">{{ c.devices }}</div>
              <div class="td">{{ c.jobs }}</div>
              <div class="td tight">
                <a class="su-btn su-btn-sm su-btn-secondary" [routerLink]="c.link">{{
                  t().adm.manage
                }}</a>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .end {
      align-items: flex-end;
    }
    .search {
      width: 320px;
      max-width: 100%;
    }
    .cust {
      grid-template-columns:
        minmax(220px, 2fr) minmax(80px, 1fr) minmax(110px, 1fr) minmax(80px, 1fr) minmax(90px, 1fr)
        minmax(150px, 1.2fr) max-content;
      min-width: 900px;
    }
  `,
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
}

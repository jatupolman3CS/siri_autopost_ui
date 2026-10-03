import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { DiscountKey, PLAN_ORDER, PlanKey, PlanLimits } from '../../core/data/models';
import { fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { txDate } from './admin-view.service';

@Component({
  selector: 'app-plans-page',
  imports: [InputFieldComponent, ModalComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().nav.adminPlans }}</h1>
          <p>{{ t().adm.plansSub }}</p>
        </div>
        <button type="button" class="su-btn su-btn-sm su-btn-primary" (click)="savePrices()">
          {{ t().adm.savePrices }}
        </button>
      </div>
      <div class="plans">
        @for (p of planRows(); track p.k) {
          <div class="panel plan">
            <div class="ph-head">
              <div class="pname">{{ p.name }}</div>
              <div class="small muted">{{ p.tag }}</div>
            </div>
            @for (f of p.fields; track f.key) {
              <div class="field-row">
                <span>{{ f.label }}</span>
                <input
                  type="number"
                  min="0"
                  class="num-input"
                  [value]="f.value"
                  (change)="setField(p.k, f.key, $any($event.target).value)"
                  [attr.aria-label]="f.label"
                />
              </div>
            }
            <div class="small muted hint">{{ t().adm.unlimitedHint }}</div>
          </div>
        }
      </div>
      <section class="panel promos">
        <div class="panel-head">
          <h2 class="h2">{{ t().adm.promos }}</h2>
          <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="openPromo()">
            <i class="ph ph-plus"></i>{{ t().adm.newPromo }}
          </button>
        </div>
        <div class="tbl-wrap">
          <div class="tbl promo-tbl">
            <div class="th">{{ t().adm.code }}</div>
            <div class="th">{{ t().adm.discount }}</div>
            <div class="th">{{ t().adm.uses }}</div>
            <div class="th">{{ t().adm.expires }}</div>
            <div class="th">{{ t().common.status }}</div>
            @for (p of promoRows(); track p.code) {
              <div class="td fw6">{{ p.code }}</div>
              <div class="td">{{ p.discount }}</div>
              <div class="td">{{ p.uses }}</div>
              <div class="td muted">{{ p.expires }}</div>
              <div class="td">
                <span class="status"
                  ><span class="dot" [style.background]="p.dot"></span>{{ p.status }}</span
                >
              </div>
            }
          </div>
        </div>
      </section>
    </div>

    <app-modal [open]="modal()" [title]="t().adm.newPromo" (closed)="modal.set(false)">
      <div class="form">
        <app-input-field
          [label]="t().adm.code"
          placeholder="NEWYEAR25"
          [(value)]="formCode"
          [error]="formErr()"
        />
        <app-select-field
          [label]="t().adm.discount"
          [options]="discountOptions()"
          [(value)]="formDiscount"
        />
      </div>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="modal.set(false)">
          {{ t().common.cancel }}
        </button>
        <button type="button" class="su-btn su-btn-sm su-btn-primary" (click)="confirmPromo()">
          {{ t().adm.newPromo }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .plans {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .plan {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ph-head {
      margin-bottom: 4px;
    }
    .pname {
      font-size: 18px;
      font-weight: 600;
    }
    .field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-top: 1px solid var(--color-border);
      font-size: 14px;
    }
    .hint {
      margin-top: 4px;
    }
    .promos {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .promo-tbl {
      grid-template-columns:
        minmax(120px, 1.4fr) minmax(90px, 1fr) minmax(60px, 0.7fr) minmax(110px, 1.2fr)
        minmax(100px, 1fr);
      gap: 0 8px;
      min-width: 520px;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class PlansPageComponent {
  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly modal = signal(false);
  protected readonly formCode = signal('');
  protected readonly formDiscount = signal<string>('d20');
  protected readonly formErr = signal('');

  protected readonly planRows = computed(() => {
    const t = this.t();
    const plans = this.admin.plans();
    const fields: [keyof PlanLimits, string][] = [
      ['price', t.adm.price],
      ['accounts', t.adm.limAccounts],
      ['posts', t.adm.limPosts],
      ['devices', t.adm.limDevices],
      ['seats', t.adm.limSeats],
    ];
    return PLAN_ORDER.map((k) => ({
      k,
      name: t.plans[k].name,
      tag: t.plans[k].tag,
      fields: fields.map(([key, label]) => ({ key, label, value: plans[k][key] || 0 })),
    }));
  });

  protected readonly promoRows = computed(() => {
    const a = this.t().adm;
    const li = this.i18n.li();
    return this.admin.promos().map((p) => ({
      code: p.code,
      discount: a[p.discount],
      uses: p.uses,
      expires: fmtDate(txDate(p.expires), li, true),
      dot: p.active ? 'var(--color-success)' : 'var(--color-border)',
      status: p.active ? a.pActive : a.pExpired,
    }));
  });

  protected readonly discountOptions = computed(() => {
    const a = this.t().adm;
    return (['d10', 'd20', 'd30', 'dFree'] as DiscountKey[]).map((k) => ({
      value: k,
      label: a[k],
    }));
  });

  protected setField(plan: PlanKey, field: keyof PlanLimits, v: string): void {
    void this.admin.setPlanField(plan, field, parseInt(v, 10));
  }

  protected savePrices(): void {
    this.notify.success(this.t().adm.pricesSaved);
  }

  protected openPromo(): void {
    this.formCode.set('');
    this.formDiscount.set('d20');
    this.formErr.set('');
    this.modal.set(true);
  }

  protected async confirmPromo(): Promise<void> {
    const code = this.formCode().trim().toUpperCase();
    if (code.length < 4 || code.length > 12) {
      this.formErr.set(this.t().adm.errCode);
      return;
    }
    await this.admin.addPromo(code, this.formDiscount() as DiscountKey);
    this.modal.set(false);
    this.notify.success(fmt(this.t().adm.promoCreated, { c: code }));
  }
}

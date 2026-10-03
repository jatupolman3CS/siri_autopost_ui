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
  templateUrl: './plans-page.component.html',
  styleUrl: './plans-page.component.scss',
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

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import {
  DiscountKey,
  PLAN_FEATURES,
  PLAN_ORDER,
  PlanField,
  PlanKey,
  Promo,
} from '../../core/data/models';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { AdminViewService, txDate } from './admin-view.service';

/** What the API accepts as a promo code (Promo.Create): letters and digits, 3-30, after trimming and upper-casing. */
export const PROMO_CODE_RE = new RegExp(
  `^[\\p{L}\\p{N}]{${INPUT_LIMITS.promoMin},${INPUT_LIMITS.promoMax}}$`,
  'u',
);

export type PromoStatus = 'active' | 'expired' | 'off';

/** Expired once its time has passed (whatever the switch says); switched off by the admin; else active. */
export function promoStatus(p: Pick<Promo, 'active' | 'expiresAt'>, now = new Date()): PromoStatus {
  if (p.expiresAt.getTime() < now.getTime()) return 'expired';
  return p.active ? 'active' : 'off';
}

@Component({
  selector: 'app-plans-page',
  imports: [InputFieldComponent, ModalComponent, SelectFieldComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans-page.component.html',
  styleUrl: './plans-page.component.scss',
})
export class PlansPageComponent {
  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(AdminViewService);
  protected readonly t = this.i18n.t;
  protected readonly limits = INPUT_LIMITS;

  protected readonly modal = signal(false);
  protected readonly busy = signal(false);
  protected readonly formCode = signal('');
  protected readonly formDiscount = signal<string>('d20');
  protected readonly formErr = signal('');

  protected readonly planRows = computed(() => {
    const t = this.t();
    const plans = this.admin.plans();
    // The seven numbers of a package (empty or 0 = unlimited); the functions it includes are fixed by the API.
    const fields: [PlanField, string][] = [
      ['price', t.adm.price],
      ['groups', t.api.planLimit.groups],
      ['images', t.api.planLimit.images],
      ['libraryPosts', t.api.planLimit.libraryPosts],
      ['posts', t.adm.limPosts],
      ['accounts', t.adm.limAccounts],
      ['devices', t.adm.limDevices],
      ['seats', t.adm.limSeats],
    ];
    return PLAN_ORDER.map((k) => {
      const included = PLAN_FEATURES.filter((f) => plans[k].features.includes(f));
      return {
        k,
        name: t.plans[k].name,
        tag: t.plans[k].tag,
        fields: fields.map(([key, label]) => ({ key, label, value: plans[k][key] || 0 })),
        // A read-only list: what a plan includes is decided in the API, not by an admin's edit.
        features: PLAN_FEATURES.map((f) => ({
          key: f,
          label: t.api.planFeature[f],
          included: included.includes(f),
        })),
      };
    });
  });

  protected readonly promoRows = computed(() => {
    const a = this.t().adm;
    const api = this.t().api;
    const li = this.i18n.li();
    return this.admin.promos().map((p) => {
      const st = promoStatus(p);
      return {
        code: p.code,
        discount: a[p.discount],
        uses: p.uses,
        expires: fmtDate(txDate(p.expires), li, true),
        dot: st === 'active' ? 'var(--color-success)' : 'var(--color-border)',
        status: st === 'active' ? a.pActive : st === 'expired' ? a.pExpired : api.promoInactive,
        // An expired code is over whatever its switch says; the others can be switched.
        canToggle: st !== 'expired',
        active: p.active,
        toggleLabel: p.active ? api.promoOff : api.promoOn,
      };
    });
  });

  /** Plan changes and promo codes belong to no customer: the platform-wide activity log shows them. */
  protected readonly planLog = computed(() =>
    this.admin
      .globalAudit()
      .filter((e) => ['plan_settings_changed', 'promo_created', 'promo_toggled'].includes(e.action))
      .slice(0, 12)
      .map((e) => this.view.auditRow(e)),
  );

  protected readonly discountOptions = computed(() => {
    const a = this.t().adm;
    return (['d10', 'd20', 'd30', 'dFree'] as DiscountKey[]).map((k) => ({
      value: k,
      label: a[k],
    }));
  });

  protected setField(plan: PlanKey, field: PlanField, v: string): void {
    void this.admin.setPlanField(plan, field, parseInt(v, 10));
  }

  /** Switches a code off or on (the API keeps its history and uses). */
  protected async togglePromo(code: string, active: boolean): Promise<void> {
    await this.admin.setPromoActive(code, !active);
    this.notify.info(
      fmt(active ? this.t().api.promoSwitchedOff : this.t().api.promoSwitchedOn, { c: code }),
    );
  }

  protected openPromo(): void {
    this.formCode.set('');
    this.formDiscount.set('d20');
    this.formErr.set('');
    this.modal.set(true);
  }

  protected async confirmPromo(): Promise<void> {
    const code = this.formCode().trim().toUpperCase();
    if (!PROMO_CODE_RE.test(code)) {
      this.formErr.set(
        fmt(this.t().api.errPromoChars, { min: INPUT_LIMITS.promoMin, max: INPUT_LIMITS.promoMax }),
      );
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.admin.addPromo(code, this.formDiscount() as DiscountKey);
    } catch {
      return; // the interceptor says why (taken, invalid); the dialog stays open
    } finally {
      this.busy.set(false);
    }
    this.modal.set(false);
    this.notify.success(fmt(this.t().adm.promoCreated, { c: code }));
  }

  /** Current page of the promo codes. */
  protected readonly promoPager = new Pager(20);
  protected readonly pagePromos = computed(() => this.promoPager.slice(this.promoRows()));

  /** Current page of the plan and promo activity log. */
  protected readonly logPager = new Pager(20);
  protected readonly pageLog = computed(() => this.logPager.slice(this.planLog()));
}

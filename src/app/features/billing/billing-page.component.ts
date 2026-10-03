import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { perMonth, tierViews } from '../../core/data/plans';
import { AccountsStore } from '../../core/data/accounts.store';
import { PostsStore } from '../../core/data/posts.store';
import { SessionStore } from '../../core/data/session.store';
import { BillingSettings, SettingsStore } from '../../core/data/settings.store';
import { DevicesStore } from '../../core/data/devices.store';
import { ApiService, ApiTransaction } from '../../core/http/api.service';
import { baht, fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { CycleSwitchComponent } from '../../shared/components/cycle-switch.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  PlanCard,
  PlanCardsComponent,
} from '../../shared/components/plan-cards/plan-cards.component';

@Component({
  selector: 'app-billing-page',
  imports: [
    CheckboxComponent,
    CycleSwitchComponent,
    InputFieldComponent,
    ModalComponent,
    PlanCardsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './billing-page.component.html',
  styleUrl: './billing-page.component.scss',
})
export class BillingPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly admin = inject(AdminStore);
  private readonly api = inject(ApiService);
  private readonly posts = inject(PostsStore);
  private readonly devices = inject(DevicesStore);
  private readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);
  private readonly accounts = inject(AccountsStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly t = this.i18n.t;
  protected readonly bill = this.settings.bill;

  protected readonly planModal = signal<PlanKey | null>(null);
  protected readonly cardModal = signal(false);
  protected readonly formNum = signal('');
  protected readonly formExp = signal('');
  protected readonly formCvc = signal('');
  protected readonly formErr = signal('');

  protected readonly planName = computed(() => this.t().plans[this.session.plan()].name);
  private readonly pm = computed(() =>
    perMonth(this.admin.plans(), this.session.plan(), this.bill().cycle),
  );
  protected readonly priceLabel = computed(
    () => baht(this.pm()) + (this.session.plan() === 'free' ? '' : this.t().common.perMonth),
  );
  protected readonly cycleLabel = computed(() =>
    this.bill().cycle === 'year'
      ? fmt(this.t().bill.billedYear, { amt: baht(this.pm() * 12) })
      : this.t().common.monthly,
  );

  protected readonly usageRows = computed(() => {
    const t = this.t();
    const lim = this.admin.plans()[this.session.plan()];
    const postsUsed = this.posts
      .today()
      .filter((p) => p.status === 'success' || p.status === 'posting').length;
    const usage: [string, number, number | null][] = [
      [t.common.accounts, this.accounts.list().length, lim.accounts],
      [t.common.postsToday, postsUsed, lim.posts],
      [t.common.devices, this.devices.list().length, lim.devices],
    ];
    return usage.map(([label, used, max]) => {
      const r = max ? used / max : 0;
      return {
        label,
        value: `${used} / ${max ? max : t.common.unlimited}`,
        pct: max ? Math.min(100, Math.round(r * 100)) : 100,
        color: !max
          ? 'var(--color-border)'
          : r > 1
            ? 'var(--color-danger)'
            : r >= 0.8
              ? 'var(--color-warning)'
              : 'var(--color-primary)',
      };
    });
  });

  /** The card on file expires next month in the sample data. */
  protected readonly cardWarn = computed(() => this.bill().card.exp === '11/26');

  protected readonly tiers = computed<PlanCard[]>(() => {
    const t = this.t();
    const plan = this.session.plan();
    return tierViews(this.admin.plans(), this.bill().cycle, t).map((p) => {
      const cur = p.k === plan;
      return {
        ...p,
        highlighted: cur,
        variant: cur ? 'secondary' : p.k === 'pro' || p.k === 'agency' ? 'primary' : 'secondary',
        cta: cur ? t.common.currentPlan : t.common.choose,
        disabled: cur,
      };
    });
  });

  private readonly txs = signal<ApiTransaction[]>([]);
  protected readonly promo = signal('');

  /** Charges and refunds recorded for this account (no payment provider is connected yet). */
  protected readonly invoices = computed(() => {
    const li = this.i18n.li();
    const t = this.t();
    return this.txs().map((x) => ({
      id: x.id,
      date: fmtDate(new Date(x.createdAt), li, true),
      amount: (x.type === 'refund' ? '−' : '') + baht(x.amount),
      label:
        x.type === 'charge' ? t.bill.paid : x.type === 'refund' ? t.adm.tyRefund : t.adm.tyFailed,
      dot:
        x.type === 'charge'
          ? 'var(--color-success)'
          : x.type === 'refund'
            ? 'var(--color-warning)'
            : 'var(--color-danger)',
    }));
  });

  constructor() {
    const cycle = this.session.user()?.cycle;
    if (cycle) this.settings.patchBill({ cycle });
    void this.loadInvoices();
  }

  private async loadInvoices(): Promise<void> {
    this.txs.set(await this.api.invoices());
  }

  protected readonly planTitle = computed(() => {
    const k = this.planModal();
    return k ? fmt(this.t().bill.confirmTitle, { plan: this.t().plans[k].name }) : '';
  });
  protected readonly isDowngrade = computed(() => {
    const k = this.planModal();
    return !!k && PLAN_ORDER.indexOf(k) < PLAN_ORDER.indexOf(this.session.plan());
  });

  protected setBill(patch: Partial<BillingSettings>): void {
    this.settings.patchBill(patch);
  }

  /** Changes the plan on the server; payment collection is not part of the API yet. */
  protected async confirmPlan(): Promise<void> {
    const k = this.planModal();
    if (!k) return;
    const before = this.txs().length;
    await this.session.setPlan(k, this.bill().cycle, this.promo().trim() || undefined);
    this.planModal.set(null);
    this.promo.set('');
    this.notify.success(fmt(this.t().bill.switched, { plan: this.t().plans[k].name }));
    await this.loadInvoices();
    const charge = this.txs().length > before ? this.txs()[0] : null;
    if (charge) this.notify.info(fmt(this.t().api.recordedCharge, { amt: baht(charge.amount) }));
  }

  protected openCard(): void {
    this.formNum.set('');
    this.formExp.set('');
    this.formCvc.set('');
    this.formErr.set('');
    this.cardModal.set(true);
  }

  /** Card form check only; real card details go to the payment provider, never this app. */
  protected confirmCard(): void {
    const num = this.formNum().replace(/\s/g, '');
    if (num.length < 12 || !/^\d{2}\/\d{2}$/.test(this.formExp()) || this.formCvc().length < 3) {
      this.formErr.set(this.t().bill.errCard);
      return;
    }
    this.settings.patchBill({ card: { last4: num.slice(-4), exp: this.formExp() } });
    this.cardModal.set(false);
    this.notify.success(this.t().bill.cardUpdated);
  }

  protected download(): void {
    this.notify.info(this.t().bill.download + ' (PDF)');
  }

  protected readonly paidPlan = computed(() => {
    const k = this.planModal();
    return !!k && (this.admin.plans()[k].price || 0) > 0;
  });
}

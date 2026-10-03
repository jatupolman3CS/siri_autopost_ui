import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { perMonth, tierViews } from '../../core/data/plans';
import { AccountsStore } from '../../core/data/accounts.store';
import { PostsStore } from '../../core/data/posts.store';
import { SessionStore } from '../../core/data/session.store';
import { BillingStore, Notifications, parseExpiry } from '../../core/data/billing.store';
import { SettingsStore } from '../../core/data/settings.store';
import { DevicesStore } from '../../core/data/devices.store';
import { ApiService, ApiTransaction } from '../../core/http/api.service';
import { problemOf } from '../../core/http/problem-details';
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

/** Luhn check of a card number (catches typos before anything is saved). */
function luhn(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1 && (d *= 2) > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

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
  protected readonly billing = inject(BillingStore);
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

  /** The card on file as the server has it (null: none), with its expiry state worked out there. */
  protected readonly cardView = computed(() => {
    const c = this.billing.card();
    if (!c) return null;
    const brands: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    };
    return {
      title: `${brands[c.brand] ?? this.t().api.cardGeneric} •••• ${c.last4}`,
      expiry: `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear % 100).padStart(2, '0')}`,
      state: c.expired ? ('expired' as const) : c.expiresSoon ? ('soon' as const) : ('ok' as const),
    };
  });

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

  /** A failure is toasted by the error interceptor; the store has put the old choice back. */
  protected setNotifications(patch: Partial<Notifications>): void {
    this.billing.saveNotifications(patch).catch(() => undefined);
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

  /**
   * Checks the card form, then sends the server only what a payment provider would hand back: the brand,
   * the last four digits and the expiry. The number and the CVC stay in this form.
   */
  protected async confirmCard(): Promise<void> {
    const num = this.formNum().replace(/\s/g, '');
    if (!luhn(num) || !parseExpiry(this.formExp()) || !/^\d{3,4}$/.test(this.formCvc())) {
      this.formErr.set(this.t().bill.errCard);
      return;
    }
    try {
      await this.billing.saveCard(num, this.formExp());
    } catch (e) {
      this.formErr.set(problemOf(e)?.title ?? this.t().bill.errCard);
      return;
    }
    this.formNum.set('');
    this.formCvc.set('');
    this.cardModal.set(false);
    this.notify.success(this.t().bill.cardUpdated);
  }

  protected async removeCard(): Promise<void> {
    await this.billing.removeCard();
    this.notify.info(this.t().api.cardRemoved);
  }

  /** Opens the server's printable statement of one charge or refund in a new tab. */
  protected async statement(id: string): Promise<void> {
    const blob = await this.api.invoiceStatement(id);
    const url = URL.createObjectURL(blob);
    if (!window.open(url, '_blank')) {
      // A blocked pop-up: save it as a file instead.
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${id.slice(0, 8)}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected readonly paidPlan = computed(() => {
    const k = this.planModal();
    return !!k && (this.admin.plans()[k].price || 0) > 0;
  });
}

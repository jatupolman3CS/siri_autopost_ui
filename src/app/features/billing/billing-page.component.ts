import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { BillingStore } from '../../core/data/billing.store';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { PermissionsService } from '../../core/data/permissions.service';
import { perMonth, tierViews } from '../../core/data/plans';
import { AdminStore } from '../../core/data/admin.store';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { baht, fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CycleSwitchComponent } from '../../shared/components/cycle-switch.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  PlanCard,
  PlanCardsComponent,
} from '../../shared/components/plan-cards/plan-cards.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

const EXPIRY_WARN_DAYS = 30;

// Plan, usage, card and invoices of the signed-in customer. Paying happens at Stripe: a paid plan opens
// Stripe Checkout, the card and invoices live in Stripe's billing portal, and the plan only changes when
// Stripe confirms (the webhook, or the return from Checkout handled here).
@Component({
  selector: 'app-billing-page',
  imports: [
    PagerComponent,
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
  /** ?checkout=success|cancel&session_id=cs_...: where Stripe Checkout sent the customer back to. */
  readonly checkout = input<string>();
  readonly sessionId = input<string | undefined>(undefined, { alias: 'session_id' });
  /** ?plan=pro: a plan picked on the landing page before signing up, to be bought now. */
  readonly plan = input<string>();

  private readonly notify = inject(NotificationService);
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly billing = inject(BillingStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly t = this.i18n.t;
  private readonly info = this.billing.info;

  protected readonly planModal = signal<PlanKey | null>(null);
  protected readonly promo = signal('');
  protected readonly busy = signal(false);

  private readonly cycle = computed(() => this.info()?.cycle ?? 'month');
  private readonly hasSubscription = computed(() => !!this.info()?.hasSubscription);
  private readonly cancelling = computed(() => !!this.info()?.cancelAtPeriodEnd);
  private readonly renewsAt = computed(() => {
    const d = this.info()?.renewsAt;
    return d ? fmtDate(new Date(d), this.i18n.li(), true) : '';
  });

  protected readonly planName = computed(() => this.t().plans[this.session.plan()].name);
  private readonly pm = computed(() =>
    perMonth(this.admin.plans(), this.session.plan(), this.cycle()),
  );
  protected readonly priceLabel = computed(
    () => baht(this.pm()) + (this.session.plan() === 'free' ? '' : this.t().common.perMonth),
  );
  protected readonly cycleLabel = computed(() =>
    this.session.plan() === 'free'
      ? this.t().api.freeNoRenewal
      : this.cycle() === 'year'
        ? fmt(this.t().bill.billedYear, { amt: baht(this.pm() * 12) })
        : this.t().common.monthly,
  );

  /** One line about what happens next with the plan. */
  protected readonly renewLine = computed(() => {
    const a = this.t().api;
    if (this.hasSubscription())
      return fmt(this.cancelling() ? a.endsOn : a.renewsOn, { date: this.renewsAt() });
    return this.session.plan() === 'free' ? '' : a.noCharge;
  });
  protected readonly pastDue = computed(() => this.session.user()?.status === 'past_due');
  protected readonly paymentsOff = computed(
    () => this.info() !== null && !this.info()!.paymentsEnabled,
  );

  protected readonly card = computed(() => {
    const c = this.info()?.card;
    if (!c) return null;
    const month = String(c.expMonth).padStart(2, '0');
    // A card is good through the last day of its expiry month.
    const endOfExpiry = new Date(c.expYear, c.expMonth, 1).getTime();
    return {
      label: `${c.brand.toUpperCase()} •••• ${c.last4}`,
      expires: `${month}/${String(c.expYear).slice(-2)}`,
      soon: endOfExpiry - Date.now() < EXPIRY_WARN_DAYS * 86_400_000,
    };
  });

  protected readonly usageRows = computed(() => {
    const t = this.t();
    const b = this.info();
    if (!b) return [];
    const usage: [string, number, number | null][] = [
      [t.common.accounts, b.usage.accounts, b.limits.accounts],
      [t.common.postsToday, b.usage.postsLast24h, b.limits.posts],
      [t.common.devices, b.usage.devices, b.limits.devices],
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

  protected readonly tiers = computed<PlanCard[]>(() => {
    const t = this.t();
    const plan = this.session.plan();
    const picked = this.settings.bill().cycle;
    return tierViews(this.admin.plans(), picked, t).map((p) => {
      const cur = p.k === plan;
      const sameCycle = p.k === 'free' || picked === this.cycle();
      // The current plan can still be chosen to switch its cycle, or to take back a scheduled cancellation.
      const resume = cur && this.cancelling();
      return {
        ...p,
        highlighted: cur,
        variant: cur ? 'secondary' : p.k === 'pro' || p.k === 'agency' ? 'primary' : 'secondary',
        cta: resume ? t.api.keepPlan : cur && sameCycle ? t.common.currentPlan : t.common.choose,
        // An admin looking at the customer's app (assist) can change nothing.
        disabled: (cur && sameCycle && !resume) || this.perm.assist(),
      };
    });
  });

  /** Charges and refunds on this account, newest first, with Stripe's invoice page when there is one. */
  protected readonly invoices = computed(() => {
    const li = this.i18n.li();
    const t = this.t();
    return this.billing.invoices().map((x) => ({
      id: x.id,
      date: fmtDate(new Date(x.createdAt), li, true),
      amount: (x.type === 'refund' ? '−' : '') + baht(x.amount),
      label:
        x.type === 'charge' ? t.bill.paid : x.type === 'refund' ? t.adm.tyRefund : t.adm.tyFailed,
      url: x.receiptUrl,
      dot:
        x.type === 'charge'
          ? 'var(--color-success)'
          : x.type === 'refund'
            ? 'var(--color-warning)'
            : 'var(--color-danger)',
    }));
  });

  // What confirming the open dialog does, which decides its text.
  private readonly action = computed<'checkout' | 'change' | 'cancel' | 'free' | 'resume'>(() => {
    const k = this.planModal();
    if (!k) return 'change';
    if (k === 'free') return this.hasSubscription() ? 'cancel' : 'free';
    if (!this.hasSubscription()) return 'checkout';
    return k === this.session.plan() && this.cancelling() ? 'resume' : 'change';
  });
  protected readonly invoicePager = new Pager(20);
  protected readonly invoicePage = computed(() => this.invoicePager.slice(this.invoices()));

  protected readonly planTitle = computed(() => {
    const k = this.planModal();
    return k ? fmt(this.t().bill.confirmTitle, { plan: this.t().plans[k].name }) : '';
  });
  protected readonly planBody = computed(() => {
    const a = this.t().api;
    const body = {
      checkout: a.checkoutBody,
      change: a.changeBody,
      cancel: fmt(a.cancelBody, { date: this.renewsAt() }),
      free: a.freeBody,
      resume: a.resumeBody,
    };
    return body[this.action()];
  });
  protected readonly confirmLabel = computed(() =>
    this.action() === 'checkout' ? this.t().api.goPay : this.t().common.confirm,
  );
  protected readonly isDowngrade = computed(() => {
    const k = this.planModal();
    return !!k && PLAN_ORDER.indexOf(k) < PLAN_ORDER.indexOf(this.session.plan());
  });
  /** A promo code is for the first invoice of a new subscription. */
  protected readonly askPromo = computed(
    () => this.action() === 'checkout' && (this.admin.plans()[this.planModal()!].price || 0) > 0,
  );

  constructor() {
    // A failed load is toasted by the error interceptor; the page just stays empty.
    void this.billing
      .load()
      .then(() => this.settings.patchBill({ cycle: this.cycle() }))
      .catch(() => undefined);
    // Arriving from Stripe Checkout (?checkout=...) or from sign-up with a plan (?plan=...).
    effect(() => {
      const checkout = this.checkout();
      const sessionId = this.sessionId();
      const plan = this.plan();
      untracked(() => void this.handleEntry(checkout, sessionId, plan));
    });
  }

  private async handleEntry(checkout?: string, sessionId?: string, plan?: string): Promise<void> {
    if (!checkout && !plan) return;
    await this.router.navigate([], { queryParams: {}, replaceUrl: true });
    const a = this.t().api;
    if (checkout === 'cancel') this.notify.info(a.checkoutCancelled);
    else if (checkout === 'success' && sessionId) {
      try {
        await this.session.confirmCheckout(sessionId);
        await this.billing.load();
        this.notify.success(
          fmt(a.checkoutDone, { plan: this.t().plans[this.session.plan()].name }),
        );
      } catch {
        // Not paid yet (or Stripe unreachable): the error is toasted; the webhook may still apply the plan.
        await this.billing.load().catch(() => undefined);
      }
    } else if (
      plan &&
      PLAN_ORDER.includes(plan as PlanKey) &&
      plan !== 'free' &&
      this.session.plan() === 'free'
    )
      this.planModal.set(plan as PlanKey);
  }

  protected async confirmPlan(): Promise<void> {
    const k = this.planModal();
    if (!k || this.busy() || this.perm.assist()) return;
    this.busy.set(true);
    try {
      const a = this.t().api;
      const action = this.action();
      const url = await this.session.setPlan(
        k,
        this.settings.bill().cycle,
        this.promo().trim() || undefined,
      );
      this.planModal.set(null);
      this.promo.set('');
      if (url) return this.billing.checkout(url); // pay at Stripe; the plan changes when it confirms
      await this.billing.load();
      const when = this.renewsAt();
      this.notify.success(
        action === 'cancel'
          ? fmt(a.cancelScheduled, { date: when })
          : action === 'resume'
            ? a.resumed
            : fmt(this.t().bill.switched, { plan: this.t().plans[k].name }),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async managePayment(): Promise<void> {
    if (this.busy() || this.perm.assist()) return;
    this.busy.set(true);
    try {
      await this.billing.openPortal();
    } finally {
      this.busy.set(false);
    }
  }
}

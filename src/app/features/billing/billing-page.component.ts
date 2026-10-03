import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { seedMonth } from '../../core/data/clock';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { perMonth, tierViews } from '../../core/data/plans';
import { AccountsStore } from '../../core/data/accounts.store';
import { PostsStore } from '../../core/data/posts.store';
import { SEED } from '../../core/data/seed.data';
import { SessionStore } from '../../core/data/session.store';
import { BillingSettings, SettingsStore } from '../../core/data/settings.store';
import { TeamStore } from '../../core/data/team.store';
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
  private readonly posts = inject(PostsStore);
  private readonly team = inject(TeamStore);
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
      [t.common.devices, this.team.devices().length, lim.devices],
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

  protected readonly invoices = computed(() => {
    const li = this.i18n.li();
    const amount = baht(this.admin.plans()[this.session.plan()].price || 0);
    return SEED.invoices.map((parts) => {
      const [y, m] = seedMonth(parts);
      return { date: fmtDate(new Date(y, m, 1), li, true), amount };
    });
  });

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
    await this.session.setPlan(k);
    this.planModal.set(null);
    this.notify.success(fmt(this.t().bill.switched, { plan: this.t().plans[k].name }));
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
}

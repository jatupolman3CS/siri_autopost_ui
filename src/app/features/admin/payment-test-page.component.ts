import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../core/data/admin.store';
import { ApiPaymentOverride, ApiService } from '../../core/http/api.service';
import { baht, fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { AdminViewService } from './admin-view.service';

/** The API's limits of the payment test (PaymentOverride.MaxAmount / MaxEmails). */
export const OVERRIDE_MAX_AMOUNT = 1_000_000;
export const OVERRIDE_MAX_EMAILS = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The e-mail addresses of a free-text box (one per line, or separated by commas/semicolons), lower-cased and without repeats. */
export function parseEmails(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (email && !out.includes(email)) out.push(email);
  }
  return out;
}

const AUDIT_ACTIONS = ['payment_override_changed', 'payment_override_used'];

// Admin: the real payment test. While it is on, the listed customers pay the test amount at Stripe instead of
// the plan's price (the API decides; this page only sets it). The server refuses what does not fit; the checks
// here only save the round trip and say why in the admin's language.
@Component({
  selector: 'app-payment-test-page',
  imports: [CheckboxComponent, InputFieldComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-test-page.component.html',
  styleUrl: './payment-test-page.component.scss',
})
export class PaymentTestPageComponent {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(AdminViewService);
  protected readonly t = this.i18n.t;

  /** What the API holds now; null until it has answered. */
  protected readonly saved = signal<ApiPaymentOverride | null>(null);
  protected readonly enabled = signal(false);
  protected readonly amountText = signal('');
  protected readonly emailsText = signal('');
  protected readonly busy = signal(false);
  /** Errors show once the admin has pressed save, not while the form is still being filled in. */
  protected readonly tried = signal(false);

  protected readonly min = computed(() => this.saved()?.minAmount ?? 10);

  protected readonly dirty = computed(() => {
    const s = this.saved();
    if (!s) return false;
    return (
      this.enabled() !== s.enabled ||
      this.amountText().trim() !== String(s.amount) ||
      parseEmails(this.emailsText()).join(',') !== s.emails.join(',')
    );
  });

  protected readonly amountError = computed(() => {
    const text = this.amountText().trim();
    const n = Number(text);
    if (text !== '' && Number.isInteger(n) && n >= this.min() && n <= OVERRIDE_MAX_AMOUNT)
      return '';
    return fmt(this.t().api.ptestAmountBad, {
      min: this.min(),
      max: OVERRIDE_MAX_AMOUNT.toLocaleString('en-US'),
    });
  });

  protected readonly emailsError = computed(() => {
    const a = this.t().api;
    const list = parseEmails(this.emailsText());
    if (list.length > OVERRIDE_MAX_EMAILS)
      return fmt(a.ptestEmailsTooMany, { max: OVERRIDE_MAX_EMAILS });
    const bad = list.find((e) => !EMAIL_RE.test(e) || e.length > 254);
    if (bad) return fmt(a.ptestEmailBad, { e: bad });
    // On for nobody would mean on for everybody's checkout: the API refuses it too.
    if (this.enabled() && list.length === 0) return a.ptestEmailsNeeded;
    return '';
  });

  /** One line saying what is in force right now (what the API holds, not the unsaved form). */
  protected readonly state = computed(() => {
    const s = this.saved();
    const a = this.t().api;
    if (!s) return '';
    return s.enabled
      ? fmt(a.ptestStateOn, { n: s.emails.length, amount: baht(s.amount) })
      : a.ptestStateOff;
  });

  protected readonly updated = computed(() => {
    const s = this.saved();
    if (!s?.updatedAt) return '';
    const at = new Date(s.updatedAt);
    return fmt(this.t().api.ptestUpdated, { t: `${fmtDate(at, this.i18n.li(), true)} ${hm(at)}` });
  });

  protected readonly amountHint = computed(() =>
    fmt(this.t().api.ptestAmountHint, { min: this.min() }),
  );
  protected readonly emailsHint = computed(() =>
    fmt(this.t().api.ptestEmailsHint, { max: OVERRIDE_MAX_EMAILS }),
  );

  protected readonly notes = computed(() => {
    const a = this.t().api;
    return [a.ptestNote1, a.ptestNote2, a.ptestNote3, a.ptestNote4];
  });

  /** Changes of the switch and the charges made with it, from the platform-wide activity log. */
  protected readonly log = computed(() =>
    this.admin
      .globalAudit()
      .filter((e) => AUDIT_ACTIONS.includes(e.action))
      .map((e) => this.view.auditRow(e)),
  );
  protected readonly logPager = new Pager(20);
  protected readonly pageLog = computed(() => this.logPager.slice(this.log()));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.show(await this.api.adminPaymentOverride());
    } catch {
      // The interceptor says why; the form stays hidden until the API has answered.
    }
  }

  private show(s: ApiPaymentOverride): void {
    this.saved.set(s);
    this.enabled.set(s.enabled);
    this.amountText.set(String(s.amount));
    this.emailsText.set(s.emails.join('\n'));
    this.tried.set(false);
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.tried.set(true);
    if (this.amountError() || this.emailsError()) return;
    this.busy.set(true);
    try {
      this.show(
        await this.api.adminSetPaymentOverride({
          enabled: this.enabled(),
          amount: Number(this.amountText().trim()),
          emails: parseEmails(this.emailsText()),
        }),
      );
    } catch {
      return; // the interceptor says why (for example Stripe's minimum); the form keeps what was typed
    } finally {
      this.busy.set(false);
    }
    this.notify.success(this.t().api.ptestSaved);
    void this.admin.loadGlobalAudit();
  }
}

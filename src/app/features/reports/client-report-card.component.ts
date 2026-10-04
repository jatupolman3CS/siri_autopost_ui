import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../core/data/permissions.service';
import { ReportsStore } from '../../core/data/reports.store';
import { fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { reportAddress } from './report-links';

// The "client report" card (Agency): what the report is, the button that opens the dialog, and the link of the
// last report made in this session with open, print and copy. The plan (Agency) is the owner's: below it the
// card says so and offers the upgrade to the owner; making a report is an admin's.
@Component({
  selector: 'app-client-report-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-report-card.component.html',
  styleUrl: './client-report-card.component.scss',
})
export class ClientReportCardComponent {
  readonly create = output<void>();

  protected readonly store = inject(ReportsStore);
  protected readonly perm = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** The owner's plan has client reports and the person is an admin. */
  protected readonly enabled = computed(() => this.store.canShare() && this.perm.canAdmin());
  protected readonly hint = computed(
    () => this.perm.adminHint() || (this.store.shareLocked() ? this.t().rep.clientLocked : ''),
  );

  protected readonly link = computed(() => {
    const share = this.store.lastShare();
    if (!share) return null;
    return {
      url: reportAddress(share.path),
      print: reportAddress(share.path, true),
      expires: fmt(this.t().api.engine.reportShareExpires, {
        d: fmtDate(new Date(share.expiresAt), this.i18n.li(), true),
      }),
    };
  });

  /** The links that are still live, each with its address, expiry and a label made of brand and period. */
  protected readonly live = computed(() =>
    (this.store.shares() ?? []).map((s) => ({
      id: s.id,
      url: reportAddress(s.path),
      label: fmt(this.t().api.engine.reportSharesItem, {
        brand: s.brand,
        period: s.period === 'month' ? this.t().rep.pMonth : this.t().rep.pWeek,
        d: fmtDate(new Date(s.expiresAt), this.i18n.li(), true),
      }),
    })),
  );

  constructor() {
    // Read the live links once an admin of an Agency workspace is looking at the card.
    effect(() => {
      if (this.enabled()) untracked(() => void this.store.ensureShares());
    });
  }

  protected async revoke(id: string): Promise<void> {
    if (await this.store.revokeShare(id))
      this.notify.success(this.t().api.engine.reportSharesRevoked);
  }

  protected async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.notify.success(this.t().api.engine.reportShareCopied);
    } catch {
      // No clipboard (or it refused): the link is shown in full to copy by hand.
    }
  }
}

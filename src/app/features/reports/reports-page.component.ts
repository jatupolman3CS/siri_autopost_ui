import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PermissionsService } from '../../core/data/permissions.service';
import { PLATFORMS } from '../../core/data/platforms';
import { canDisableGroup, isGroupOff, rateColor } from '../../core/data/report-math';
import { ReportDays, ReportsStore } from '../../core/data/reports.store';
import { ApiReportGroup } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { ChipComponent } from '../../shared/components/chip/chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ClientReportCardComponent } from './client-report-card.component';
import { ClientReportModalComponent } from './client-report-modal.component';

interface GroupRow {
  group: ApiReportGroup;
  icon: string;
  color: string;
  canDisable: boolean;
  off: boolean;
}

// "Reports": how each group and each post did over the last 7 or 30 days, and the client report (Agency).
// The numbers are real posts of paired accounts (no test posts, no sample accounts). Likes and comments are not
// collected, so their columns show a dash and the page says why. "Disable" switches the group's link off in every
// set that has its address (an editor's action).
@Component({
  selector: 'app-reports-page',
  imports: [
    ChipComponent,
    EmptyStateComponent,
    ClientReportCardComponent,
    ClientReportModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
})
export class ReportsPageComponent {
  protected readonly store = inject(ReportsStore);
  protected readonly perm = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  protected readonly dialog = signal(false);
  /** The group whose "disable" is being sent (one at a time, so a double click does not repeat it). */
  protected readonly disabling = signal<string | null>(null);
  protected readonly ranges: { days: ReportDays; label: () => string }[] = [
    { days: 7, label: () => this.t().rep.range7 },
    { days: 30, label: () => this.t().rep.range30 },
  ];

  protected readonly rows = computed<GroupRow[]>(() =>
    this.store.groups().map((group) => ({
      group,
      icon: PLATFORMS[group.platform].icon,
      color: rateColor(group.rate),
      canDisable: canDisableGroup(group),
      off: isGroupOff(group),
    })),
  );

  /** The post with the most uses gets the "top" badge (only when it was used at all). */
  protected readonly posts = computed(() =>
    this.store.posts().map((p, i) => ({ ...p, top: i === 0 && p.used > 0 })),
  );

  constructor() {
    // A visit after a while reads the numbers again (the first visit has just read them).
    this.store.ensureFresh();
  }

  protected setDays(days: ReportDays): void {
    this.store.setDays(days);
  }

  protected rowKey(g: ApiReportGroup): string {
    return g.linkId ?? `${g.name}|${g.url ?? ''}`;
  }

  protected async disable(row: GroupRow): Promise<void> {
    const key = this.rowKey(row.group);
    if (this.disabling()) return;
    this.disabling.set(key);
    try {
      const n = await this.store.disableGroup(row.group);
      if (n > 0) this.notify.info(fmt(this.t().rep.disabledMsg, { g: row.group.name }));
    } finally {
      this.disabling.set(null);
    }
  }
}

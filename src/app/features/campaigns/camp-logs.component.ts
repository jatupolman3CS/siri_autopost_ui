import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { fmtDateTime } from '../../core/ext/lib/shared.js';
import '../../core/i18n/i18n.ext';
import { I18nService } from '../../core/i18n/i18n.service';
import { CampaignActions } from './campaign-actions.service';

// The browser's activity log ("บันทึกการทำงาน"), newest last, as it reports it on each sync.
@Component({
  selector: 'app-camp-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './camp-logs.component.html',
  styleUrl: './camp-logs.component.scss',
})
export class CampLogsComponent {
  private readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  protected readonly lines = computed(() =>
    this.store
      .logs()
      .slice(-200)
      .map((l) => ({ level: l.level, time: fmtDateTime(l.t), msg: l.msg })),
  );

  protected clear(): void {
    void this.store.clearLogs();
  }
}

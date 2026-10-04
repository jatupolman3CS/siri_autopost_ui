import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { SessionStore } from '../../core/data/session.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { OverviewHubComponent } from './overview-hub.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

@Component({
  selector: 'app-overview-page',
  imports: [PagerComponent, RouterLink, OverviewHubComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.component.html',
  styleUrl: './overview-page.component.scss',
})
export class OverviewPageComponent {
  private readonly i18n = inject(I18nService);
  private readonly session = inject(SessionStore);
  private readonly workspaces = inject(WorkspaceStore);
  protected readonly t = this.i18n.t;
  protected readonly stats = inject(DashboardStatsService);

  protected readonly userName = this.session.name;
  protected readonly sub = computed(() =>
    fmt(this.t().ov.sub, { ws: this.workspaces.current()?.name ?? '' }),
  );
  protected readonly accountPager = new Pager(20);
  protected readonly accountPage = computed(() =>
    this.accountPager.slice(this.stats.accountRows()),
  );
  protected readonly nextIn = computed(() => {
    const m = this.stats.nextInMin();
    return m ? fmt(this.t().ov.nextIn, { m }) : '';
  });
}

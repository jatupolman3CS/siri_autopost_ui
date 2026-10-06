import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { SessionStore } from '../../core/data/session.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { OverviewHubComponent } from './overview-hub.component';

@Component({
  selector: 'app-overview-page',
  imports: [EmptyStateComponent, RouterLink, OverviewHubComponent],
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
  protected readonly nextIn = computed(() => {
    const m = this.stats.nextInMin();
    return m ? fmt(this.t().ov.nextIn, { m }) : '';
  });
}

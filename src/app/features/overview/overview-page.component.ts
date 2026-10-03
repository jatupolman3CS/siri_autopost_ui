import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { SessionStore } from '../../core/data/session.store';
import { TeamStore } from '../../core/data/team.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.component.html',
  styleUrl: './overview-page.component.scss',
})
export class OverviewPageComponent {
  private readonly i18n = inject(I18nService);
  private readonly session = inject(SessionStore);
  private readonly team = inject(TeamStore);
  protected readonly t = this.i18n.t;
  protected readonly stats = inject(DashboardStatsService);

  protected readonly userName = computed(() => this.session.user.name[this.i18n.li()]);
  protected readonly sub = computed(() => fmt(this.t().ov.sub, { ws: this.team.current().name }));
  protected readonly nextIn = computed(() => {
    const m = this.stats.nextInMin();
    return m ? fmt(this.t().ov.nextIn, { m }) : '';
  });
}

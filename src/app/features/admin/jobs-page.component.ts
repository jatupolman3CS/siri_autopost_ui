import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-jobs-page',
  imports: [RouterLink, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jobs-page.component.html',
  styleUrl: './jobs-page.component.scss',
})
export class JobsPageComponent {
  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  private readonly view = inject(AdminViewService);
  protected readonly t = inject(I18nService).t;

  private readonly live = computed(() =>
    this.admin.customers().filter((c) => c.status !== 'banned'),
  );

  protected readonly kpis = computed(() => {
    const a = this.t().adm;
    const ready = this.admin.loaded();
    const tot = this.live().reduce(
      (s, c) => ({
        running: s.running + (c.paused ? 0 : c.jobs.running),
        queued: s.queued + c.jobs.queued,
        failed: s.failed + c.jobs.failed,
        ok: s.ok + c.jobs.ok,
      }),
      { running: 0, queued: 0, failed: 0, ok: 0 },
    );
    // Nothing finished (or nothing loaded yet) is "—", not a 100% success rate.
    const rate =
      ready && tot.ok + tot.failed
        ? `${Math.round((tot.ok / (tot.ok + tot.failed)) * 1000) / 10}%`
        : '—';
    const n = (v: number) => (ready ? v : '—');
    return [
      { label: a.gRunning, value: n(tot.running), note: a.gRunningNote },
      { label: a.gQueued, value: n(tot.queued), note: a.gQueuedNote },
      { label: a.gFailed, value: n(tot.failed), note: a.gFailedNote },
      { label: a.gRate, value: rate, note: this.t().api.rate24Note },
    ];
  });

  protected readonly rows = computed(() => {
    const a = this.t().adm;
    return this.live().map((c) => ({
      id: c.id,
      name: c.name,
      planName: this.t().plans[c.plan].name,
      statusLabel: c.paused ? a.paused : a.running,
      dot: c.paused ? 'var(--color-warning)' : 'var(--color-success)',
      running: c.paused ? 0 : c.jobs.running,
      queued: c.jobs.queued,
      failed: c.jobs.failed,
      last: this.view.ago(c.lastActive),
      pauseLabel: c.paused ? a.resumeJobs : a.pauseJobs,
      // A suspended or banned customer is paused by the API and cannot be resumed before being restored.
      pauseOff: c.paused && ['suspended', 'banned'].includes(c.status),
    }));
  });

  /** Newest posts across the platform (accounts connected through the extension). */
  protected readonly globalJobs = computed(() => this.view.jobRows(this.admin.jobs().slice(0, 10)));

  protected async toggle(id: string): Promise<void> {
    const c = this.admin.customer(id);
    if (!c || (c.paused && ['suspended', 'banned'].includes(c.status))) return;
    await this.admin.togglePaused(id);
    const a = this.t().adm;
    this.notify.show(
      c.paused ? 'success' : 'info',
      fmt(c.paused ? a.jobsResumed : a.jobsPaused, { c: c.name }),
    );
  }

  protected async retry(id: string): Promise<void> {
    const n = await this.admin.retryFailed(id);
    this.notify.info(n ? fmt(this.t().adm.retried, { n }) : this.t().api.nothingToRetry);
  }

  /** Current page of the per-customer job rows. */
  protected readonly pager = new Pager(20);
  protected readonly pageRows = computed(() => this.pager.slice(this.rows()));

  /** Current page of the newest platform jobs. */
  protected readonly recentPager = new Pager(20);
  protected readonly pageJobs = computed(() => this.recentPager.slice(this.globalJobs()));
}

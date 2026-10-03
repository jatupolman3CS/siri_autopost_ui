import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { AdminViewService } from './admin-view.service';

@Component({
  selector: 'app-jobs-page',
  imports: [RouterLink],
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
    const tot = this.live().reduce(
      (s, c) => ({
        running: s.running + (c.paused ? 0 : c.jobs.running),
        queued: s.queued + c.jobs.queued,
        failed: s.failed + c.jobs.failed,
        ok: s.ok + c.jobs.ok,
      }),
      { running: 0, queued: 0, failed: 0, ok: 0 },
    );
    const rate =
      tot.ok + tot.failed ? Math.round((tot.ok / (tot.ok + tot.failed)) * 1000) / 10 : 100;
    return [
      { label: a.gRunning, value: tot.running, note: a.gRunningNote },
      { label: a.gQueued, value: tot.queued, note: a.gQueuedNote },
      { label: a.gFailed, value: tot.failed, note: a.gFailedNote },
      { label: a.gRate, value: rate + '%', note: a.tsrNote },
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
    }));
  });

  /** Newest posts across the platform (accounts connected through the extension). */
  protected readonly globalJobs = computed(() => this.view.jobRows(this.admin.jobs().slice(0, 10)));

  protected async toggle(id: string): Promise<void> {
    const c = this.admin.customer(id);
    if (!c) return;
    await this.admin.togglePaused(id);
    const a = this.t().adm;
    this.notify.show(
      c.paused ? 'success' : 'info',
      fmt(c.paused ? a.jobsResumed : a.jobsPaused, { c: c.name }),
    );
  }

  protected async retry(id: string): Promise<void> {
    const n = await this.admin.retryFailed(id);
    if (n) this.notify.success(fmt(this.t().adm.retried, { n }));
  }
}

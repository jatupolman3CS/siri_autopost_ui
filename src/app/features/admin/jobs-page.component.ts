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
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().nav.adminJobs }}</h1>
          <p>{{ t().adm.jobsSub }}</p>
        </div>
      </div>
      <div class="kpis">
        @for (k of kpis(); track k.label) {
          <div class="panel kpi">
            <span class="label">{{ k.label }}</span
            ><span class="value">{{ k.value }}</span
            ><span class="note">{{ k.note }}</span>
          </div>
        }
      </div>
      <section class="panel">
        <h2 class="h2 mb8">{{ t().adm.byCustomer }}</h2>
        <div class="tbl-wrap">
          <div class="tbl jobs">
            <div class="th">{{ t().adm.customer }}</div>
            <div class="th">{{ t().common.status }}</div>
            <div class="th">{{ t().adm.jRunning }}</div>
            <div class="th">{{ t().adm.jQueued }}</div>
            <div class="th">{{ t().adm.jFailed }}</div>
            <div class="th">{{ t().adm.lastActivity }}</div>
            <div class="th">{{ t().common.actions }}</div>
            @for (c of rows(); track c.id) {
              <div class="td col">
                <span class="fw5">{{ c.name }}</span
                ><span class="small muted">{{ c.planName }}</span>
              </div>
              <div class="td">
                <span class="status"
                  ><span class="dot" [style.background]="c.dot"></span>{{ c.statusLabel }}</span
                >
              </div>
              <div class="td">{{ c.running }}</div>
              <div class="td">{{ c.queued }}</div>
              <div class="td">{{ c.failed }}</div>
              <div class="td muted">{{ c.last }}</div>
              <div class="td tight">
                <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="toggle(c.id)">
                  {{ c.pauseLabel }}
                </button>
                <button
                  type="button"
                  class="su-btn su-btn-sm su-btn-ghost"
                  [disabled]="c.failed === 0"
                  (click)="retry(c.id)"
                >
                  {{ t().adm.retryFailed }}
                </button>
                <a
                  class="su-btn su-btn-sm su-btn-secondary"
                  [routerLink]="['/app/admin/customers', c.id]"
                  >{{ t().adm.manage }}</a
                >
              </div>
            }
          </div>
        </div>
      </section>
      <section class="panel">
        <h2 class="h2 mb4">{{ t().adm.recentJobs }}</h2>
        @for (p of globalJobs(); track $index) {
          <div class="row jr">
            <span class="time">{{ p.time }}</span>
            <span class="cust fw5 ellipsis">{{ p.customer }}</span>
            <span class="pico s28"><i class="ph" [class]="p.icon"></i></span>
            <div class="grow">
              <div class="ellipsis">{{ p.text }}</div>
              <div class="small muted">{{ p.platformName }} · {{ p.target }}</div>
            </div>
            <span class="status"
              ><span class="dot" [style.background]="p.dot"></span>{{ p.statusLabel }}</span
            >
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .mb4 {
      margin-bottom: 4px;
    }
    .mb8 {
      margin-bottom: 8px;
    }
    .jobs {
      grid-template-columns:
        minmax(200px, 2fr) minmax(110px, 1fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(
          70px,
          0.7fr
        )
        minmax(110px, 1fr) max-content;
      min-width: 900px;
    }
    .row.jr {
      padding: 8px 0;
    }
    .cust {
      width: 150px;
      flex-shrink: 0;
    }
  `,
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

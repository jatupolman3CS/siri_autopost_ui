import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { autoPauseLine } from '../../core/data/auto-pause-line';
import { DevicesStore, autoPauseOf } from '../../core/data/devices.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';

type DispatchState = 'ready' | 'offline' | 'paused' | 'auto';

interface DeviceRow {
  id: string;
  name: string;
  state: DispatchState;
  /** The line under the name: why it takes no jobs, or that it is ready. */
  line: string;
}

// "Hand-over to the extension" on the schedules page: a schedule queues its posts on the server and the extension
// of a paired browser takes them one at a time (it asks every 30 s), so what the person needs to see here is
// whether a browser is ready to take them, what waits in the queue, and a button to make it take the due post
// now. The extension's own settings are not needed for this and live on their own page.
@Component({
  selector: 'app-schedule-dispatch',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-dispatch.component.html',
  styleUrl: './schedule-dispatch.component.scss',
})
export class ScheduleDispatchComponent {
  private readonly i18n = inject(I18nService);
  private readonly posts = inject(PostsStore);
  private readonly notify = inject(NotificationService);
  protected readonly devices = inject(DevicesStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;

  /** The browser whose button was pressed and has not been answered yet. */
  protected readonly busy = signal<string | null>(null);

  protected readonly rows = computed<DeviceRow[]>(() => {
    const f = this.t().api.flow;
    const now = this.devices.now();
    return this.devices.list().map((d) => {
      const auto = autoPauseOf(d, now);
      const state: DispatchState = !d.online
        ? 'offline'
        : auto
          ? 'auto'
          : d.jobsPaused
            ? 'paused'
            : 'ready';
      const line =
        state === 'offline'
          ? f.dispOffline
          : state === 'auto'
            ? autoPauseLine(auto!, now, this.t(), this.i18n.li())
            : state === 'paused'
              ? f.dispPaused
              : f.dispReady;
      return { id: d.id, name: d.name, state, line };
    });
  });

  /** What a person reads about the queue: the post going out now, else how many wait today and the next one. */
  protected readonly queue = computed(() => {
    const f = this.t().api.flow;
    const today = this.posts.today();
    const posting = today.find((p) => p.status === 'posting');
    if (posting) return fmt(f.dispPosting, { g: posting.target });
    const queued = today.filter((p) => p.status === 'queued').length;
    const next = this.posts.next();
    return queued && next
      ? fmt(f.dispQueue, { n: queued, t: next.time })
      : queued
        ? fmt(f.dispQueue, { n: queued, t: '—' })
        : f.dispQueueEmpty;
  });

  protected dot(s: DispatchState): string {
    return s === 'ready'
      ? 'var(--color-success)'
      : s === 'offline'
        ? 'var(--color-danger)'
        : 'var(--color-warning)';
  }

  protected async take(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(id);
    try {
      await this.devices.takeJobs(id);
      this.notify.success(this.t().api.flow.dispTaken);
    } catch {
      // The error interceptor has toasted the API's reason; this says what was being done.
      this.notify.error(this.t().api.flow.dispTakeFailed);
    } finally {
      this.busy.set(null);
    }
  }

  protected async resume(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(id);
    try {
      await this.devices.update(id, { jobsPaused: false });
    } catch {
      // Toasted by the error interceptor.
    } finally {
      this.busy.set(null);
    }
  }
}

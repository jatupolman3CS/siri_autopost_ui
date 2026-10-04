import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ScheduleView, scheduleView } from './schedule-view';

// "All schedules": one row per schedule with its pairing, cadence, today's posts and next run, and the buttons
// to see it on the calendar, pause or resume it, and delete it. Pausing and deleting drop the schedule's future
// queued posts on the server; resuming queues the next fortnight again. Reading is for everyone, the buttons that
// change something are an editor's.
@Component({
  selector: 'app-schedule-list',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-list.component.html',
  styleUrl: './schedule-list.component.scss',
})
export class ScheduleListComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly posts = inject(PostsStore);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(SchedulesStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;

  protected readonly rows = computed<ScheduleView[]>(() => {
    const t = this.t();
    const li = this.i18n.li();
    const today = this.posts.todayKey();
    return this.store.schedules().map((s) =>
      scheduleView(s, {
        t,
        li,
        today,
        collection: this.collections.byId(s.collectionId),
        set: this.linkSets.byId(s.linkSetId),
      }),
    );
  });

  protected viewCalendar(row: ScheduleView): void {
    void this.router.navigate(['/app/calendar'], { queryParams: { day: row.calendarDay } });
  }

  /** Pauses or resumes; a refusal is toasted by the error interceptor and the row stays as it was. */
  protected async toggle(row: ScheduleView): Promise<void> {
    if (!this.perm.canEdit() || this.store.isBusy(row.id)) return;
    const t = this.t();
    try {
      await this.store.setActive(row.id, !row.active);
    } catch {
      return;
    }
    if (row.active) this.notify.info(fmt(t.sch.paused, { s: row.name }));
    else this.notify.success(fmt(t.sch.resumed, { s: row.name }));
  }

  /** As in the design, deleting is at once (with a toast): the schedule's sent posts stay in the history. */
  protected async remove(row: ScheduleView): Promise<void> {
    if (!this.perm.canEdit() || this.store.isBusy(row.id)) return;
    try {
      await this.store.remove(row.id);
    } catch {
      return;
    }
    this.notify.info(fmt(this.t().sch.deleted, { s: row.name }));
  }
}

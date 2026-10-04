import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { SchedulesStore } from '../../core/data/schedules.store';
import {
  AUTO_DELETE_DAY_OPTIONS,
  BUMP_HOUR_OPTIONS,
  SCHEDULE_MODES,
  localDateKey,
} from '../../core/flow/schedule-math';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { ScheduleFormService, SCHEDULE_NAME_MAX } from './schedule-form.service';
import { ScheduleOverridesComponent } from './schedule-overrides.component';
import { SchedulePatternComponent } from './schedule-pattern.component';

// The "new schedule" card: which collection and link set to pair, the pattern and start date, and under "more"
// how posts are picked, the times, per-group times and the two settings that are only saved. The state lives in
// ScheduleFormService (provided by the page). Creating sends the request, then goes to the calendar on the
// first day that has posts. Everything is an editor's; a workspace without a connected Facebook account cannot
// create (the API refuses), so the button is off with the reason.
@Component({
  selector: 'app-schedule-builder',
  imports: [
    InputFieldComponent,
    SelectFieldComponent,
    SchedulePatternComponent,
    ScheduleOverridesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-builder.component.html',
  styleUrl: './schedule-builder.component.scss',
})
export class ScheduleBuilderComponent {
  /** Whether a paired browser has a connected Facebook account (without one the API refuses a new schedule). */
  readonly canPost = input(true);

  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly i18n = inject(I18nService);
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;
  protected readonly nameMax = SCHEDULE_NAME_MAX;

  protected readonly collectionOptions = computed<SelectOption[]>(() =>
    this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  );
  protected readonly setOptions = computed<SelectOption[]>(() =>
    this.linkSets.sets().map((s) => ({ value: s.id, label: s.name })),
  );
  protected readonly modeOptions = computed<SelectOption[]>(() => {
    const s = this.t().sch;
    const label = {
      daily: s.mDaily,
      weekdays: s.mWeekdays,
      weekend: s.mWeekend,
      interval: s.mInterval,
      drip: s.mDrip,
      once: s.mOnce,
    };
    return SCHEDULE_MODES.map((m) => ({ value: m, label: label[m] }));
  });
  protected readonly orderOptions = computed<SelectOption[]>(() => [
    { value: 'shuffle', label: this.t().sch.oShuffle },
    { value: 'rotate', label: this.t().sch.oRotate },
  ]);
  protected readonly bumpOptions = computed<SelectOption[]>(() =>
    BUMP_HOUR_OPTIONS.map((h) => ({
      value: String(h),
      label: h ? fmt(this.t().sch.bumpH, { h }) : this.t().sch.bumpOff,
    })),
  );
  protected readonly delOptions = computed<SelectOption[]>(() =>
    AUTO_DELETE_DAY_OPTIONS.map((d) => ({
      value: String(d),
      label: d ? fmt(this.t().sch.autoDelD, { d }) : this.t().sch.autoDelOff,
    })),
  );
  protected readonly startLabel = computed(() =>
    this.form.isOnce() ? this.t().sch.onceDate : this.t().sch.start,
  );
  protected readonly orderNote = computed(() =>
    this.form.order() === 'rotate' ? this.t().sch.rotateNote : this.t().sch.shuffleNote,
  );
  /** Why "create" is off, if it is: no role, or no computer to post from. */
  protected readonly blocked = computed(() =>
    this.perm.readOnly()
      ? this.perm.editHint()
      : this.canPost()
        ? ''
        : this.t().api.flow.needDevice,
  );

  protected async create(): Promise<void> {
    if (this.blocked() || this.form.saving()) return;
    const body = this.form.build();
    if (!body) return;
    this.form.saving.set(true);
    try {
      const made = await this.schedules.create(body);
      const name = made.schedule.name;
      if (made.created > 0)
        this.notify.success(fmt(this.t().sch.created, { s: name, n: made.created }));
      else this.notify.info(fmt(this.t().api.flow.schNothingQueued, { s: name }));
      const day = made.firstAt ? localDateKey(new Date(made.firstAt)) : made.schedule.startDate;
      this.form.clear();
      // Nothing queued: stay, the schedule is in the list below. Otherwise show it where it lands.
      if (made.created > 0) void this.router.navigate(['/app/calendar'], { queryParams: { day } });
    } catch (e) {
      // The error interceptor has toasted the reason (a 422 names what is missing); the form shows it too.
      this.form.error.set(problemMessage(e) ?? '');
    } finally {
      this.form.saving.set(false);
    }
  }
}

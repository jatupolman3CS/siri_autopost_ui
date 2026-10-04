import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ScheduleFormService } from './schedule-form.service';

// The part of the builder that depends on the posting pattern: the time chips of daily, weekdays and weekend
// (with the best hours of the last 30 days and a box for any other time), the first round and spacing of
// "rounds every N hours", the time of "once", and the window and count of "spread across the day".
@Component({
  selector: 'app-schedule-pattern',
  imports: [InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-pattern.component.html',
  styleUrl: './schedule-pattern.component.scss',
})
export class SchedulePatternComponent {
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly bestLabel = computed(() =>
    fmt(this.t().sch.bestTime, { t: this.form.best()?.join(', ') || '—' }),
  );
  protected readonly roundsPreview = computed(() =>
    fmt(this.t().sch.roundsPreview, { t: this.form.slots().join(', ') }),
  );
  protected readonly dripPreview = computed(() =>
    fmt(this.t().sch.dripPreview, { t: this.form.slots().join(', ') }),
  );
}

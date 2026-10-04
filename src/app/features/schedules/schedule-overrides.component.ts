import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { ScheduleFormService } from './schedule-form.service';

// Per-group times: one row for every target of the chosen link set (its enabled groups with a valid address,
// then its other accounts). A row left blank follows the schedule; times typed there ("09:30, 19:00") replace
// the schedule's times for that target only. The group code of a row is shown as a reminder.
@Component({
  selector: 'app-schedule-overrides',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-overrides.component.html',
  styleUrl: './schedule-overrides.component.scss',
})
export class ScheduleOverridesComponent {
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly codeNote = computed(() =>
    fmt(this.t().sch.codeNote, { n: this.form.codeCount() }),
  );
}

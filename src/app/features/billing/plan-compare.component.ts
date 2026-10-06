import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PLAN_ORDER, PlanKey, PlanLimits } from '../../core/data/models';
import { compareRows } from '../../core/data/plans';
import { I18nService } from '../../core/i18n/i18n.service';

// The comparison of the four packages as a table: a row per number and per function, a column per plan, the
// customer's own plan highlighted. Row and column headers are real headers, so a screen reader reads each cell
// with its plan and its row.
@Component({
  selector: 'app-plan-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-compare.component.html',
  styleUrl: './plan-compare.component.scss',
})
export class PlanCompareComponent {
  /** The plans as /api/plans gives them. */
  readonly plans = input.required<Record<PlanKey, PlanLimits>>();
  /** The customer's current plan (highlighted). */
  readonly current = input<PlanKey>('free');

  protected readonly t = inject(I18nService).t;
  protected readonly columns = computed(() =>
    PLAN_ORDER.map((k) => ({ k, name: this.t().plans[k].name })),
  );
  protected readonly rows = computed(() => compareRows(this.plans(), this.t()));
}

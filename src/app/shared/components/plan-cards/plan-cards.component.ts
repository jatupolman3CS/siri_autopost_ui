import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PlanKey } from '../../../core/data/models';
import { TierView } from '../../../core/data/plans';
import { I18nService } from '../../../core/i18n/i18n.service';

export interface PlanCard extends TierView {
  highlighted: boolean;
  variant: 'primary' | 'secondary';
  cta: string;
  disabled?: boolean;
}

// Grid of plan cards (landing pricing section and the billing page): the price, who the plan is good for, its
// seven numbers (one line each) and its functions (a check when included, a muted dash when not).
@Component({
  selector: 'app-plan-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-cards.component.html',
  styleUrl: './plan-cards.component.scss',
})
export class PlanCardsComponent {
  readonly cards = input<PlanCard[]>([]);
  readonly choose = output<PlanKey>();
  protected readonly t = inject(I18nService).t;
}

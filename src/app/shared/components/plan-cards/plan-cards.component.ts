import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlanKey } from '../../../core/data/models';
import { TierView } from '../../../core/data/plans';

export interface PlanCard extends TierView {
  highlighted: boolean;
  variant: 'primary' | 'secondary';
  cta: string;
  disabled?: boolean;
}

// Grid of plan cards (landing pricing section and the billing comparison).
@Component({
  selector: 'app-plan-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-cards.component.html',
  styleUrl: './plan-cards.component.scss',
})
export class PlanCardsComponent {
  readonly cards = input<PlanCard[]>([]);
  readonly choose = output<PlanKey>();
}

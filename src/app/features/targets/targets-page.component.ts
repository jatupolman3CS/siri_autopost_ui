import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';

// Placeholder: the real page replaces this file. It shows the title and subtitle from the dictionary, the
// three-step stepper and the "next step" card (the pattern every page of the flow follows).
@Component({
  selector: 'app-targets-page',
  imports: [FlowStepsComponent, NextStepComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().ts.title }}</h1>
          <p>{{ t().ts.sub }}</p>
        </div>
      </div>
      <app-flow-steps [current]="2" />
      <app-next-step [label]="t().flow.n2" (go)="router.navigateByUrl('/app/schedules')" />
    </div>
  `,
})
export class TargetsPageComponent {
  protected readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;
}

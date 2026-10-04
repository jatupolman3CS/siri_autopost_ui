import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { UiPrefsService } from '../../../core/services/ui-prefs.service';

// The "next step" card at the bottom of a flow page: the heading "Next step", what to do next, and a
// button that emits `go` (the page navigates or opens its builder). It is a hint for newcomers, so it only
// shows in simple mode (UiPrefsService) and reads that itself.
// Usage: <app-next-step [label]="t().flow.n1" (go)="router.navigateByUrl('/app/targets')" />
@Component({
  selector: 'app-next-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './next-step.component.html',
  styleUrl: './next-step.component.scss',
})
export class NextStepComponent {
  /** What the next step is ("Paste the groups to post to"); also the button's text. */
  readonly label = input.required<string>();
  readonly go = output<void>();

  protected readonly t = inject(I18nService).t;
  protected readonly prefs = inject(UiPrefsService);
}

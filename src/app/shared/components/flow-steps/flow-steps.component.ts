import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';

// The four-step stepper shown above the pages of the flow: 1 the post library, 2 post collections, 3 link sets,
// 4 schedules (the composer, which writes a post, shows step 1). Each step links to its page and the current one
// is marked. Usage: <app-flow-steps [current]="2" />
@Component({
  selector: 'app-flow-steps',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-steps.component.html',
  styleUrl: './flow-steps.component.scss',
})
export class FlowStepsComponent {
  /** The step of the page being shown: 1 posts, 2 collections, 3 link sets, 4 schedules. */
  readonly current = input<1 | 2 | 3 | 4>(1);

  protected readonly t = inject(I18nService).t;
  protected readonly steps = computed(() => {
    const t = this.t();
    const f = t.flow;
    return [
      { n: 1, path: '/app/posts', title: t.api.flowPosts, body: t.api.flowPostsB },
      { n: 2, path: '/app/collections', title: f.s1, body: f.s1b },
      { n: 3, path: '/app/targets', title: f.s2, body: f.s2b },
      { n: 4, path: '/app/schedules', title: f.s3, body: f.s3b },
    ];
  });
}

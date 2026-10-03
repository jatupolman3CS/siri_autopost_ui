import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="su-empty">
      <div class="su-empty-icon"><i class="ph" [class]="icon()" aria-hidden="true"></i></div>
      <h3 class="su-empty-h">{{ heading() }}</h3>
      @if (description()) {
        <p class="su-empty-d">{{ description() }}</p>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly heading = input('');
  readonly description = input('');
  readonly icon = input('ph-tray');
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

// Placeholder: the real page replaces this file. It shows the title and subtitle from the dictionary.
@Component({
  selector: 'app-notify-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().ntf.title }}</h1>
          <p>{{ t().ntf.sub }}</p>
        </div>
      </div>
    </div>
  `,
})
export class NotifyPageComponent {
  protected readonly t = inject(I18nService).t;
}

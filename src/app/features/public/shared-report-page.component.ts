import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

// Placeholder for the public page of a shared client report (route report/:token, no layout, no guard): the
// real page replaces this file. `token` is bound from the route by withComponentInputBinding().
@Component({
  selector: 'app-shared-report-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <div class="panel box">
        <h1>{{ t().api.reportTitle }}</h1>
        <p class="muted">{{ t().api.loading }}</p>
      </div>
    </main>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: var(--color-bg);
    }
    .box {
      max-width: 480px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 32px 24px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
    }
    p {
      margin: 0;
      font-size: 14px;
    }
  `,
})
export class SharedReportPageComponent {
  /** The share token of the report (the last segment of /report/<token>). */
  readonly token = input<string>();
  protected readonly t = inject(I18nService).t;
}

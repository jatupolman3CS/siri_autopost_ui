import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { fmtDateTime } from '../../core/ext/lib/shared.js';
import { I18nService } from '../../core/i18n/i18n.service';
import { CampaignActions } from './campaign-actions.service';

// The browser's activity log ("บันทึกการทำงาน"), newest last, as it reports it on each sync.
@Component({
  selector: 'app-camp-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack">
      <div class="panel-head">
        <h2 class="h2">{{ x().logsTitle }}</h2>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-ghost"
          [disabled]="actions.readOnly() || !lines().length"
          (click)="clear()"
        >
          {{ x().clear }}
        </button>
      </div>
      <ol class="logs">
        @for (l of lines(); track $index) {
          <li [class]="l.level">
            <time>{{ l.time }}</time>
            <span>{{ l.msg }}</span>
          </li>
        } @empty {
          <li class="muted">{{ x().noLogs }}</li>
        }
      </ol>
    </section>
  `,
  styles: `
    .logs {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 420px;
      overflow: auto;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    li {
      display: flex;
      gap: 8px;
      padding: 3px 0;
      border-bottom: 1px solid var(--color-border);
      word-break: break-word;
    }
    time {
      color: var(--color-text-muted);
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    .success span {
      color: var(--color-success);
    }
    .warn span {
      color: var(--color-warning);
    }
    .error span {
      color: var(--color-danger);
    }
  `,
})
export class CampLogsComponent {
  private readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  protected readonly lines = computed(() =>
    this.store
      .logs()
      .slice(-200)
      .map((l) => ({ level: l.level, time: fmtDateTime(l.t), msg: l.msg })),
  );

  protected clear(): void {
    void this.store.clearLogs();
  }
}

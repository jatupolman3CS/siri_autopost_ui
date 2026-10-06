import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NOTIFY_EVENTS, NotifyEventKey } from '../../core/data/notifications.store';
import { ApiNotifyEvents } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';

/** The dictionary leaf that names each event (the design's `ntf.eSuccess`, ...). */
const LABELS = {
  success: 'eSuccess',
  fail: 'eFail',
  shot: 'eShot',
  round: 'eRound',
  startStop: 'eStartStop',
  block: 'eBlock',
  offline: 'eOffline',
  quota: 'eQuota',
  job: 'eJob',
} as const satisfies Record<NotifyEventKey, string>;

// The event switches of the design: one pill per event, pressed = sent.
@Component({
  selector: 'app-notify-pills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pills" role="group" [attr.aria-label]="t().ntf.events">
      @for (k of keys; track k) {
        <button
          type="button"
          class="pill"
          [class.on]="events()[k]"
          [attr.aria-pressed]="events()[k]"
          [disabled]="disabled()"
          (click)="toggled.emit({ key: k, on: !events()[k] })"
        >
          {{ t().ntf[labels[k]] }}
        </button>
      }
    </div>
  `,
  styles: `
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill {
      height: 36px;
      padding: 0 12px;
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 0.2s ease-out;
      &.on {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: var(--color-primary-foreground);
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      &:focus-visible {
        outline: 2px solid var(--color-focus-ring);
        outline-offset: 2px;
      }
    }
  `,
})
export class NotifyPillsComponent {
  readonly events = input.required<ApiNotifyEvents>();
  /** The person may not change anything (role or plan). */
  readonly disabled = input(false);
  readonly toggled = output<{ key: NotifyEventKey; on: boolean }>();
  protected readonly t = inject(I18nService).t;
  protected readonly keys = NOTIFY_EVENTS;
  protected readonly labels = LABELS;

}

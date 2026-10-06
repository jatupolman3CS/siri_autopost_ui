import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { PostLight } from '../posts/post-light';

/** What the hover card of one square says; `x`/`y` are viewport pixels (the card is `position: fixed`). */
export interface TipView {
  x: number;
  y: number;
  /** The card hangs below the square (there is no room above it). */
  below: boolean;
  light: PostLight;
  time: string;
  status: string;
  target: string;
  schedule: string;
  code: string;
  text: string;
  reason: string;
  rushed: boolean;
  overdue: boolean;
}

/** The card that follows the mouse over a square of the timeline: everything about the post, without a click. */
@Component({
  selector: 'app-timeline-tip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tooltip',
    'data-testid': 'tip',
    '[class.below]': 'tip().below',
    '[style.left.px]': 'tip().x',
    '[style.top.px]': 'tip().y',
  },
  template: `
    @let tp = tip();
    <div class="head">
      <i class="sq" [class]="tp.light" aria-hidden="true"></i>
      <span class="fw6">{{ tp.time }}</span>
      <span class="muted">{{ tp.status }}</span>
    </div>
    <div class="line">
      <span class="muted">{{ t().api.flow.tlTipTarget }}</span> {{ tp.target }}
      @if (tp.code) {
        <span class="code">#{{ tp.code }}</span>
      }
    </div>
    @if (tp.schedule) {
      <div class="line">
        <span class="muted">{{ t().api.flow.tlTipSchedule }}</span> {{ tp.schedule }}
      </div>
    }
    @if (tp.text) {
      <div class="text">{{ tp.text }}</div>
    }
    @if (tp.reason) {
      <div class="reason">
        <span class="muted">{{ t().api.flow.tlTipReason }}</span> {{ tp.reason }}
      </div>
    }
    @if (tp.rushed) {
      <div class="flag">
        <i class="ph ph-lightning" aria-hidden="true"></i>{{ t().api.flow.pdRushed }}
      </div>
    }
    @if (tp.overdue) {
      <div class="flag late">
        <i class="ph ph-hourglass-medium" aria-hidden="true"></i>{{ t().api.flow.pdOverdue }}
      </div>
    }
    <div class="foot small muted">{{ t().api.flow.tlTipClick }}</div>
  `,
  styles: `
    :host {
      position: fixed;
      z-index: 1000;
      width: 340px;
      max-width: calc(100vw - 16px);
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-bg);
      box-shadow: var(--shadow-lg);
      font-size: 13px;
      pointer-events: none;
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    :host(.below) {
      transform: translate(-50%, 0);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .line {
      overflow-wrap: anywhere;
    }
    .code {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--color-surface-muted);
      font-size: 12px;
    }
    .text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 6px 8px;
      border-radius: var(--radius-md);
      background: var(--color-surface);
      max-height: 96px;
      overflow: hidden;
    }
    .reason {
      color: var(--color-danger);
    }
    .flag {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      color: var(--color-accent);
      &.late {
        color: var(--color-danger);
      }
    }
  `,
})
export class TimelineTipComponent {
  readonly tip = input.required<TipView>();
  protected readonly t = inject(I18nService).t;
}

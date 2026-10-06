import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

/** The day's counts: all posts, waiting, posting, posted, failed. */
export interface TlKpi {
  all: number;
  queued: number;
  posting: number;
  done: number;
  failed: number;
}

/** The queued post that goes next (`id` is empty when none is queued; `empty` then says so). */
export interface TlNext {
  id: string;
  empty: string;
  time?: string;
  target?: string;
  /** "in 12 min" / "due now". */
  when?: string;
  /** Past its time and no browser has taken it. */
  overdue?: boolean;
  /** The local day it is on. */
  day?: string;
}

/** The five counters of the timeline and the "next post" bar under them. */
@Component({
  selector: 'app-timeline-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-summary.component.html',
  styleUrl: './timeline-summary.component.scss',
})
export class TimelineSummaryComponent {
  readonly kpi = input.required<TlKpi>();
  /** The counters show "—" until the day's posts have arrived. */
  readonly ready = input(true);
  readonly next = input.required<TlNext>();
  readonly label = input('');
  /** The next post was clicked. */
  readonly openNext = output<void>();
  protected readonly t = inject(I18nService).t;
}

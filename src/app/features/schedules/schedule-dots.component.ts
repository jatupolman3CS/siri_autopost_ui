import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostsStore, QueueItem } from '../../core/data/posts.store';
import { dkey, fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { PostDetailModalComponent } from '../posts/post-detail-modal.component';
import { PostLight, lightCounts, lightOf } from '../posts/post-light';

/** One square: a post of the schedule on the shown day. */
interface Dot {
  id: string;
  light: PostLight;
  rushed: boolean;
  label: string;
}

/**
 * The posts of ONE schedule as small squares (one square = one post, in time order), coloured by their status light:
 * green went out, yellow waits or is being posted, red failed, grey was skipped. Clicking a square opens the post
 * window (a red one: rerun it right now by hand). It shows one day at a time (today first), reads `PostsStore` and
 * so follows the event stream by itself.
 */
@Component({
  selector: 'app-schedule-dots',
  imports: [RouterLink, PostDetailModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-dots.component.html',
  styleUrl: './schedule-dots.component.scss',
})
export class ScheduleDotsComponent {
  readonly scheduleId = input.required<string>();

  private readonly i18n = inject(I18nService);
  protected readonly posts = inject(PostsStore);
  protected readonly t = this.i18n.t;

  protected readonly day = signal(this.posts.todayKey());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    // The month of the shown day (the months around today are there from the start).
    effect(() => {
      const [y, m] = this.day().split('-').map(Number);
      this.loading.set(true);
      this.posts
        .ensureMonth(y, m - 1)
        .catch(() => undefined)
        .finally(() => this.loading.set(false));
    });
  }

  protected readonly list = computed<QueueItem[]>(() =>
    (this.posts.byDay().get(this.day()) ?? []).filter((p) => p.scheduleId === this.scheduleId()),
  );

  protected readonly dots = computed<Dot[]>(() => {
    const t = this.t();
    const f = t.api.flow;
    return this.list().map((p) => ({
      id: p.id,
      light: lightOf(p),
      rushed: p.rushed ?? false,
      label: fmt(f.tlDot, { time: p.time, target: p.target, status: t.status[p.status] }),
    }));
  });

  protected readonly counts = computed(() => {
    const c = lightCounts(this.list());
    const f = this.t().api.flow;
    return {
      line: fmt(f.sdCounts, { a: c.green, b: c.yellow, c: c.red }),
      skipped: c.grey ? fmt(f.sdSkipped, { n: c.grey }) : '',
      red: c.red,
    };
  });

  protected readonly isToday = computed(() => this.day() === this.posts.todayKey());
  protected readonly dayLabel = computed(() => {
    const [y, m, d] = this.day().split('-').map(Number);
    return fmtDate(new Date(y, m - 1, d), this.i18n.li());
  });

  protected shift(delta: number): void {
    const [y, m, d] = this.day().split('-').map(Number);
    this.day.set(dkey(new Date(y, m - 1, d + delta)));
  }

  protected today(): void {
    this.day.set(this.posts.todayKey());
  }
}

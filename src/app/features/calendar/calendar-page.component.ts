import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { STATUS_DOT } from '../../core/data/models';
import { PostsStore, QueueItem } from '../../core/data/posts.store';
import { dayNames, displayYear, dkey, fmtDate, monthName } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-calendar-page',
  imports: [RouterLink, EmptyStateComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  /** ?day=YYYY-MM-DD opens that day (the composer sends users here after scheduling). */
  readonly day = input<string>();

  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly draft = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly posts = inject(PostsStore);

  protected readonly calY = signal(this.posts.now.getFullYear());
  protected readonly calM = signal(this.posts.now.getMonth());
  protected readonly selDay = signal(this.posts.todayKey);
  protected readonly deleteId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const d = this.day();
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m] = d.split('-').map(Number);
        this.calY.set(y);
        this.calM.set(m - 1);
        this.selDay.set(d);
      }
    });
  }

  protected readonly title = computed(() => {
    const li = this.i18n.li();
    return `${monthName(this.calM(), li, true)} ${displayYear(this.calY(), li)}`;
  });
  protected readonly dayNames = computed(() => dayNames(this.i18n.li()));

  protected readonly cells = computed(() => {
    const y = this.calY();
    const m = this.calM();
    const li = this.i18n.li();
    const t = this.t();
    const startDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const count = Math.ceil((startDow + dim) / 7) * 7;
    const byDay = this.posts.byDay();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(y, m, i - startDow + 1);
      const key = dkey(d);
      const list = byDay.get(key) ?? [];
      return {
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        isToday: key === this.posts.todayKey,
        isSel: key === this.selDay(),
        chips: list
          .slice(0, 3)
          .map((p) => ({ dot: STATUS_DOT[p.status], time: p.time, text: this.posts.text(p, li) })),
        more: list.length > 3 ? fmt(t.cal.moreN, { n: list.length - 3 }) : '',
        date: d,
      };
    });
  });

  protected readonly selList = computed(() => this.posts.byDay().get(this.selDay()) ?? []);
  protected readonly selTitle = computed(() => {
    const [y, m, d] = this.selDay().split('-').map(Number);
    return fmtDate(new Date(y, m - 1, d), this.i18n.li(), true);
  });
  protected readonly selRows = computed(() => {
    const li = this.i18n.li();
    const t = this.t();
    return this.selList().map((p) => ({
      ...this.posts.row(p, li, t),
      item: p,
      editable: p.status === 'queued',
      isFailed: p.status === 'failed' || p.status === 'pending',
    }));
  });

  protected pick(c: { key: string; date: Date }): void {
    this.selDay.set(c.key);
    this.calY.set(c.date.getFullYear());
    this.calM.set(c.date.getMonth());
  }

  protected nav(delta: number): void {
    const d = new Date(this.calY(), this.calM() + delta, 1);
    this.calY.set(d.getFullYear());
    this.calM.set(d.getMonth());
  }

  protected today(): void {
    this.calY.set(this.posts.now.getFullYear());
    this.calM.set(this.posts.now.getMonth());
    this.selDay.set(this.posts.todayKey);
  }

  protected addOnDay(): void {
    this.draft.patch({ date: this.selDay() });
    void this.router.navigateByUrl('/app/composer');
  }

  /** Moves a queued post back into the composer (it is re-created when scheduled again). */
  protected edit(p: QueueItem): void {
    this.posts.remove(p.id);
    this.draft.reset({
      text: this.posts.text(p, this.i18n.li()),
      date: p.key,
      time: p.time,
      targets: { [p.accountId]: true },
      groups: p.accountId === 'a1' ? [p.target[0]] : [],
    });
    void this.router.navigateByUrl('/app/composer');
  }

  protected confirmDelete(): void {
    const id = this.deleteId();
    if (id) this.posts.remove(id);
    this.deleteId.set(null);
    this.notify.info(this.t().common.deleted);
  }
}

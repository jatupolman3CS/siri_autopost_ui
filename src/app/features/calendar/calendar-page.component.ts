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
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { STATUS_DOT } from '../../core/data/models';
import { PostsStore, QueueItem } from '../../core/data/posts.store';
import { dayNames, displayYear, dkey, fmtDate, monthName } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { PostActionsService } from '../posts/post-actions.service';
import { canRunNow } from '../posts/post-light';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

const OPEN_KEY = 'ap-cal-open';
const PANEL_KEY = 'ap-cal-panel';

/** A yes/no choice kept in this browser (it only lasts for the visit when storage is not available). */
function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writePref(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // The choice only lasts for this visit.
  }
}

@Component({
  selector: 'app-calendar-page',
  imports: [PagerComponent, RouterLink, EmptyStateComponent, ModalComponent, PermNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  /** ?day=YYYY-MM-DD opens that day (a link to a day). */
  readonly day = input<string>();

  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly collections = inject(CollectionsStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly posts = inject(PostsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly actions = inject(PostActionsService);

  protected readonly calY = signal(this.posts.now().getFullYear());
  protected readonly calM = signal(this.posts.now().getMonth());
  protected readonly selDay = signal(this.posts.todayKey());
  protected readonly deleteId = signal<string | null>(null);

  /**
   * The day list folds up so the overview of what posts when stays visible: `allOpen` is the default of every row
   * (kept in this browser), `flipped` the rows that differ from it, and the whole list can be hidden to give the
   * month the full width.
   */
  protected readonly allOpen = signal(readPref(OPEN_KEY, true));
  private readonly flipped = signal<ReadonlySet<string>>(new Set());
  protected readonly panelOpen = signal(readPref(PANEL_KEY, true));

  constructor() {
    // The grid shows a few days of the neighbouring months too.
    effect(() => {
      const y = this.calY();
      const m = this.calM();
      // A month that fails to load is toasted and asked for again the next time the calendar shows it.
      for (const d of [-1, 0, 1]) this.posts.ensureMonth(y, m + d).catch(() => undefined);
    });
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
        isToday: key === this.posts.todayKey(),
        isSel: key === this.selDay(),
        chips: list
          .slice(0, 3)
          .map((p) => ({ dot: STATUS_DOT[p.status], time: p.time, text: p.text })),
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
  protected readonly selPager = new Pager(20);
  protected readonly selPage = computed(() => this.selPager.slice(this.selRows()));

  protected readonly selRows = computed(() => {
    const t = this.t();
    return this.selList().map((p) => ({
      ...this.posts.row(p, t),
      // What the task holds is what goes out (or went out): the text composed when it was queued, which a later
      // edit of the collection post does not change. Only a task with no text of its own shows the post's.
      text: p.text.trim()
        ? p.text
        : (this.collections.postById(p.collectionPostId)?.post.text ?? ''),
      /** The group code the text was written with (shown as a chip). */
      code: p.groupCode ?? '',
      isTest: p.isTest,
      item: p,
      editable: p.status === 'queued',
      // A test post has no place in a collection to go back to: it can be removed, not edited.
      canEdit: p.status === 'queued' && !p.isTest,
      isFailed: p.status === 'failed' || p.status === 'pending',
      // "Post now" (failed: rerun now); the hint says why it is off.
      canRun: canRunNow(p),
      runBlocked: this.actions.runBlockedReason(p),
    }));
  });

  protected isOpen(id: string): boolean {
    return this.allOpen() !== this.flipped().has(id);
  }

  protected toggleRow(id: string): void {
    this.flipped.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Opens or closes every row at once, and remembers it as the default. */
  protected setAllOpen(open: boolean): void {
    this.allOpen.set(open);
    this.flipped.set(new Set());
    writePref(OPEN_KEY, open);
  }

  protected setPanel(open: boolean): void {
    this.panelOpen.set(open);
    writePref(PANEL_KEY, open);
  }

  protected async runNow(p: QueueItem): Promise<void> {
    await this.actions.runNow(p);
  }

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
    this.calY.set(this.posts.now().getFullYear());
    this.calM.set(this.posts.now().getMonth());
    this.selDay.set(this.posts.todayKey());
  }

  /** The selected day is before today: a schedule cannot start there. */
  protected readonly pastDay = computed(() => this.selDay() < this.posts.todayKey());

  /** "Add" on a day: the schedule builder opens with that day as its start (never a day that has passed). */
  protected addOnDay(): void {
    if (this.pastDay()) return;
    void this.router.navigate(['/app/schedules'], { queryParams: { start: this.selDay() } });
  }

  /** Opens the library post a queued task came from in the post library's editor (see PostActionsService). */
  protected edit(p: QueueItem): void {
    this.actions.edit(p);
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.deleteId();
    this.deleteId.set(null);
    if (!id || !this.perm.canEdit()) return;
    await this.posts.remove(id);
    this.notify.info(this.t().common.deleted);
  }
}

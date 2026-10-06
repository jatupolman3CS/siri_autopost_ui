import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore, QueueItem } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { PostDetailModalComponent } from '../posts/post-detail-modal.component';
import { LIGHTS, PostLight, isOverdue, lightOf } from '../posts/post-light';
import { TimelineSummaryComponent, TlNext } from './timeline-summary.component';
import { TimelineTipComponent, TipView } from './timeline-tip.component';
import {
  AXIS_PAD,
  DEFAULT_ZOOM,
  MARKER_PX,
  ROW_GONE,
  ROW_OTHER,
  TlRow,
  ZOOMS,
  Zoom,
  axisWidth,
  buildRows,
  xOf,
} from './timeline-layout';

const ZOOM_KEY = 'ap-tl-zoom';
/** The height of one lane of squares, and of the padding above and below a row's lanes. */
const LANE_H = 22;
const ROW_PAD = 8;
/** The sticky column with the row names. */
export const LABEL_W = 232;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function storedZoom(): Zoom {
  try {
    const n = Number(localStorage.getItem(ZOOM_KEY));
    return (ZOOMS as readonly number[]).includes(n) ? (n as Zoom) : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
}

/** One square on the board. */
interface DotView {
  id: string;
  left: number;
  top: number;
  light: PostLight;
  next: boolean;
  rowNext: boolean;
  rushed: boolean;
  overdue: boolean;
  time: string;
  label: string;
}

interface RowView {
  key: string;
  kind: TlRow['kind'];
  icon: string;
  name: string;
  note: string;
  height: number;
  dots: DotView[];
  total: number;
  done: number;
  /** "posted 3/12", for the title of the counter. */
  countTitle: string;
}

/**
 * The timeline of the posts (`/app/timeline`): one day, a row for each collection, the hours across, every post a
 * small square in the colour of its status light. A red line is now, so what is about to go out sits right next to it
 * (the next one glows); hovering a square tells everything about the post, clicking it opens the post window (edit
 * the library post, post it now, rerun it when it failed). It reads `PostsStore`, which the event stream keeps
 * current, so squares turn green or red by themselves.
 */
@Component({
  selector: 'app-timeline-page',
  imports: [
    RouterLink,
    EmptyStateComponent,
    PermNoteComponent,
    PostDetailModalComponent,
    TimelineSummaryComponent,
    TimelineTipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The hover card is fixed to the screen: it goes away when the page scrolls or resizes under it.
  host: { '(window:scroll)': 'hideTip()', '(window:resize)': 'hideTip()' },
  templateUrl: './timeline-page.component.html',
  styleUrl: './timeline-page.component.scss',
})
export class TimelinePageComponent {
  /** ?day=YYYY-MM-DD opens that day, ?schedule=<id> shows one schedule only (links from the schedules page). */
  readonly day = input<string>();
  readonly schedule = input<string>();

  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  protected readonly posts = inject(PostsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly collections = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;

  protected readonly labelW = LABEL_W;
  protected readonly lights = LIGHTS;
  protected readonly zooms = ZOOMS;

  protected readonly selDay = signal(this.posts.todayKey());
  protected readonly scheduleId = signal('');
  protected readonly light = signal<'all' | PostLight>('all');
  protected readonly query = signal('');
  protected readonly zoom = signal<Zoom>(storedZoom());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly tip = signal<{ id: string; x: number; y: number; below: boolean } | null>(
    null,
  );
  /** The month of the shown day is being read (moving to another month). */
  protected readonly dayLoading = signal(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly ready = computed(() => this.posts.loaded() && !this.dayLoading());

  constructor() {
    effect(() => {
      const d = this.day();
      if (d && DAY.test(d)) this.selDay.set(d);
    });
    effect(() => {
      const s = this.schedule();
      if (s) this.scheduleId.set(s);
    });
    // The month of the shown day (the months around today are there from the start).
    effect(() => {
      const [y, m] = this.selDay().split('-').map(Number);
      this.dayLoading.set(true);
      this.posts
        .ensureMonth(y, m - 1)
        .catch(() => undefined)
        .finally(() => this.dayLoading.set(false));
    });
    // Land where the action is: now for today, else the first post of the day (and again after a zoom).
    effect(() => {
      this.selDay();
      this.zoom();
      if (this.ready()) afterNextRender(() => this.scrollToAnchor(), { injector: this.injector });
    });
  }

  protected readonly isToday = computed(() => this.selDay() === this.posts.todayKey());
  protected readonly pxPerHour = computed(() => this.zoom());
  protected readonly axisW = computed(() => axisWidth(this.pxPerHour()));

  protected readonly dayTitle = computed(() => {
    const [y, m, d] = this.selDay().split('-').map(Number);
    return fmtDate(new Date(y, m - 1, d), this.i18n.li(), true);
  });

  /** The day's posts of the schedule that is chosen (all schedules when none is). */
  private readonly scoped = computed<QueueItem[]>(() => {
    const list = this.posts.byDay().get(this.selDay()) ?? [];
    const sid = this.scheduleId();
    return sid ? list.filter((p) => p.scheduleId === sid) : list;
  });

  protected readonly kpi = computed(() => {
    const list = this.scoped();
    const count = (...s: QueueItem['status'][]) => list.filter((p) => s.includes(p.status)).length;
    return {
      all: list.length,
      queued: count('queued', 'waiting', 'pending'),
      posting: count('posting'),
      done: count('success'),
      failed: count('failed'),
    };
  });

  protected readonly scheduleOptions = computed(() => [
    { value: '', label: this.t().api.flow.tlFilterScheduleAll },
    ...this.schedules.schedules().map((s) => ({ value: s.id, label: s.name })),
  ]);

  protected readonly lightCounts = computed(() => {
    const out: Record<'all' | PostLight, number> = { all: 0, green: 0, yellow: 0, red: 0, grey: 0 };
    for (const p of this.scoped()) {
      out.all++;
      out[lightOf(p)]++;
    }
    return out;
  });

  private readonly shown = computed<QueueItem[]>(() => {
    const light = this.light();
    const q = this.query().trim().toLowerCase();
    return this.scoped().filter((p) => {
      if (light !== 'all' && lightOf(p) !== light) return false;
      if (!q) return true;
      const sName = this.schedules.byId(p.scheduleId)?.name ?? '';
      return [p.target, p.text, p.groupCode ?? '', sName].some((v) => v.toLowerCase().includes(q));
    });
  });

  /** The queued post that is next, over every loaded day (the first one not due yet, else the oldest due one). */
  private readonly nextPost = computed<QueueItem | null>(() => {
    const sid = this.scheduleId();
    const now = this.posts.now().getTime();
    const queued = this.posts
      .items()
      .filter((p) => p.status === 'queued' && (!sid || p.scheduleId === sid))
      .sort((a, b) => a.dt.getTime() - b.dt.getTime());
    return queued.find((p) => p.dt.getTime() >= now - 60_000) ?? queued[0] ?? null;
  });

  protected readonly next = computed<TlNext>(() => {
    const p = this.nextPost();
    const t = this.t().api.flow;
    if (!p) return { empty: t.tlNextNone, id: '' };
    const now = this.posts.now();
    const mins = Math.round((p.dt.getTime() - now.getTime()) / 60_000);
    const sameDay = dkey(p.dt) === this.posts.todayKey();
    const when =
      mins <= 0
        ? t.tlNextNow
        : mins < 60
          ? fmt(t.tlNextIn, { n: mins })
          : fmt(t.tlNextInH, { h: Math.floor(mins / 60), m: mins % 60 });
    return {
      empty: '',
      id: p.id,
      time: sameDay ? p.time : `${fmtDate(p.dt, this.i18n.li())} ${p.time}`,
      target: p.target,
      when,
      overdue: isOverdue(p, now),
      day: p.key,
    };
  });

  /** The rows with their squares placed. */
  protected readonly rows = computed<RowView[]>(() => {
    const t = this.t().api.flow;
    const now = this.posts.now();
    const nextId = this.nextPost()?.id ?? '';
    const px = this.pxPerHour();
    const built = buildRows(
      this.shown(),
      this.schedules.schedules(),
      this.collections.collections().map((c) => c.id),
      px,
    );
    return built.map((row) => {
      const collection = this.collections.byId(row.collectionId);
      const names = row.scheduleIds
        .map((id) => this.schedules.byId(id)?.name)
        .filter((n): n is string => !!n);
      const upcoming = row.markers.find(
        (m) => m.post.status === 'queued' && m.post.dt.getTime() >= now.getTime() - 60_000,
      );
      const done = row.markers.filter((m) => m.post.status === 'success').length;
      return {
        key: row.key,
        kind: row.kind,
        icon: row.kind === 'collection' ? (collection?.icon ?? 'ph-folder') : 'ph-tray',
        name:
          row.kind === 'other'
            ? t.tlRowOther
            : row.kind === 'gone'
              ? t.tlRowGone
              : (collection?.name ?? '—'),
        note:
          row.kind === 'other'
            ? t.tlRowOtherNote
            : row.kind === 'gone'
              ? t.tlRowGoneNote
              : names.join(' · '),
        height: row.lanes * LANE_H + ROW_PAD * 2,
        total: row.markers.length,
        done,
        countTitle: fmt(t.tlRowDone, { a: done, n: row.markers.length }),
        dots: row.markers.map((m) => ({
          id: m.post.id,
          left: m.x - MARKER_PX / 2,
          top: ROW_PAD + m.lane * LANE_H,
          light: lightOf(m.post),
          next: m.post.id === nextId,
          rowNext: m.post.id === upcoming?.post.id,
          rushed: m.post.rushed ?? false,
          overdue: isOverdue(m.post, now),
          time: m.post.time,
          label: fmt(t.tlDot, {
            time: m.post.time,
            target: m.post.target,
            status: this.t().status[m.post.status],
          }),
        })),
      };
    });
  });

  /** Hour ticks of the axis: every hour, every two hours when the day is shown whole, plus half hours when close. */
  protected readonly ticks = computed(() => {
    const px = this.pxPerHour();
    const step = px < 120 ? 2 : 1;
    const out: { left: number; label: string; minor: boolean }[] = [];
    for (let h = 0; h <= 24; h += step) {
      out.push({
        left: AXIS_PAD + h * px,
        label: `${String(h).padStart(2, '0')}:00`,
        minor: false,
      });
    }
    if (px >= 240) {
      for (let h = 0; h < 24; h++)
        out.push({
          left: AXIS_PAD + (h + 0.5) * px,
          label: `${String(h).padStart(2, '0')}:30`,
          minor: true,
        });
    }
    return out;
  });

  /** The now line: where it is on the axis and what it says (today only). */
  protected readonly nowLine = computed(() => {
    if (!this.isToday()) return null;
    const now = this.posts.now();
    return {
      x: xOf(now, this.pxPerHour()),
      label: fmt(this.t().api.flow.tlNowLabel, { t: hm(now) }),
    };
  });

  /** How much of the axis is already behind us (the whole day for a day that has passed). */
  protected readonly pastW = computed(() => {
    const key = this.selDay();
    const today = this.posts.todayKey();
    if (key > today) return 0;
    if (key < today) return this.axisW();
    return xOf(this.posts.now(), this.pxPerHour());
  });

  protected readonly tipView = computed<TipView | null>(() => {
    const tip = this.tip();
    if (!tip) return null;
    const p = this.posts.items().find((x) => x.id === tip.id);
    // A square that is not on the board any more (a filter, another day) cannot be hovered: no card for it.
    if (!p || !this.rows().some((r) => r.dots.some((d) => d.id === tip.id))) return null;
    const t = this.t();
    const schedule = this.schedules.byId(p.scheduleId);
    const reason = p.code ? t.reasons[p.code]?.title : '';
    const text = p.text.trim() || (this.collections.postById(p.collectionPostId)?.post.text ?? '');
    return {
      x: tip.x,
      y: tip.y,
      below: tip.below,
      light: lightOf(p),
      time: p.time,
      status: t.status[p.status],
      target: p.target,
      schedule: schedule?.name ?? '',
      code: p.groupCode ?? '',
      text: text.length > 150 ? `${text.slice(0, 150)}…` : text,
      reason: [reason, p.detail].filter(Boolean).join(' · '),
      rushed: p.rushed ?? false,
      overdue: isOverdue(p, this.posts.now()),
    };
  });

  // ---------- actions ----------

  protected shiftDay(delta: number): void {
    const [y, m, d] = this.selDay().split('-').map(Number);
    this.selDay.set(dkey(new Date(y, m - 1, d + delta)));
  }

  protected goToday(): void {
    this.selDay.set(this.posts.todayKey());
  }

  protected setDay(value: string): void {
    if (DAY.test(value)) this.selDay.set(value);
  }

  protected setZoom(z: Zoom): void {
    this.zoom.set(z);
    try {
      localStorage.setItem(ZOOM_KEY, String(z));
    } catch {
      // The choice only lasts for this visit.
    }
  }

  protected zoomLabel(z: Zoom): string {
    const t = this.t().api.flow;
    return z === 60
      ? t.tlZoomOverview
      : z === 120
        ? t.tlZoomNormal
        : z === 240
          ? t.tlZoomDetail
          : t.tlZoomMinute;
  }

  protected lightLabel(l: 'all' | PostLight): string {
    const t = this.t().api.flow;
    return l === 'all'
      ? t.tlLightAll
      : l === 'green'
        ? t.tlLightGreen
        : l === 'yellow'
          ? t.tlLightYellow
          : l === 'red'
            ? t.tlLightRed
            : t.tlLightGrey;
  }

  protected async refresh(): Promise<void> {
    await this.posts.refresh();
  }

  protected goNow(): void {
    if (!this.isToday()) this.goToday();
    this.scrollToAnchor();
  }

  protected openNext(): void {
    const n = this.next();
    if (!n.id) return;
    if (n.day && n.day !== this.selDay()) this.selDay.set(n.day);
    this.selectedId.set(n.id);
  }

  protected open(id: string): void {
    this.tip.set(null);
    this.selectedId.set(id);
  }

  protected showTip(id: string, ev: Event): void {
    const el = ev.currentTarget as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = 170;
    const x = Math.min(Math.max(r.left + r.width / 2, half), window.innerWidth - half);
    const below = r.top < 210;
    this.tip.set({ id, x, y: below ? r.bottom + 8 : r.top - 8, below });
  }

  protected hideTip(): void {
    this.tip.set(null);
  }

  protected trackRow(_: number, row: RowView): string {
    return row.key;
  }

  /** Scrolls the board to now (today) or to the first post of the day. */
  private scrollToAnchor(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const px = this.pxPerHour();
    const lane = Math.max(0, el.clientWidth - LABEL_W);
    let x: number;
    const now = this.nowLine();
    if (now) x = now.x;
    else {
      const first = this.shown()[0];
      x = first ? xOf(first.dt, px) : AXIS_PAD + 8 * px;
    }
    el.scrollLeft = Math.max(0, x - lane * 0.4);
    this.tip.set(null);
  }

  protected readonly rowOther = ROW_OTHER;
  protected readonly rowGone = ROW_GONE;
}

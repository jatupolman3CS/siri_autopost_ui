import { ApiCollection, ApiLinkSet, ApiSchedule } from '../../core/http/api.service';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import { Dict, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { normalizeTimes } from '../../core/flow/schedule-math';

/** What one row of the schedule list shows. */
export interface ScheduleView {
  id: string;
  name: string;
  /** Phosphor icon of its collection. */
  icon: string;
  /** "collection → link set" */
  pair: string;
  /** Pattern, times, posts per day, how posts are picked, per-group times. */
  cadence: string;
  /** The settings that are saved but not applied yet (bump, auto-delete), with that said; empty when none is set. */
  stored: string;
  todayLabel: string;
  nextLabel: string;
  /** The local day the calendar opens on: the next run's, else today's. */
  calendarDay: string;
  active: boolean;
  /** A "once" schedule whose day has passed: it switched itself off and there is nothing to resume. */
  finished: boolean;
  statusLabel: string;
  dot: string;
  toggleLabel: string;
}

/**
 * The words of a schedule row, from what the server computed (`slots`, `perDay`, `todayCount`, `nextRunAt`).
 * `today` is the browser's local day (`yyyy-MM-dd`).
 */
export function scheduleView(
  s: ApiSchedule,
  ctx: {
    t: Dict;
    li: number;
    today: string;
    collection?: Pick<ApiCollection, 'name' | 'icon'>;
    set?: Pick<ApiLinkSet, 'name'>;
  },
): ScheduleView {
  const { t, li } = ctx;
  const modeLabel: Record<ApiSchedule['mode'], string> = {
    daily: t.sch.mDaily,
    weekdays: t.sch.mWeekdays,
    weekend: t.sch.mWeekend,
    interval: t.sch.mInterval,
    drip: t.sch.mDrip,
    once: t.sch.mOnce,
  };
  const slots = s.slots.join(', ');
  const start = new Date(`${s.startDate}T00:00:00`);
  const startLabel = Number.isNaN(start.getTime()) ? s.startDate : fmtDate(start, li);
  const when =
    s.mode === 'drip'
      ? `${fmt(t.sch.dripShort, { n: s.dripCount, a: s.dripFrom, b: s.dripTo })} (${slots})`
      : s.mode === 'interval'
        ? `${fmt(t.sch.everyShort, { h: s.everyHours, t: s.firstTime })} (${slots})`
        : s.mode === 'once'
          ? `${fmt(t.sch.onceShort, { d: startLabel })} ${s.onceTime}`
          : normalizeTimes(s.times).join(', ');
  const own = Object.values(s.overrides).filter((times) => times.length > 0).length;
  const cadence = [
    modeLabel[s.mode] ?? s.mode,
    when,
    fmt(t.sch.perDay, { n: s.perDay }),
    s.order === 'rotate' ? t.sch.oRotate : t.sch.oShuffle,
    ...(own ? [fmt(t.sch.overridesN, { n: own })] : []),
  ].join(' · ');

  const kept = [
    ...(s.bumpHours ? [fmt(t.sch.bumpH, { h: s.bumpHours })] : []),
    ...(s.autoDeleteDays ? [fmt(t.sch.autoDelD, { d: s.autoDeleteDays })] : []),
  ];
  const stored = kept.length ? `${kept.join(' · ')} (${t.api.flow.storedOnlyBadge})` : '';

  const next = s.nextRunAt ? new Date(s.nextRunAt) : null;
  const nextOk = next !== null && !Number.isNaN(next.getTime());
  const finished = s.mode === 'once' && !s.active && s.startDate < ctx.today;
  return {
    id: s.id,
    name: s.name,
    icon: ctx.collection?.icon ?? 'ph-folder',
    pair: `${ctx.collection?.name ?? '—'} → ${ctx.set?.name ?? '—'}`,
    cadence,
    stored,
    todayLabel: fmt(t.sch.today, { n: s.todayCount }),
    nextLabel: `${t.sch.nextRun}: ${nextOk ? `${fmtDate(next, li)} ${hm(next)}` : '—'}`,
    calendarDay: nextOk ? dkey(next) : ctx.today,
    active: s.active,
    finished,
    statusLabel: s.active ? t.sch.active : finished ? t.api.flow.schFinished : t.sch.pausedL,
    dot: s.active ? 'var(--color-success)' : 'var(--color-warning)',
    toggleLabel: s.active ? t.sch.pause : t.sch.resume,
  };
}

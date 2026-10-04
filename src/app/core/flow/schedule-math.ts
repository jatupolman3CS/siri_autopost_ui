// Mirrors the server's schedule rules (backend spec §1 `Schedule.Slots()` / `Matches()` and §3 the
// per-member override rule): which times a schedule posts at, which local days it runs on and how
// many tasks that makes. Dates are `yyyy-MM-dd` keys in the schedule's own calendar, times are
// `HH:mm`. Weekend mode is Friday, Saturday and Sunday. The drip rounding is "half up": the C#
// side must use MidpointRounding.AwayFromZero to agree.

export type ScheduleMode = 'daily' | 'weekdays' | 'weekend' | 'interval' | 'drip' | 'once';
export type PostOrder = 'shuffle' | 'rotate';

export const SCHEDULE_MODES: readonly ScheduleMode[] = [
  'daily',
  'weekdays',
  'weekend',
  'interval',
  'drip',
  'once',
];

/** Days of posts the server keeps queued ahead of today. */
export const HORIZON_DAYS = 14;
export const BUMP_HOUR_OPTIONS: readonly number[] = [0, 6, 12, 24];
export const AUTO_DELETE_DAY_OPTIONS: readonly number[] = [0, 3, 7, 14];
export const DRIP_MAX_COUNT = 12;
export const MINUTES_PER_DAY = 1440;

/** The part of a schedule the math reads (a `ScheduleDto`, or the builder's form state). */
export interface ScheduleLike {
  mode: ScheduleMode;
  times?: readonly string[] | null;
  everyHours?: number | null;
  firstTime?: string | null;
  startDate?: string | null;
  onceTime?: string | null;
  dripFrom?: string | null;
  dripTo?: string | null;
  dripCount?: number | null;
  overrides?: Readonly<Record<string, readonly string[]>> | null;
}

export interface SlotBucket {
  /** The slot, `HH:mm`. */
  time: string;
  /** Member keys that post at it, in member order. */
  members: string[];
}

export interface PreviewDay {
  /** Local day, `yyyy-MM-dd`. */
  date: string;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  matches: boolean;
  /** Empty when the schedule does not run that day. */
  slots: SlotBucket[];
  /** Posts that day: one per member per slot. */
  tasks: number;
}

export interface ScheduleCadence {
  mode: ScheduleMode;
  /** The schedule's own slots (members without an override post at these). */
  slots: string[];
  /** Posts per day over all members. */
  perDay: number;
  /** Members that have their own times. */
  overrides: number;
}

export interface OverrideInput {
  overrides: Record<string, string[]>;
  /** True when some text held a time that is not `HH:mm`. */
  bad: boolean;
}

const TIME = /^(\d{1,2})[:.](\d{2})$/;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Minutes after midnight for `H:mm`, `HH:mm` or `HH.mm`; null for anything else (24:00 included). */
export function toMinutes(time: string | null | undefined): number | null {
  const m = String(time ?? '')
    .trim()
    .match(TIME);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** `HH:mm` of a minute count; counts outside one day wrap around. */
export function hhmm(minutes: number): string {
  if (!Number.isFinite(minutes)) return '00:00';
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** Valid times only, as distinct sorted `HH:mm`. */
export function normalizeTimes(
  times: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  const minutes = new Set<number>();
  for (const t of times ?? []) {
    const m = toMinutes(t);
    if (m !== null) minutes.add(m);
  }
  return [...minutes].sort((a, b) => a - b).map(hhmm);
}

/**
 * Reads times typed by a person: separated by commas and/or spaces, `9:30` and `09.30` accepted.
 * Returns them as sorted distinct `HH:mm`; `bad` is true when something could not be read.
 */
export function parseTimes(raw: string | null | undefined): { times: string[]; bad: boolean } {
  const found: string[] = [];
  let bad = false;
  for (const token of String(raw ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)) {
    const m = toMinutes(token);
    if (m === null) bad = true;
    else found.push(hhmm(m));
  }
  return { times: normalizeTimes(found), bad };
}

/** Quick-pick hours `from:00` to `to:00` (default 06:00-22:00) joined with times already chosen. */
export function hourChips(from = 6, to = 22, extra: readonly string[] = []): string[] {
  const hours: string[] = [];
  for (let h = Math.max(0, Math.trunc(from)); h <= Math.min(23, Math.trunc(to)); h++) {
    hours.push(String(h).padStart(2, '0') + ':00');
  }
  return normalizeTimes([...hours, ...extra]);
}

function dripSlots(s: ScheduleLike): string[] {
  const from = toMinutes(s.dripFrom) ?? 9 * 60;
  const to = toMinutes(s.dripTo) ?? 21 * 60;
  const n = Math.max(1, Math.min(DRIP_MAX_COUNT, Math.trunc(Number(s.dripCount)) || 3));
  const span = Math.max(0, to - from);
  const out = new Set<string>();
  for (let i = 0; i < n; i++) {
    out.add(hhmm(from + Math.round(n === 1 ? span / 2 : (span * i) / (n - 1))));
  }
  return [...out];
}

function intervalSlots(s: ScheduleLike): string[] {
  const first = toMinutes(s.firstTime) ?? toMinutes(s.times?.[0]) ?? 8 * 60;
  const step = Math.max(1, Number(s.everyHours) || 6) * 60;
  const out: string[] = [];
  // Rounds stop at midnight: a round that would fall on the next day is not made.
  for (let t = first; t < MINUTES_PER_DAY; t += step) out.push(hhmm(t));
  return out;
}

/**
 * The times of one day, `HH:mm` ascending. Daily, weekdays and weekend use their chosen times;
 * once uses its time; interval starts at the first time and repeats every N hours until midnight;
 * drip spreads its count between the from and to times (one post lands in the middle).
 */
export function slotsOf(schedule: ScheduleLike): string[] {
  switch (schedule.mode) {
    case 'drip':
      return dripSlots(schedule);
    case 'interval':
      return intervalSlots(schedule);
    case 'once': {
      const at = toMinutes(schedule.onceTime);
      return at === null ? normalizeTimes(schedule.times) : [hhmm(at)];
    }
    default:
      return normalizeTimes(schedule.times);
  }
}

/** True for the modes whose times are picked one by one (daily, weekdays, weekend). */
export function isTimesMode(mode: ScheduleMode): boolean {
  return mode === 'daily' || mode === 'weekdays' || mode === 'weekend';
}

// ---------------------------------------------------------------- calendar days

/** Year, month (1-12) and day of a real `yyyy-MM-dd` date; null when it is not one. */
export function parseDateKey(key: string | null | undefined): [number, number, number] | null {
  const m = String(key ?? '').match(DATE_KEY);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
    ? [y, mo, d]
    : null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** The local calendar day of a date, `yyyy-MM-dd`. */
export function localDateKey(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The day `n` days after (or before, when negative) a `yyyy-MM-dd` key; '' for an invalid key. */
export function addDays(key: string, n: number): string {
  const p = parseDateKey(key);
  if (!p) return '';
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + Math.trunc(n)));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday; -1 for an invalid key. */
export function weekdayOf(key: string): number {
  const p = parseDateKey(key);
  return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : -1;
}

/**
 * The browser's offset from UTC in minutes (Bangkok = 420), as the server wants it
 * (`utcOffsetMinutes`: the schedule's slots are local times in that calendar).
 */
export function utcOffsetMinutes(at: Date = new Date()): number {
  return 0 - at.getTimezoneOffset();
}

/**
 * Whether a schedule runs on a local day. Once runs on its start date only; the others never run
 * before their start date. Daily, interval and drip run every day, weekdays Monday to Friday and
 * weekend Friday, Saturday and Sunday.
 */
export function dayMatches(schedule: ScheduleLike, key: string): boolean {
  const dow = weekdayOf(key);
  if (dow < 0) return false;
  const start = schedule.startDate ?? '';
  if (schedule.mode === 'once') return key === start;
  if (start && key < start) return false;
  switch (schedule.mode) {
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekend':
      return dow === 0 || dow >= 5;
    default:
      return true;
  }
}

// ---------------------------------------------------------------- members and overrides

/** Key of a link in `overrides`: its id as 32 lowercase hex digits (.NET "N" format). */
export function overrideKeyOfLink(linkId: string): string {
  return linkId.replace(/-/g, '').toLowerCase();
}

/** Key of one of the set's other accounts in `overrides`. */
export function overrideKeyOfAccount(accountId: string): string {
  return 'account:' + accountId;
}

/** The times one member posts at: its own override when it has one, else the schedule's slots. */
export function memberSlots(schedule: ScheduleLike, memberKey: string): string[] {
  const own = normalizeTimes(schedule.overrides?.[memberKey]);
  return own.length ? own : slotsOf(schedule);
}

/** Posts per day over the given members. */
export function taskCountPerDay(schedule: ScheduleLike, memberKeys: readonly string[]): number {
  return memberKeys.reduce((n, key) => n + memberSlots(schedule, key).length, 0);
}

/** Members grouped by the time they post at, ascending; members keep their given order. */
export function slotBuckets(schedule: ScheduleLike, memberKeys: readonly string[]): SlotBucket[] {
  const byTime = new Map<string, string[]>();
  for (const key of memberKeys) {
    for (const time of memberSlots(schedule, key)) {
      const list = byTime.get(time);
      if (list) list.push(key);
      else byTime.set(time, [key]);
    }
  }
  return [...byTime.keys()].sort().map((time) => ({ time, members: byTime.get(time) ?? [] }));
}

/** Turns the builder's per-member time texts into overrides; empty and unreadable texts are left out. */
export function overridesFromInput(
  raw: Readonly<Record<string, string | null | undefined>>,
): OverrideInput {
  const overrides: Record<string, string[]> = {};
  let bad = false;
  for (const key of Object.keys(raw)) {
    const r = parseTimes(raw[key]);
    if (r.bad) bad = true;
    if (r.times.length) overrides[key] = r.times;
  }
  return { overrides, bad };
}

/** Slots, posts per day and number of members with their own times, for a schedule's summary line. */
export function scheduleCadence(
  schedule: ScheduleLike,
  memberKeys: readonly string[],
): ScheduleCadence {
  const own = Object.keys(schedule.overrides ?? {}).filter(
    (k) => normalizeTimes(schedule.overrides?.[k]).length > 0,
  );
  return {
    mode: schedule.mode,
    slots: slotsOf(schedule),
    perDay: taskCountPerDay(schedule, memberKeys),
    overrides: own.length,
  };
}

/**
 * The plan of `count` days from `from`: for each day whether the schedule runs and, if so, who
 * posts at which time. Staggering within a slot (the anti-ban gap) is not simulated.
 */
export function previewDays(
  schedule: ScheduleLike,
  memberKeys: readonly string[],
  from: string,
  count: number,
): PreviewDay[] {
  if (!parseDateKey(from)) return [];
  const buckets = slotBuckets(schedule, memberKeys);
  const tasks = buckets.reduce((n, b) => n + b.members.length, 0);
  const days: PreviewDay[] = [];
  for (let i = 0; i < Math.min(Math.max(0, Math.trunc(count) || 0), 366); i++) {
    const date = addDays(from, i);
    const matches = dayMatches(schedule, date);
    days.push({
      date,
      weekday: weekdayOf(date),
      matches,
      slots: matches ? buckets.map((b) => ({ time: b.time, members: [...b.members] })) : [],
      tasks: matches ? tasks : 0,
    });
  }
  return days;
}

/**
 * The busiest hours of past successful posts, for "best times": `HH:00` of the `limit` hours with
 * most posts (ties keep the order first seen), sorted by time.
 */
export function bestHours(times: readonly string[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const t of times) {
    const m = toMinutes(t);
    if (m === null) continue;
    const hour = hhmm(Math.floor(m / 60) * 60);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return [...counts.keys()]
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, Math.max(0, limit))
    .sort();
}

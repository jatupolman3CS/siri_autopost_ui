import type { QueueItem } from '../../core/data/posts.store';
import type { ApiSchedule } from '../../core/http/api.service';

/** Pixels per hour of the zoom levels: the whole day on one screen, normal, detailed, by the minute. */
export const ZOOMS = [60, 120, 240, 480] as const;
export type Zoom = (typeof ZOOMS)[number];
export const DEFAULT_ZOOM: Zoom = 120;

/** The edge of the axis before 00:00 and after 24:00, so a post at midnight is not cut off. */
export const AXIS_PAD = 14;
/** The size of one post's square, and the room left around it. */
export const MARKER_PX = 16;
export const MARKER_GAP = 3;

/** Minutes since local midnight (fractional, so seconds count). */
export function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** The horizontal position of a time on the axis (the centre of its square). */
export function xOf(d: Date, pxPerHour: number): number {
  return AXIS_PAD + (minuteOfDay(d) * pxPerHour) / 60;
}

export function axisWidth(pxPerHour: number): number {
  return AXIS_PAD * 2 + 24 * pxPerHour;
}

/**
 * Puts squares that would overlap on different lanes (first fit, in time order) so every post stays clickable
 * when many go out within a few minutes. `xs` must be sorted; the answer is the lane of each one and how many
 * lanes there are.
 */
export function assignLanes(xs: readonly number[]): { lanes: number[]; count: number } {
  const ends: number[] = []; // the right edge of the last square of each lane
  const lanes = xs.map((x) => {
    const left = x - MARKER_PX / 2;
    let lane = ends.findIndex((end) => left >= end);
    if (lane < 0) lane = ends.length;
    ends[lane] = left + MARKER_PX + MARKER_GAP;
    return lane;
  });
  return { lanes, count: Math.max(1, ends.length) };
}

export interface TlMarker {
  post: QueueItem;
  x: number;
  lane: number;
}

/** One row of the timeline: the posts of one collection (through its schedules), or the two kinds that have none. */
export interface TlRow {
  key: string;
  kind: 'collection' | 'other' | 'gone';
  collectionId: string | null;
  /** The schedules that made the posts of the row. */
  scheduleIds: string[];
  markers: TlMarker[];
  lanes: number;
}

export const ROW_OTHER = 'other';
export const ROW_GONE = 'gone';

/**
 * Splits one day's posts into rows: a row for each collection that has posts that day (in the order of
 * `collectionOrder`), then the posts no schedule made (test posts, single posts), then those of schedules that
 * no longer exist. Each row's squares are placed on the axis and stacked into lanes.
 */
export function buildRows(
  items: readonly QueueItem[],
  schedules: readonly Pick<ApiSchedule, 'id' | 'collectionId'>[],
  collectionOrder: readonly string[],
  pxPerHour: number,
): TlRow[] {
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const groups = new Map<
    string,
    { kind: TlRow['kind']; collectionId: string | null; items: QueueItem[] }
  >();
  for (const p of items) {
    let key: string;
    let kind: TlRow['kind'];
    let collectionId: string | null = null;
    if (!p.scheduleId) {
      key = ROW_OTHER;
      kind = 'other';
    } else {
      const schedule = scheduleById.get(p.scheduleId);
      if (!schedule) {
        key = ROW_GONE;
        kind = 'gone';
      } else {
        collectionId = schedule.collectionId;
        key = `c:${collectionId}`;
        kind = 'collection';
      }
    }
    const g = groups.get(key) ?? { kind, collectionId, items: [] };
    g.items.push(p);
    groups.set(key, g);
  }

  const rank = (kind: TlRow['kind'], collectionId: string | null): number => {
    if (kind === 'other') return 1e6;
    if (kind === 'gone') return 1e6 + 1;
    const i = collectionOrder.indexOf(collectionId ?? '');
    return i < 0 ? 1e5 : i;
  };

  return [...groups.entries()]
    .sort(([, a], [, b]) => rank(a.kind, a.collectionId) - rank(b.kind, b.collectionId))
    .map(([key, g]) => {
      const sorted = [...g.items].sort((a, b) => a.dt.getTime() - b.dt.getTime());
      const xs = sorted.map((p) => xOf(p.dt, pxPerHour));
      const { lanes, count } = assignLanes(xs);
      return {
        key,
        kind: g.kind,
        collectionId: g.collectionId,
        scheduleIds: [
          ...new Set(sorted.map((p) => p.scheduleId).filter((id): id is string => !!id)),
        ],
        markers: sorted.map((post, i) => ({ post, x: xs[i], lane: lanes[i] })),
        lanes: count,
      };
    });
}

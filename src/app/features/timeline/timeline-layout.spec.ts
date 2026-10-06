import { QueueItem, toItem, withDay } from '../../core/data/posts.store';
import { apiPost } from '../../testing/api-testing';
import {
  AXIS_PAD,
  MARKER_GAP,
  MARKER_PX,
  ROW_GONE,
  ROW_OTHER,
  assignLanes,
  axisWidth,
  buildRows,
  minuteOfDay,
  xOf,
} from './timeline-layout';

/** A task of the shown day at `h:m` local, from schedule `sch` (none = a post no schedule made). */
function task(id: string, h: number, m: number, sch: string | null = 's1'): QueueItem {
  const at = new Date(2026, 9, 6, h, m, 0);
  return withDay(toItem(apiPost({ id, scheduledAt: at.toISOString(), scheduleId: sch })));
}

describe('timeline layout', () => {
  describe('the axis', () => {
    it('counts minutes since local midnight, seconds as a fraction', () => {
      expect(minuteOfDay(new Date(2026, 9, 6, 0, 0, 0))).toBe(0);
      expect(minuteOfDay(new Date(2026, 9, 6, 22, 46, 30))).toBeCloseTo(22 * 60 + 46.5);
    });

    it('puts a time at its pixel: padding, then minutes at the zoom', () => {
      expect(xOf(new Date(2026, 9, 6, 0, 0), 120)).toBe(AXIS_PAD);
      expect(xOf(new Date(2026, 9, 6, 1, 30), 120)).toBe(AXIS_PAD + 180);
      expect(xOf(new Date(2026, 9, 6, 12, 0), 60)).toBe(AXIS_PAD + 720);
      expect(axisWidth(120)).toBe(AXIS_PAD * 2 + 24 * 120);
    });
  });

  describe('lanes', () => {
    it('keeps squares that do not touch on one lane', () => {
      const step = MARKER_PX + MARKER_GAP;
      expect(assignLanes([20, 20 + step, 20 + 2 * step])).toEqual({ lanes: [0, 0, 0], count: 1 });
    });

    it('stacks squares that would overlap, and reuses a lane once it is free', () => {
      const step = MARKER_PX + MARKER_GAP;
      // 20 and 25 touch (second lane); 20 + step is clear of the first, 25 + step of the second.
      const { lanes, count } = assignLanes([20, 25, 20 + step, 25 + step]);
      expect(lanes).toEqual([0, 1, 0, 1]);
      expect(count).toBe(2);
    });

    it('has one lane when there is nothing to place', () => {
      expect(assignLanes([])).toEqual({ lanes: [], count: 1 });
    });
  });

  describe('rows', () => {
    const schedules = [
      { id: 's1', collectionId: 'c1' },
      { id: 's2', collectionId: 'c1' },
      { id: 's3', collectionId: 'c2' },
    ];

    it('makes a row for each collection, in the order of the collections, sorted by time inside', () => {
      const rows = buildRows(
        [task('b', 10, 0, 's3'), task('a2', 9, 30, 's2'), task('a1', 9, 0, 's1')],
        schedules,
        ['c2', 'c1'],
        120,
      );
      expect(rows.map((r) => r.key)).toEqual(['c:c2', 'c:c1']);
      expect(rows[1].markers.map((m) => m.post.id)).toEqual(['a1', 'a2']);
      // Two schedules of one collection share its row.
      expect(rows[1].scheduleIds).toEqual(['s1', 's2']);
      expect(rows[1].collectionId).toBe('c1');
      expect(rows[1].markers[0].x).toBe(xOf(new Date(2026, 9, 6, 9, 0), 120));
    });

    it('puts posts no schedule made, and posts of deleted schedules, in rows of their own at the end', () => {
      const rows = buildRows(
        [task('x', 8, 0, null), task('y', 8, 5, 'gone'), task('a', 8, 10, 's1')],
        schedules,
        ['c1'],
        120,
      );
      expect(rows.map((r) => [r.key, r.kind])).toEqual([
        ['c:c1', 'collection'],
        [ROW_OTHER, 'other'],
        [ROW_GONE, 'gone'],
      ]);
      expect(rows[1].collectionId).toBeNull();
      expect(rows[1].scheduleIds).toEqual([]);
    });

    it('stacks the posts of a row that go out within a few minutes of each other', () => {
      // Five posts one minute apart: at 60 px per hour a minute is one pixel, so they cannot share a lane.
      const posts = [0, 1, 2, 3, 4].map((i) => task(`p${i}`, 9, i));
      const [row] = buildRows(posts, schedules, ['c1'], 60);
      expect(row.lanes).toBe(5);
      expect(row.markers.map((m) => m.lane)).toEqual([0, 1, 2, 3, 4]);
      // Zoomed in to the minute, the same posts have room side by side.
      const [wide] = buildRows(posts, schedules, ['c1'], 480);
      expect(wide.lanes).toBeLessThan(5);
    });

    it('gives a collection that is not in the list a place before the single posts', () => {
      const rows = buildRows([task('x', 8, 0, null), task('z', 8, 0, 's3')], schedules, [], 120);
      expect(rows.map((r) => r.key)).toEqual(['c:c2', ROW_OTHER]);
    });
  });
});

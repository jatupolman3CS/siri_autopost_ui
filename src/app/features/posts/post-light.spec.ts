import { PostStatus } from '../../core/data/models';
import { canRunNow, isOverdue, lightCounts, lightOf } from './post-light';

const STATUSES: PostStatus[] = [
  'success',
  'failed',
  'queued',
  'posting',
  'skipped',
  'pending',
  'waiting',
];

describe('post status light', () => {
  it('is green for a post that went out, red for a failed one, grey for a skipped one, yellow for the rest', () => {
    expect(STATUSES.map((status) => [status, lightOf({ status })])).toEqual([
      ['success', 'green'],
      ['failed', 'red'],
      ['queued', 'yellow'],
      ['posting', 'yellow'],
      ['skipped', 'grey'],
      ['pending', 'yellow'],
      ['waiting', 'yellow'],
    ]);
  });

  it('lets "post now" take a waiting, held, failed or skipped post, and nothing that went out or is on its way', () => {
    expect(STATUSES.filter((status) => canRunNow({ status }))).toEqual([
      'failed',
      'queued',
      'skipped',
      'waiting',
    ]);
  });

  it('calls a queued post overdue a minute after its time, and no other status', () => {
    const now = new Date(2026, 9, 6, 12, 0);
    const at = (min: number) => new Date(now.getTime() + min * 60_000);
    expect(isOverdue({ status: 'queued', dt: at(-5) }, now)).toBe(true);
    expect(isOverdue({ status: 'queued', dt: at(-0.5) }, now)).toBe(false);
    expect(isOverdue({ status: 'queued', dt: at(10) }, now)).toBe(false);
    expect(isOverdue({ status: 'failed', dt: at(-5) }, now)).toBe(false);
  });

  it('counts a list by light', () => {
    const list = STATUSES.concat('success').map((status) => ({ status }));
    expect(lightCounts(list)).toEqual({ green: 2, yellow: 4, red: 1, grey: 1 });
  });
});

import { ApiReportGroup } from '../http/api.service';
import { reportGroup } from '../../testing/engine.fixtures';
import {
  REPORT_TOP_POSTS,
  canDisableGroup,
  isGroupOff,
  rateColor,
  topPosts,
  totalsOf,
} from './report-math';

const URL_A = 'https://www.facebook.com/groups/condo';
const GROUPS: ApiReportGroup[] = [
  reportGroup({ name: 'Condo BKK', linkId: 'a', url: URL_A, posted: 8, failed: 2, rate: 80 }),
  reportGroup({ name: 'Cars', linkId: 'd', posted: 3, pending: 1, rate: 100 }),
];

describe('report helpers', () => {
  it('colours the rate bar green from 90, amber from 70, red below', () => {
    expect(rateColor(100)).toContain('success');
    expect(rateColor(90)).toContain('success');
    expect(rateColor(89)).toContain('warning');
    expect(rateColor(70)).toContain('warning');
    expect(rateColor(69)).toContain('danger');
  });

  it('a group is off when its link is switched off or the engine turned it off', () => {
    expect(isGroupOff({ enabled: false, health: 'ok' })).toBe(true);
    expect(isGroupOff({ enabled: true, health: 'off' })).toBe(true);
    expect(isGroupOff({ enabled: true, health: 'pending' })).toBe(false);
  });

  it('can switch off a group that has a link or an address and is not off', () => {
    expect(canDisableGroup(reportGroup({ name: 'a', linkId: 'x' }))).toBe(true);
    expect(canDisableGroup(reportGroup({ name: 'a', url: URL_A }))).toBe(true);
    expect(canDisableGroup(reportGroup({ name: 'a' }))).toBe(false); // nothing to switch off
    expect(canDisableGroup(reportGroup({ name: 'a', linkId: 'x', enabled: false }))).toBe(false);
    expect(canDisableGroup(reportGroup({ name: 'a', url: 'https://example.com/x' }))).toBe(false);
  });

  it('lists the most used posts first, at most eight', () => {
    const posts = Array.from({ length: 12 }, (_, i) => ({
      collectionPostId: `p${i}`,
      text: `post ${i}`,
      used: i % 5,
    }));
    const top = topPosts(posts);
    expect(top).toHaveLength(REPORT_TOP_POSTS);
    expect(top[0].used).toBe(4);
    expect(top.map((p) => p.used)).toEqual([...top.map((p) => p.used)].sort((a, b) => b - a));
  });

  it('totals the groups; the rate is 100 when nothing finished', () => {
    expect(totalsOf(GROUPS)).toEqual({ posted: 11, pending: 1, failed: 2, rate: 85 });
    expect(totalsOf([])).toEqual({ posted: 0, pending: 0, failed: 0, rate: 100 });
  });
});

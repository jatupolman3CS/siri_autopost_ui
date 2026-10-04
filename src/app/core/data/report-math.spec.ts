import { ApiReportGroup } from '../http/api.service';
import { reportGroup } from '../../testing/engine.fixtures';
import {
  REPORT_TOP_POSTS,
  canDisableGroup,
  excerpt,
  isGroupOff,
  rateColor,
  safeHref,
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

  describe('safeHref', () => {
    it('keeps http and https addresses, written out by the URL parser', () => {
      expect(safeHref('https://www.facebook.com/groups/condo')).toBe(
        'https://www.facebook.com/groups/condo',
      );
      expect(safeHref('  http://example.com ')).toBe('http://example.com/');
    });

    it('is null for nothing, for text that is not an address and for any other scheme', () => {
      for (const bad of [
        null,
        undefined,
        '',
        '   ',
        'facebook.com/groups/x',
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'data:text/html,<b>x</b>',
        'ftp://example.com/x',
        'mailto:a@b.co',
        '//example.com/x',
        'https://',
      ])
        expect(safeHref(bad), String(bad)).toBeNull();
    });
  });

  describe('excerpt', () => {
    it('returns a short text as it is, with white space collapsed', () => {
      expect(excerpt('Teak  shelf\n1,290 baht')).toBe('Teak shelf 1,290 baht');
      expect(excerpt('')).toBe('');
    });

    it('cuts a long text at the limit with an ellipsis', () => {
      const out = excerpt('a'.repeat(300), 140);
      expect([...out]).toHaveLength(141);
      expect(out.endsWith('…')).toBe(true);
      expect(excerpt('b'.repeat(140), 140)).toBe('b'.repeat(140));
    });

    it('does not cut a character in half, and drops a space before the ellipsis', () => {
      expect(excerpt('😀'.repeat(10), 3)).toBe('😀😀😀…');
      expect(excerpt('one two three', 4)).toBe('one…');
    });
  });
});

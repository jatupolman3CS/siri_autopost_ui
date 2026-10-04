import type { ApiBackup } from '../http/api.service';
import { isCompleteBackup, summarizeBackup } from './backup-summary';

const post = (text: string) => ({ text, mediaIds: [], approval: 'approved' });
const link = (name: string) => ({ name, url: 'https://www.facebook.com/groups/x', code: '' });

const FILE = {
  version: 2,
  createdAt: '2026-10-04T00:00:00Z',
  collections: [
    { name: 'A', posts: [post('1'), post('2'), post('3')] },
    { name: 'B', posts: [post('4')] },
    { name: 'Empty', posts: [] },
  ],
  linkSets: [
    { name: 'S1', links: [link('a'), link('b')] },
    { name: 'S2', links: [link('c')] },
  ],
  schedules: [{ name: 'Morning' }, { name: 'Evening' }],
  antiBanAdvanced: { minGap: 2 },
  notificationRules: { channel: 'tg', events: {}, sets: [{ linkSet: 'S1' }, { linkSet: 'S2' }] },
  autoReply: { on: true, rules: [{ keywords: 'price' }] },
} as unknown as ApiBackup;

describe('summarizeBackup', () => {
  it('counts the collections with their posts, the link sets with their links and the schedules', () => {
    expect(summarizeBackup(FILE)).toEqual({
      collections: 3,
      posts: 4,
      linkSets: 2,
      links: 3,
      schedules: 2,
      advanced: true,
      notificationSets: 2,
      autoReplyRules: 1,
    });
  });

  it('says which optional parts the file has', () => {
    const s = summarizeBackup({
      ...FILE,
      antiBanAdvanced: null,
      notificationRules: null,
      autoReply: null,
    });
    expect([s.advanced, s.notificationSets, s.autoReplyRules]).toEqual([false, null, null]);
  });

  it('counts an empty backup as nothing', () => {
    expect(
      summarizeBackup({ collections: [], linkSets: [], schedules: [] } as unknown as ApiBackup),
    ).toEqual({
      collections: 0,
      posts: 0,
      linkSets: 0,
      links: 0,
      schedules: 0,
      advanced: false,
      notificationSets: null,
      autoReplyRules: null,
    });
  });

  it('survives lists that are missing, not lists, or hold things that are not objects', () => {
    const s = summarizeBackup({
      collections: [null, 7, 'x', { posts: 'nope' }, { posts: [1, 2] }],
      linkSets: { not: 'a list' },
      schedules: 'none',
      notificationRules: { sets: 'x' },
      autoReply: [],
    } as unknown as ApiBackup);
    expect(s).toEqual({
      collections: 5,
      posts: 2,
      linkSets: 0,
      links: 0,
      schedules: 0,
      advanced: false,
      notificationSets: 0,
      autoReplyRules: null,
    });
    expect(summarizeBackup({})).toMatchObject({ collections: 0, schedules: 0 });
  });
});

describe('isCompleteBackup', () => {
  it('needs collections, link sets and schedules, as lists', () => {
    expect(isCompleteBackup(FILE)).toBe(true);
    expect(isCompleteBackup({ collections: [], linkSets: [], schedules: [] })).toBe(true);
    expect(isCompleteBackup({ collections: [] })).toBe(false);
    expect(isCompleteBackup({ collections: [], linkSets: [] })).toBe(false);
    expect(isCompleteBackup({ collections: [], linkSets: [], schedules: null as never })).toBe(
      false,
    );
    expect(isCompleteBackup({})).toBe(false);
  });
});

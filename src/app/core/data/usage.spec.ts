import { USAGE_COLOR, USAGE_ROWS, hasRoom, usageOf } from './usage';

describe('usageOf', () => {
  const unl = 'Unlimited';

  it('writes "n / limit" and fills the bar by the share used', () => {
    expect(usageOf(40, 300, unl)).toEqual({
      used: 40,
      limit: 300,
      state: 'ok',
      pct: 13,
      text: '40 / 300',
    });
  });

  it('is unlimited without a limit (null, undefined or 0), with a full bar that says nothing is capped', () => {
    for (const none of [null, undefined, 0])
      expect(usageOf(7, none, unl)).toEqual({
        used: 7,
        limit: null,
        state: 'unlimited',
        pct: 100,
        text: '7 / Unlimited',
      });
  });

  it('is near the limit from 80%, full at the limit and over above it', () => {
    expect(usageOf(7, 10, unl).state).toBe('ok');
    expect(usageOf(8, 10, unl).state).toBe('near');
    expect(usageOf(9, 10, unl).state).toBe('near');
    expect(usageOf(10, 10, unl).state).toBe('full');
    expect(usageOf(11, 10, unl).state).toBe('over');
  });

  it('never fills the bar past 100% (a plan that was lowered leaves more than the limit)', () => {
    expect(usageOf(1200, 1000, unl)).toMatchObject({ pct: 100, text: '1200 / 1000' });
  });

  it('has room for one more only below the limit', () => {
    expect(hasRoom(usageOf(9, 10, unl))).toBe(true);
    expect(hasRoom(usageOf(10, 10, unl))).toBe(false);
    expect(hasRoom(usageOf(11, 10, unl))).toBe(false);
    expect(hasRoom(usageOf(500, null, unl))).toBe(true);
    expect(hasRoom(usageOf(0, 1, unl))).toBe(true);
  });

  it('colours the bar: primary, warning near and at the limit, danger over it, grey when unlimited', () => {
    expect(USAGE_COLOR.ok).toBe('var(--color-primary)');
    expect(USAGE_COLOR.near).toBe('var(--color-warning)');
    expect(USAGE_COLOR.full).toBe('var(--color-warning)');
    expect(USAGE_COLOR.over).toBe('var(--color-danger)');
    expect(USAGE_COLOR.unlimited).toBe('var(--color-border)');
  });

  it('lists the six numbers the API counts, each with its place in the usage', () => {
    expect(USAGE_ROWS.map((r) => [r.key, r.used])).toEqual([
      ['groups', 'groups'],
      ['images', 'images'],
      ['libraryPosts', 'libraryPosts'],
      ['posts', 'postsLast24h'],
      ['devices', 'devices'],
      ['accounts', 'accounts'],
    ]);
  });
});

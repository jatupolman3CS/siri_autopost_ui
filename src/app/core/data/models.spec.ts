import { SocialAccount, accountKind } from './models';
import { SEED } from './seed.data';
import { ACCOUNTS } from '../../testing/api-testing';

describe('accountKind', () => {
  const fb = ACCOUNTS[0];

  it('knows an account a browser posts for', () => {
    expect(accountKind({ ...fb, connected: true, name: 'Facebook · Shop PC' })).toBe('connected');
  });

  it('tells an unbound browser account from a sample account: both are not connected', () => {
    const unbound: SocialAccount = {
      ...fb,
      connected: false,
      name: 'Facebook · Shop PC',
      health: 'relogin',
    };
    expect(accountKind(unbound)).toBe('unbound');
    expect(accountKind(fb)).toBe('sample');
    expect(accountKind(ACCOUNTS[2])).toBe('sample'); // the sample TikTok account also asks to sign in
  });
});

// The seed is generated from the design handoff (npm run import:design): a re-import must keep its parts
// pointing at each other, because the landing preview and the next pages' samples build on them.
describe('the design seed', () => {
  it('has the collections, link sets, schedules and engage samples of the flow', () => {
    for (const list of [
      SEED.collections,
      SEED.targetSets,
      SEED.schedules,
      SEED.posts,
      SEED.memberGroups,
      SEED.arRules,
      SEED.arFeed,
    ])
      expect(list.length).toBeGreaterThan(0);
  });

  it('points every schedule and post at a collection and link set that exist', () => {
    const collections = new Set(SEED.collections.map((c) => c.id));
    const sets = new Set(SEED.targetSets.map((s) => s.id));
    for (const sc of SEED.schedules) {
      expect(collections.has(sc.col), sc.id).toBe(true);
      expect(sets.has(sc.set), sc.id).toBe(true);
    }
    for (const p of SEED.posts) expect(collections.has(p.col), p.id).toBe(true);
    for (const r of SEED.arRules)
      expect(r.scope === 'all' || collections.has(r.scope), r.id).toBe(true);
  });

  it('keeps links as normalised Facebook group addresses, and per-group times on a link of the set', () => {
    for (const set of SEED.targetSets)
      for (const l of set.links)
        expect(l.url, set.id).toMatch(/^https:\/\/www\.facebook\.com\/groups\/[\w.-]+$/);
    for (const sc of SEED.schedules) {
      const urls = new Set(SEED.targetSets.find((s) => s.id === sc.set)!.links.map((l) => l.url));
      for (const url of Object.keys(sc.overrides)) expect(urls.has(url), sc.id).toBe(true);
    }
  });

  it('gives the sample accounts a device and the devices an address', () => {
    const devices = new Set(SEED.devices.map((d) => d.id));
    for (const a of SEED.accounts) expect(devices.has(a.deviceId), a.id).toBe(true);
    for (const d of SEED.devices) expect(d.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});

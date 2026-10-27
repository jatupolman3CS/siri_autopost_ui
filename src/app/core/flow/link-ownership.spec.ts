import { describe, expect, it } from 'vitest';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { apiChatLink, apiLineSet } from '../../testing/line.fixtures';
import { groupOverlaps, ownerOfSet, summarizeOwners } from './link-ownership';

const SHOP = { id: 'acc-shop', connected: true };
const OFFICE = { id: 'acc-office', connected: true };

describe('ownerOfSet', () => {
  it('is the extension the set names, even while that browser is unbound', () => {
    const gone = { id: 'acc-gone', connected: false };
    expect(ownerOfSet(apiLinkSet({ id: 's', postAsAccountId: OFFICE.id }), [SHOP, OFFICE])).toBe(
      OFFICE.id,
    );
    expect(ownerOfSet(apiLinkSet({ id: 's', postAsAccountId: gone.id }), [SHOP, gone])).toBe(
      gone.id,
    );
  });

  it('is the only connected extension when the set names none, and nobody when there are several', () => {
    const set = apiLinkSet({ id: 's', postAsAccountId: null });
    expect(ownerOfSet(set, [SHOP])).toBe(SHOP.id);
    expect(ownerOfSet(set, [SHOP, OFFICE])).toBeNull();
    expect(ownerOfSet(set, [])).toBeNull();
  });

  it('hands a set whose named account no longer exists to the only connected extension', () => {
    const set = apiLinkSet({ id: 's', postAsAccountId: 'acc-deleted' });
    expect(ownerOfSet(set, [SHOP])).toBe(SHOP.id);
    expect(ownerOfSet(set, [SHOP, OFFICE])).toBe('acc-deleted');
  });
});

describe('groupOverlaps', () => {
  const plants = 'https://www.facebook.com/groups/plants';

  it('is empty while every group is in the sets of one extension', () => {
    const sets = [
      apiLinkSet({
        id: 'a',
        postAsAccountId: SHOP.id,
        links: [apiLink({ id: 'l1', url: plants })],
      }),
      apiLinkSet({
        id: 'b',
        postAsAccountId: SHOP.id,
        links: [apiLink({ id: 'l2', url: plants })],
      }),
      apiLinkSet({ id: 'c', postAsAccountId: OFFICE.id, links: [apiLink({ id: 'l3' })] }),
    ];
    expect(groupOverlaps(sets, [SHOP, OFFICE])).toEqual([]);
  });

  it('finds a group held by two extensions: the one listed first keeps it, the other skips it', () => {
    const sets = [
      apiLinkSet({
        id: 'office-set',
        name: 'ออฟฟิศ',
        postAsAccountId: OFFICE.id,
        links: [apiLink({ id: 'l1', url: plants.toUpperCase().replace('HTTPS', 'https') })],
      }),
      apiLinkSet({
        id: 'shop-set',
        name: 'ร้าน',
        postAsAccountId: SHOP.id,
        links: [apiLink({ id: 'l2', url: plants })],
      }),
    ];
    const [o] = groupOverlaps(sets, [SHOP, OFFICE]);
    expect(o.keeper).toMatchObject({ setId: 'shop-set', owner: SHOP.id });
    expect(o.skipped).toEqual([expect.objectContaining({ setId: 'office-set', owner: OFFICE.id })]);
    // Listed the other way round, the other extension keeps it.
    expect(groupOverlaps(sets, [OFFICE, SHOP])[0].keeper.owner).toBe(OFFICE.id);
  });

  it('ignores switched-off links, invalid addresses and sets nobody posts', () => {
    const sets = [
      apiLinkSet({
        id: 'a',
        postAsAccountId: SHOP.id,
        links: [apiLink({ id: 'l1', url: plants })],
      }),
      apiLinkSet({
        id: 'b',
        postAsAccountId: OFFICE.id,
        links: [apiLink({ id: 'l2', url: plants, enabled: false })],
      }),
      apiLinkSet({
        id: 'c',
        postAsAccountId: OFFICE.id,
        links: [apiLink({ id: 'l3', url: plants, valid: false })],
      }),
      apiLinkSet({ id: 'd', postAsAccountId: null, links: [apiLink({ id: 'l4', url: plants })] }),
    ];
    expect(groupOverlaps(sets, [SHOP, OFFICE])).toEqual([]);
  });
});

describe('summarizeOwners', () => {
  it('lists every connected extension with its sets and groups, then the sets nobody posts', () => {
    const sets = [
      apiLinkSet({
        id: 'a',
        postAsAccountId: OFFICE.id,
        links: [apiLink({ id: 'l1' }), apiLink({ id: 'l2' })],
      }),
      apiLinkSet({ id: 'b', postAsAccountId: null, links: [apiLink({ id: 'l3' })] }),
    ];
    const rows = summarizeOwners(sets, [SHOP, OFFICE]);
    expect(rows.map((r) => [r.owner, r.sets.length, r.groups])).toEqual([
      [SHOP.id, 0, 0],
      [OFFICE.id, 1, 2],
      [null, 1, 1],
    ]);
  });
});

// A LINE chat set is posted by a LINE account of its own channel, even when the browser's Facebook account sits beside it.
describe('by channel', () => {
  const FB_PC = { id: 'fb-pc', connected: true, platform: 'fb' };
  const LINE_PC = { id: 'line-pc', connected: true, platform: 'line' };
  const LINE_BRANCH = { id: 'line-branch', connected: true, platform: 'line' };
  const chatSet = (over: Parameters<typeof apiLineSet>[0]) => apiLineSet(over);

  describe('ownerOfSet', () => {
    it('is the only connected account of the set’s own channel: the LINE account for a chat set, the Facebook one for a group set', () => {
      const accounts = [FB_PC, LINE_PC];
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), accounts)).toBe('line-pc');
      expect(ownerOfSet(apiLinkSet({ id: 'g', postAsAccountId: null }), accounts)).toBe('fb-pc');
    });

    it('is nobody for a chat set while no LINE account is connected, whatever Facebook accounts there are', () => {
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), [FB_PC])).toBeNull();
      expect(
        ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), [
          FB_PC,
          { id: 'line-gone', connected: false, platform: 'line' },
        ]),
      ).toBeNull();
    });

    it('does not count the other channel when it decides "the only connected one"', () => {
      // Two Facebook extensions, one LINE: the chat set still has its owner, the group set has none.
      const accounts = [FB_PC, { id: 'fb-2', connected: true, platform: 'fb' }, LINE_PC];
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), accounts)).toBe('line-pc');
      expect(ownerOfSet(apiLinkSet({ id: 'g', postAsAccountId: null }), accounts)).toBeNull();
    });

    it('is the account the set names, and nobody picks for a chat set with two LINE accounts and no choice', () => {
      const accounts = [FB_PC, LINE_PC, LINE_BRANCH];
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: 'line-branch' }), accounts)).toBe(
        'line-branch',
      );
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), accounts)).toBeNull();
    });

    it('treats an account with no platform (an older list) as Facebook', () => {
      expect(ownerOfSet(apiLinkSet({ id: 'g', postAsAccountId: null }), [SHOP])).toBe(SHOP.id);
      expect(ownerOfSet(chatSet({ id: 'c', postAsAccountId: null }), [SHOP])).toBeNull();
    });
  });

  describe('groupOverlaps', () => {
    const chat = (id: string) => apiChatLink({ id });

    it('finds a chat in the sets of two LINE accounts: the one listed first keeps it, and says "chat"', () => {
      const sets = [
        chatSet({ id: 'a', postAsAccountId: 'line-pc', links: [chat('x')] }),
        chatSet({ id: 'b', postAsAccountId: 'line-branch', name: 'B', links: [chat('x')] }),
      ];
      const [o] = groupOverlaps(sets, [FB_PC, LINE_PC, LINE_BRANCH]);
      expect(o.channel).toBe('line');
      expect(o.keeper.owner).toBe('line-pc');
      expect(o.skipped.map((h) => h.owner)).toEqual(['line-branch']);
    });

    it('never mixes a chat and a group, and a chat in two sets of ONE account is no overlap', () => {
      const sets = [
        chatSet({ id: 'a', postAsAccountId: 'line-pc', links: [chat('x')] }),
        chatSet({ id: 'a2', postAsAccountId: 'line-pc', links: [chat('x')] }),
        apiLinkSet({ id: 'g', postAsAccountId: 'fb-pc', links: [apiLink({ id: 'x' })] }),
      ];
      expect(groupOverlaps(sets, [FB_PC, LINE_PC])).toEqual([]);
    });
  });

  describe('summarizeOwners', () => {
    it('gives a LINE account its own row with the chats of its sets, apart from the groups of the Facebook rows', () => {
      const sets = [
        apiLinkSet({
          id: 'g',
          postAsAccountId: 'fb-pc',
          links: [apiLink({ id: 'g1' }), apiLink({ id: 'g2' })],
        }),
        chatSet({
          id: 'c',
          postAsAccountId: 'line-pc',
          links: [apiChatLink({ id: 'c1' }), apiChatLink({ id: 'c2' }), apiChatLink({ id: 'c3' })],
        }),
      ];
      const rows = summarizeOwners(sets, [FB_PC, LINE_PC]);
      expect(rows.map((r) => [r.owner, r.channel, r.sets.length, r.groups, r.chats])).toEqual([
        ['fb-pc', 'fb', 1, 2, 0],
        ['line-pc', 'line', 1, 0, 3],
      ]);
    });

    it('lists a LINE account only when it has a chat set; a Facebook extension is listed even with none', () => {
      const rows = summarizeOwners([], [FB_PC, LINE_PC]);
      expect(rows.map((r) => r.owner)).toEqual(['fb-pc']);
    });

    it('puts a chat set nobody sends after the owners', () => {
      const rows = summarizeOwners(
        [chatSet({ id: 'c', postAsAccountId: null })],
        [FB_PC, LINE_PC, LINE_BRANCH],
      );
      expect(rows.at(-1)).toMatchObject({ owner: null, channel: 'fb' });
      expect(rows.at(-1)!.sets.map((s) => s.id)).toEqual(['c']);
    });
  });
});

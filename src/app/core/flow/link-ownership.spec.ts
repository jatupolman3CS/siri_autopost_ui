import { describe, expect, it } from 'vitest';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
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

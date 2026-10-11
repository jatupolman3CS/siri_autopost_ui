import type { ApiLinkSet } from '../http/api.service';

// Which extension (browser) posts which link set, and which group belongs to which extension. Mirrors
// `LinkOwnership` / `OwnershipMap` of the API (SIRIAUTOPOST.Application.Common): keep the two in step.
//   - A set is posted by ONE extension: the one it names (even while that browser is unbound: the set waits), else the
//     only connected one, else nobody (several extensions and no choice: the set waits for a person to pick).
//   - A group is in the sets of ONE extension. The API refuses a second extension; data from before the rule can still
//     have the same group in two extensions' sets, and then the extension listed first keeps it and the other skips it.

/** What the helpers need to know of an account: the API lists them in the order that decides who keeps a shared group. */
export interface OwnerAccount {
  id: string;
  connected: boolean;
}

/** The extension (account id) that posts the set; null = nobody yet. */
export function ownerOfSet(
  set: Pick<ApiLinkSet, 'postAsAccountId'>,
  accounts: readonly OwnerAccount[],
): string | null {
  const connected = accounts.filter((a) => a.connected);
  const only = connected.length === 1 ? connected[0].id : null;
  const named = set.postAsAccountId ?? null;
  if (!named) return only;
  return accounts.some((a) => a.id === named) ? named : (only ?? named);
}

/** One link that keeps a group for an extension. */
export interface GroupHolder {
  setId: string;
  setName: string;
  linkId: string;
  /** The extension (account id). */
  owner: string;
}

/** A group that sits in the sets of more than one extension. */
export interface GroupOverlap {
  /** The group's address, lower case (addresses are compared without regard to case). */
  key: string;
  /** What the first link calls the group. */
  name: string;
  /** The holder that posts it: the extension listed first. */
  keeper: GroupHolder;
  /** Every holder of another extension: their sets skip this group. */
  skipped: GroupHolder[];
}

/** Groups that are in the sets of two or more extensions (empty when the rule has been kept). */
export function groupOverlaps(
  sets: readonly ApiLinkSet[],
  accounts: readonly OwnerAccount[],
): GroupOverlap[] {
  const rank = new Map(accounts.map((a, i) => [a.id, i]));
  const byUrl = new Map<string, { name: string; holders: GroupHolder[] }>();
  for (const set of sets) {
    const owner = ownerOfSet(set, accounts);
    if (!owner) continue;
    for (const link of set.links) {
      if (!link.enabled || !link.valid) continue;
      const key = link.url.toLowerCase();
      const entry = byUrl.get(key) ?? { name: link.name || link.url, holders: [] };
      entry.holders.push({ setId: set.id, setName: set.name, linkId: link.id, owner });
      byUrl.set(key, entry);
    }
  }
  const overlaps: GroupOverlap[] = [];
  for (const [key, { name, holders }] of byUrl) {
    if (new Set(holders.map((h) => h.owner)).size < 2) continue;
    const ordered = [...holders].sort(
      (a, b) =>
        (rank.get(a.owner) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.owner) ?? Number.MAX_SAFE_INTEGER),
    );
    const keeper = ordered[0];
    overlaps.push({ key, name, keeper, skipped: ordered.filter((h) => h.owner !== keeper.owner) });
  }
  return overlaps;
}

/** What an extension has: the sets it posts and how many groups they hold. */
export interface OwnerSummary {
  /** The extension (account id); null = the sets nobody posts yet. */
  owner: string | null;
  sets: ApiLinkSet[];
  groups: number;
}

/** The sets grouped by extension, in the accounts' order, then the sets nobody posts. Extensions with no set are included. */
export function summarizeOwners(
  sets: readonly ApiLinkSet[],
  accounts: readonly OwnerAccount[],
): OwnerSummary[] {
  const map = new Map<string | null, ApiLinkSet[]>();
  for (const a of accounts.filter((x) => x.connected)) map.set(a.id, []);
  for (const set of sets) {
    const owner = ownerOfSet(set, accounts);
    map.set(owner, [...(map.get(owner) ?? []), set]);
  }
  const rank = new Map(accounts.map((a, i) => [a.id, i]));
  const rows = [...map].map(([owner, list]) => ({
    owner,
    sets: list,
    groups: list.reduce((n, s) => n + s.links.length, 0),
  }));
  return rows.sort((a, b) => {
    if (a.owner === null) return 1;
    if (b.owner === null) return -1;
    return (rank.get(a.owner) ?? 0) - (rank.get(b.owner) ?? 0);
  });
}

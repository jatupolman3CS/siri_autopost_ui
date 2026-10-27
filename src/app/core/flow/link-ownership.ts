import type { ApiLinkSet } from '../http/api.service';
import { LinkChannel, channelOf, linkUrlKey } from './line-chats';

// Which extension (browser) posts which link set, and which group (or LINE chat) belongs to which extension. Mirrors
// `LinkOwnership` / `OwnershipMap` of the API (SIRIAUTOPOST.Application.Common): keep the two in step.
//   - A set is posted by ONE extension: the one it names (even while that browser is unbound: the set waits), else the
//     only connected one OF ITS CHANNEL, else nobody (several extensions and no choice: the set waits for a person to
//     pick). A Facebook set is posted by a Facebook account and a LINE set by a LINE account, even when both belong to the
//     same browser.
//   - A group is in the sets of ONE extension, and so is a LINE chat; the two channels never share a key. The API refuses
//     a second extension; data from before the rule can still have the same target in two extensions' sets, and then the
//     extension listed first keeps it and the other skips it.

/** What the helpers need to know of an account: the API lists them in the order that decides who keeps a shared target. */
export interface OwnerAccount {
  id: string;
  connected: boolean;
  /** 'fb' (also when absent) or 'line': a set is only posted by an account of its channel. */
  platform?: string;
}

const platformOf = (a: OwnerAccount): LinkChannel => (a.platform === 'line' ? 'line' : 'fb');

/** The extension (account id) that posts the set; null = nobody yet. */
export function ownerOfSet(
  set: Pick<ApiLinkSet, 'postAsAccountId'> & { channel?: string | null },
  accounts: readonly OwnerAccount[],
): string | null {
  const channel = channelOf(set);
  const connected = accounts.filter((a) => a.connected && platformOf(a) === channel);
  const only = connected.length === 1 ? connected[0].id : null;
  const named = set.postAsAccountId ?? null;
  if (!named) return only;
  return accounts.some((a) => a.id === named) ? named : (only ?? named);
}

/** One link that keeps a target for an extension. */
export interface GroupHolder {
  setId: string;
  setName: string;
  linkId: string;
  /** The extension (account id). */
  owner: string;
}

/** A target (a Facebook group or page, or a LINE chat) that sits in the sets of more than one extension. */
export interface GroupOverlap {
  /** The address, lower case (addresses are compared without regard to case); chats start with `line:`. */
  key: string;
  /** What kind of target it is: the wording says "group" or "chat". */
  channel: LinkChannel;
  /** What the first link calls the target. */
  name: string;
  /** The holder that posts it: the extension listed first. */
  keeper: GroupHolder;
  /** Every holder of another extension: their sets skip this target. */
  skipped: GroupHolder[];
}

/** Targets that are in the sets of two or more extensions (empty when the rule has been kept). */
export function groupOverlaps(
  sets: readonly ApiLinkSet[],
  accounts: readonly OwnerAccount[],
): GroupOverlap[] {
  const rank = new Map(accounts.map((a, i) => [a.id, i]));
  const byUrl = new Map<string, { channel: LinkChannel; name: string; holders: GroupHolder[] }>();
  for (const set of sets) {
    const owner = ownerOfSet(set, accounts);
    if (!owner) continue;
    const channel = channelOf(set);
    for (const link of set.links) {
      if (!link.enabled || !link.valid) continue;
      // A chat and a group never meet: the channel is part of the key.
      const key = (channel === 'line' ? 'line:' : '') + linkUrlKey(channel, link.url);
      const entry = byUrl.get(key) ?? { channel, name: link.name || link.url, holders: [] };
      entry.holders.push({ setId: set.id, setName: set.name, linkId: link.id, owner });
      byUrl.set(key, entry);
    }
  }
  const overlaps: GroupOverlap[] = [];
  for (const [key, { channel, name, holders }] of byUrl) {
    if (new Set(holders.map((h) => h.owner)).size < 2) continue;
    const ordered = [...holders].sort(
      (a, b) =>
        (rank.get(a.owner) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.owner) ?? Number.MAX_SAFE_INTEGER),
    );
    const keeper = ordered[0];
    overlaps.push({
      key,
      channel,
      name,
      keeper,
      skipped: ordered.filter((h) => h.owner !== keeper.owner),
    });
  }
  return overlaps;
}

/** What an extension has: the sets it posts and how many groups or chats they hold. */
export interface OwnerSummary {
  /** The extension (account id); null = the sets nobody posts yet. */
  owner: string | null;
  /** The channel of the account (the sets of a LINE account are LINE sets); a row of sets nobody posts is Facebook. */
  channel: LinkChannel;
  sets: ApiLinkSet[];
  /** Links of the Facebook sets in `sets`. */
  groups: number;
  /** Links of the LINE sets in `sets`: customer chats. */
  chats: number;
}

/**
 * The sets grouped by extension, in the accounts' order, then the sets nobody posts. Every connected Facebook extension is
 * included even with no set; a LINE account only appears with a LINE set of its own (a LINE account with no set yet would
 * only be noise next to its browser's Facebook row).
 */
export function summarizeOwners(
  sets: readonly ApiLinkSet[],
  accounts: readonly OwnerAccount[],
): OwnerSummary[] {
  const map = new Map<string | null, ApiLinkSet[]>();
  for (const a of accounts.filter((x) => x.connected && platformOf(x) === 'fb')) map.set(a.id, []);
  for (const set of sets) {
    const owner = ownerOfSet(set, accounts);
    map.set(owner, [...(map.get(owner) ?? []), set]);
  }
  const rank = new Map(accounts.map((a, i) => [a.id, i]));
  const platform = new Map(accounts.map((a) => [a.id, platformOf(a)]));
  const rows = [...map].map(([owner, list]) => ({
    owner,
    channel: (owner ? platform.get(owner) : undefined) ?? 'fb',
    sets: list,
    groups: list.reduce((n, s) => n + (channelOf(s) === 'fb' ? s.links.length : 0), 0),
    chats: list.reduce((n, s) => n + (channelOf(s) === 'line' ? s.links.length : 0), 0),
  }));
  return rows.sort((a, b) => {
    if (a.owner === null) return 1;
    if (b.owner === null) return -1;
    return (rank.get(a.owner) ?? 0) - (rank.get(b.owner) ?? 0);
  });
}

import type { ApiBackup } from '../http/api.service';

// What a backup file holds, counted for the confirmation step of "restore": the person sees how much is about to
// replace the workspace's collections, link sets and schedules before anything is sent. Pure and forgiving: the
// file is whatever the person pasted, so every list may be missing or not a list (the API has the last word).

export interface BackupSummary {
  collections: number;
  /** Posts over all collections. */
  posts: number;
  linkSets: number;
  /** Links over all link sets. */
  links: number;
  schedules: number;
  /** The file carries the advanced anti-ban numbers (applied only when the owner's plan allows). */
  advanced: boolean;
  /** Link sets with notification rules in the file (null: the file has none). */
  notificationSets: number | null;
  /** Auto-reply rules in the file (null: the file has none). */
  autoReplyRules: number | null;
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const sum = (items: unknown[], count: (item: Record<string, unknown>) => number): number =>
  items.reduce<number>((n, item) => n + (isObject(item) ? count(item) : 0), 0);

/**
 * A restore replaces collections, link sets and schedules, so a file without all three lists is not a backup
 * (the API refuses it too): the dialog says so instead of showing "0 of everything".
 */
export function isCompleteBackup(file: Partial<ApiBackup>): boolean {
  return [file.collections, file.linkSets, file.schedules].every(Array.isArray);
}

/** Counts what the file holds. A missing or malformed list counts as none. */
export function summarizeBackup(file: Partial<ApiBackup>): BackupSummary {
  const collections = list(file.collections);
  const linkSets = list(file.linkSets);
  const rules: unknown = file.autoReply;
  const notify: unknown = file.notificationRules;
  return {
    collections: collections.length,
    posts: sum(collections, (c) => list(c['posts']).length),
    linkSets: linkSets.length,
    links: sum(linkSets, (s) => list(s['links']).length),
    schedules: list(file.schedules).length,
    advanced: isObject(file.antiBanAdvanced),
    notificationSets: isObject(notify) ? list(notify['sets']).length : null,
    autoReplyRules: isObject(rules) ? list(rules['rules']).length : null,
  };
}

// Mirrors the server's group-link rules (backend `FacebookGroupUrl.Normalize`, `SetLink` name
// derivation, the bulk `url | code` lines of POST link-sets/{id}/links/bulk and the CSV rows of
// POST link-sets/import-csv). The server repeats every check, these helpers only give the web
// app the same answer before it sends anything.
import { CSV_BOM, csvText, parseCsvRecords, unescapeFormulaCell } from './csv';

/** Same pattern as the server: a Facebook group address, any host spelling, any trailing path. */
const GROUP_URL =
  /^(?:https?:\/\/)?(?:www\.|m\.|web\.|mbasic\.)?(?:facebook|fb)\.com\/groups\/([A-Za-z0-9._-]+)/i;

export const GROUP_URL_PREFIX = 'https://www.facebook.com/groups/';

export interface LinkLike {
  name?: string | null;
  url?: string | null;
}

export interface BulkLink {
  url: string;
  name: string;
  code: string;
}

export interface BulkParseResult {
  links: BulkLink[];
  /** The trimmed lines that are not a Facebook group address. */
  invalid: string[];
}

export interface CsvLinkRow {
  set: string;
  name: string;
  url: string;
  code: string;
}

export interface CsvParseResult {
  rows: CsvLinkRow[];
  /** Records that were skipped: fewer than 3 columns, an empty set name or not a group address. */
  invalid: number;
}

export interface ExportLink {
  name: string;
  url: string;
  code: string;
  enabled: boolean;
  dailyMax: number;
}

export interface ExportLinkSet {
  name: string;
  links: readonly ExportLink[];
}

export interface ExportCollectionPost {
  text: string;
  mediaIds: readonly unknown[];
  approval: string;
}

export interface ExportCollection {
  name: string;
  posts: readonly ExportCollectionPost[];
}

/** `https://www.facebook.com/groups/<slug>`, or '' when the text is not a Facebook group address. */
export function normalizeGroupUrl(raw: string | null | undefined): string {
  const m = String(raw ?? '')
    .trim()
    .match(GROUP_URL);
  // A slug of dots and dashes only (`.`, `..`) is no group (the server refuses it too).
  return m && /[A-Za-z0-9]/.test(m[1]) ? GROUP_URL_PREFIX + m[1] : '';
}

/** The key two addresses are compared by: group slugs are not case sensitive, so `ABC` and `abc` are one group. */
export function groupUrlKey(raw: string | null | undefined): string {
  return normalizeGroupUrl(raw).toLowerCase();
}

/** The group name or number of an address (the text after `groups/`), else the text itself. */
export function groupSlug(url: string | null | undefined): string {
  const s = String(url ?? '');
  const m = s.match(/groups\/([^/?#]+)/);
  return m ? m[1] : s;
}

/** What a row is called: its own name, else the slug of its address. */
export function linkLabel(link: LinkLike): string {
  return (link.name ?? '').trim() || groupSlug(link.url);
}

/** The name a link gets when none is given: the slug with `.`, `_` and `-` read as spaces. */
export function defaultLinkName(url: string): string {
  return groupSlug(url).replace(/[._-]+/g, ' ');
}

/**
 * Reads pasted lines `url | code`. Blank lines are skipped, a line whose address is not a Facebook
 * group goes to `invalid`, the code is optional (text after a second `|` is ignored).
 */
export function parseBulkLinks(text: string | null | undefined): BulkParseResult {
  const links: BulkLink[] = [];
  const invalid: string[] = [];
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((line) => {
      const s = line.trim();
      if (!s) return;
      const parts = s.split('|').map((x) => x.trim());
      const url = normalizeGroupUrl(parts[0]);
      if (!url) {
        invalid.push(s);
        return;
      }
      links.push({ url, name: defaultLinkName(url), code: parts[1] ?? '' });
    });
  return { links, invalid };
}

/** True when another row (not `ignoreIndex`) already has the same normalized address. */
export function isDuplicateUrl(
  links: readonly LinkLike[],
  url: string | null | undefined,
  ignoreIndex = -1,
): boolean {
  const key = groupUrlKey(url);
  if (!key) return false;
  return links.some((l, i) => i !== ignoreIndex && groupUrlKey(l.url) === key);
}

/** Per row: true when an earlier row has the same normalized address (the first one is not flagged). */
export function duplicateUrlFlags(links: readonly LinkLike[]): boolean[] {
  const seen = new Set<string>();
  return links.map((l) => {
    const key = groupUrlKey(l.url);
    if (!key) return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

export interface BulkPreview {
  added: number;
  duplicates: number;
  /** Duplicates whose code differs from the one on file: the server updates it. */
  recoded: number;
}

/**
 * What pasting `parsed` into a set that has `existing` links will do: new addresses are added, a
 * repeated one is a duplicate and, when it brings a different non-empty code, the code is updated.
 */
export function previewBulkImport(
  existing: readonly { url?: string | null; code?: string | null }[],
  parsed: readonly BulkLink[],
): BulkPreview {
  const codes = new Map<string, string>();
  for (const l of existing) {
    const key = groupUrlKey(l.url);
    if (key && !codes.has(key)) codes.set(key, l.code ?? '');
  }
  let added = 0;
  let duplicates = 0;
  let recoded = 0;
  for (const l of parsed) {
    const key = l.url.toLowerCase();
    const current = codes.get(key);
    if (current === undefined) {
      codes.set(key, l.code);
      added++;
      continue;
    }
    duplicates++;
    if (l.code && l.code !== current) {
      codes.set(l.url, l.code);
      recoded++;
    }
  }
  return { added, duplicates, recoded };
}

const isCsvHeader = (cells: readonly string[]) =>
  cells[0]?.toLowerCase() === 'set' &&
  cells[1]?.toLowerCase() === 'name' &&
  cells[2]?.toLowerCase() === 'url';

/**
 * Reads a CSV (or pasted spreadsheet) of `set, name, url, code`. A comma or a tab separates the
 * cells, cells may be quoted, the header line `set,name,url,...` and a BOM are skipped, extra
 * columns (enabled, dailyMax of an export) are ignored. Rows keep their order and duplicates: the
 * server skips repeated addresses.
 */
export function parseLinkCsv(text: string | null | undefined): CsvParseResult {
  const rows: CsvLinkRow[] = [];
  let invalid = 0;
  parseCsvRecords(text).forEach((rawCells, index) => {
    if (index === 0 && isCsvHeader(rawCells)) return;
    // The export puts an apostrophe in front of text that a spreadsheet would run as a formula.
    const cells = rawCells.map(unescapeFormulaCell);
    if (cells.length < 3) {
      invalid++;
      return;
    }
    const url = normalizeGroupUrl(cells[2]);
    if (!url || !cells[0]) {
      invalid++;
      return;
    }
    rows.push({ set: cells[0], name: cells[1], url, code: cells[3] ?? '' });
  });
  return { rows, invalid };
}

export interface CsvImportPreview {
  /** Links that would be created. */
  links: number;
  /** Sets that would be created (a set is matched by its exact name). */
  sets: number;
}

/** What importing `rows` into the current sets creates: unknown sets, and addresses a set lacks. */
export function previewCsvImport(
  existing: readonly { name: string; links: readonly LinkLike[] }[],
  rows: readonly CsvLinkRow[],
): CsvImportPreview {
  const urls = new Map<string, Set<string>>();
  for (const s of existing) {
    const known = urls.get(s.name) ?? new Set<string>();
    s.links.forEach((l) => known.add(groupUrlKey(l.url)));
    urls.set(s.name, known);
  }
  let links = 0;
  let sets = 0;
  for (const row of rows) {
    let known = urls.get(row.set);
    if (!known) {
      known = new Set();
      urls.set(row.set, known);
      sets++;
    }
    const key = groupUrlKey(row.url);
    if (!key || known.has(key)) continue;
    known.add(key);
    links++;
  }
  return { links, sets };
}

/** The links export: BOM, header `set,name,url,code,enabled,dailyMax`, one row per link. */
export function linksToCsv(sets: readonly ExportLinkSet[]): string {
  const rows: (string | number)[][] = [['set', 'name', 'url', 'code', 'enabled', 'dailyMax']];
  for (const s of sets) {
    for (const l of s.links) {
      rows.push([s.name, l.name, l.url, l.code, l.enabled ? 1 : 0, l.dailyMax]);
    }
  }
  return CSV_BOM + csvText(rows);
}

/** The posts export: BOM, header `collection,text,media,status`, one row per post. */
export function postsToCsv(collections: readonly ExportCollection[]): string {
  const rows: (string | number)[][] = [['collection', 'text', 'media', 'status']];
  for (const c of collections) {
    for (const p of c.posts) rows.push([c.name, p.text, p.mediaIds.length, p.approval]);
  }
  return CSV_BOM + csvText(rows);
}

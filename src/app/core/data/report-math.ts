import { normalizeGroupUrl } from '../flow/group-links';
import { ApiReport, ApiReportGroup } from '../http/api.service';

// Pure helpers of the report screens (the page and the public shared page): no Angular, no requests.

type ApiReportPost = ApiReport['posts'][number];

/** How many of the most used posts the page lists (the design's 8). */
export const REPORT_TOP_POSTS = 8;

/** The posts most used first (the API sorts them, this keeps the page right whatever order it gets). */
export function topPosts(
  posts: readonly ApiReportPost[],
  limit = REPORT_TOP_POSTS,
): ApiReportPost[] {
  return [...posts].sort((a, b) => b.used - a.used).slice(0, limit);
}

/** Colour of a success rate bar: green from 90, amber from 70, else red (the design's thresholds). */
export function rateColor(rate: number): string {
  return rate >= 90
    ? 'var(--color-success)'
    : rate >= 70
      ? 'var(--color-warning)'
      : 'var(--color-danger)';
}

/** A group's row is "off": switched off by hand or by the engine. */
export const isGroupOff = (g: Pick<ApiReportGroup, 'enabled' | 'health'>): boolean =>
  !g.enabled || g.health === 'off';

/** Whether "disable" can do something for a group: it has a link or an address, and it is not off already. */
export const canDisableGroup = (g: ApiReportGroup): boolean =>
  (g.linkId !== null || normalizeGroupUrl(g.url) !== '') && !isGroupOff(g);

export interface ReportTotals {
  posted: number;
  pending: number;
  failed: number;
  /** round(posted / (posted + failed)), 100 when nothing finished: the server's rate over all groups. */
  rate: number;
}

export function totalsOf(groups: readonly ApiReportGroup[]): ReportTotals {
  const posted = groups.reduce((n, g) => n + g.posted, 0);
  const pending = groups.reduce((n, g) => n + g.pending, 0);
  const failed = groups.reduce((n, g) => n + g.failed, 0);
  const done = posted + failed;
  return { posted, pending, failed, rate: done === 0 ? 100 : Math.round((posted / done) * 100) };
}

/**
 * An address safe to put in a link on a public page: only `http:` and `https:` addresses, written out in full by
 * the URL parser. Anything else (empty, not an address, `javascript:`, `data:`, `ftp:`...) is null, and the page
 * shows the name as plain text instead.
 */
export function safeHref(url: string | null | undefined): string | null {
  const text = (url ?? '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * The start of a text for a table cell: white space collapsed, cut at `max` characters (counting whole
 * characters, never half of a surrogate pair) with an ellipsis. A shorter text is returned as it is.
 */
export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return chars.length <= max ? flat : `${chars.slice(0, max).join('').trimEnd()}…`;
}

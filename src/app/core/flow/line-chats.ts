// LINE Official Account customer chats as link-set links. Mirrors the server's `LineChatUrl` (backend
// Domain/Services/LineChatUrl.cs) and `lineChatTarget()` of the extension (client/lib/shared.js, with its byte-identical
// copy in legacy/lib/shared.js): keep the three in step. A chat address is `https://chat.line.biz/<botId>/chat/<userId>`;
// the id patterns are assumption A1 of the LINE spec (nobody has seen the real ids), kept in ONE constant so they are easy
// to tighten. The server repeats every check; these helpers only give the web app the same answer before it sends anything.
import { LinkLike, duplicateUrlFlags, groupUrlKey, normalizeGroupUrl } from './group-links';

/** What a link set (and each link of it) posts to: Facebook groups and pages, or LINE customer chats. */
export type LinkChannel = 'fb' | 'line';

/** A set or link row from the API: `channel` is absent on a server that predates LINE chats, which means Facebook. */
export function channelOf(x: { channel?: string | null } | null | undefined): LinkChannel {
  return x?.channel === 'line' ? 'line' : 'fb';
}

/** Scheme and `www.` optional, bot id 5-64 and user id 10-64 of letters, digits, `_` and `-`, then nothing or `/`, `?`, `#`. */
const LINE_CHAT_RE =
  /^(?:https?:\/\/)?(?:www\.)?chat\.line\.biz\/([A-Za-z0-9_-]{5,64})\/chat\/([A-Za-z0-9_-]{10,64})(?:[/?#].*)?$/i;

/** The parts of a chat address and its canonical form (scheme added, no `www.`, no trailing slash, query or fragment). */
export interface LineChatTarget {
  botId: string;
  userId: string;
  url: string;
}

/** The bot id, user id and canonical address of a chat address, or null when the text is not one (the typed case is kept). */
export function lineChatTarget(raw: string | null | undefined): LineChatTarget | null {
  const m = LINE_CHAT_RE.exec(String(raw ?? '').trim());
  return m
    ? { botId: m[1], userId: m[2], url: `https://chat.line.biz/${m[1]}/chat/${m[2]}` }
    : null;
}

/** The first path segments of chat.line.biz that are pages of the site, not an Official Account. */
const OA_RESERVED = new Set(['login', 'static', 'oauth', 'api', 'assets', 'logout']);

/**
 * The Official Account id in a pasted address: `https://chat.line.biz/<id>/` (or any page under it: /chat/..., /contact), with or
 * without the scheme, or just the id; '' when the text is none of these. Mirrors `lineBotIdFromLink` of the extension
 * (client/background.js): keep them in step.
 */
export function lineOaIdOf(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const m = /^(?:https?:\/\/)?(?:www\.)?chat\.line\.biz\/([A-Za-z0-9_@-]{3,64})(?:[/?#].*)?$/i.exec(
    text,
  );
  if (m) return OA_RESERVED.has(m[1].toLowerCase()) ? '' : m[1];
  return /^[A-Za-z0-9_@-]{3,64}$/.test(text) && !OA_RESERVED.has(text.toLowerCase()) ? text : '';
}

/** The canonical address of a chat, or '' when the text is not a chat address. */
export function normalizeChatUrl(raw: string | null | undefined): string {
  return lineChatTarget(raw)?.url ?? '';
}

/** The key two chat addresses are compared by: the server compares without regard to case. */
export function lineChatKey(raw: string | null | undefined): string {
  return normalizeChatUrl(raw).toLowerCase();
}

/** What a chat row is called: the customer's name as LINE shows it, else `fallback` (the dictionary's "customer"). */
export function chatLabel(link: LinkLike, fallback = ''): string {
  return (link.name ?? '').trim() || fallback;
}

/** Per row: true when an earlier row has the same chat (the first one is not flagged). */
export function duplicateChatFlags(links: readonly LinkLike[]): boolean[] {
  const seen = new Set<string>();
  return links.map((l) => {
    const key = lineChatKey(l.url);
    if (!key) return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

// ---------------------------------------------------------------- by channel

/** The canonical address of a link for the channel of its set, or '' when it is not an address of that channel. */
export function normalizeLinkUrl(channel: LinkChannel, raw: string | null | undefined): string {
  return channel === 'line' ? normalizeChatUrl(raw) : normalizeGroupUrl(raw);
}

/** The key two addresses of one channel are compared by (lower case). */
export function linkUrlKey(channel: LinkChannel, raw: string | null | undefined): string {
  return channel === 'line' ? lineChatKey(raw) : groupUrlKey(raw);
}

/** Per row: true when an earlier row of the same set has the same address. */
export function duplicateFlagsFor(channel: LinkChannel, links: readonly LinkLike[]): boolean[] {
  return channel === 'line' ? duplicateChatFlags(links) : duplicateUrlFlags(links);
}

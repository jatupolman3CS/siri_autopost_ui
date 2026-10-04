// Mirrors the server's `PostComposer` (backend spec §2): the group code replaces `{{code}}` or
// becomes the first line, spintax `{a|b|c}` is resolved innermost first (at most 50 rounds), then
// the collection's footer and hashtags are added unless the text already holds them. The text is
// never cut: a result that is too long is the caller's problem to report (the server refuses it).

/** A random source: returns a number in [0, 1), like Math.random. */
export type Rnd = () => number;

export interface ComposeSettings {
  hashtags?: string | null;
  footer?: string | null;
  footerPos?: 'end' | 'top' | null;
}

export interface PostFlags {
  hasCode: boolean;
  hasSpin: boolean;
}

/** `{{code}}` or `{{ รหัส }}`, any case, any inner spaces. */
const CODE_TAG = /\{\{\s*(?:code|รหัส)\s*\}\}/i;
const CODE_TAG_ALL = /\{\{\s*(?:code|รหัส)\s*\}\}/gi;
/** An innermost spintax group: braces with a pipe and no braces inside. */
const SPIN_GROUP = /\{([^{}]*\|[^{}]*)\}/;
/** The server stops after this many resolved groups; later groups stay as written. */
export const MAX_SPIN_ROUNDS = 50;

export function hasCodeTag(text: string | null | undefined): boolean {
  return CODE_TAG.test(String(text ?? ''));
}

export function hasSpin(text: string | null | undefined): boolean {
  return SPIN_GROUP.test(String(text ?? ''));
}

export function postFlags(text: string | null | undefined): PostFlags {
  return { hasCode: hasCodeTag(text), hasSpin: hasSpin(text) };
}

/** Resolves every `{a|b|c}` (nested ones from the inside out) choosing uniformly with `rnd`. */
export function spin(text: string | null | undefined, rnd: Rnd = Math.random): string {
  let s = String(text ?? '');
  for (let round = 0; round < MAX_SPIN_ROUNDS && SPIN_GROUP.test(s); round++) {
    s = s.replace(SPIN_GROUP, (_match, body: string) => {
      const options = body.split('|');
      const index = Math.floor(rnd() * options.length);
      return options[Math.min(options.length - 1, Math.max(0, index))];
    });
  }
  return s;
}

/**
 * What the engine writes for one group: the code replaces every `{{code}}`; without the tag the
 * code becomes the first line (the whole text when the post is empty); no code leaves the text.
 */
export function compose(text: string | null | undefined, code: string | null | undefined): string {
  const body = String(text ?? '');
  const c = String(code ?? '').trim();
  // A function replacer, so `$` in a code is never read as a replacement pattern.
  if (CODE_TAG.test(body)) return body.replace(CODE_TAG_ALL, () => c);
  if (!c) return body;
  return body ? c + '\n' + body : c;
}

/**
 * The full text of one post to one group: spintax resolved, group code, then the footer block
 * (before the text when `footerPos` is `top`, after it otherwise) and the hashtags. A footer or
 * hashtag block the text already contains is not added twice. Footer spintax is resolved too.
 */
export function composeFull(
  text: string | null | undefined,
  code: string | null | undefined,
  settings: ComposeSettings | null | undefined,
  rnd: Rnd = Math.random,
): string {
  let body = compose(spin(text, rnd), code);
  const footer = spin(settings?.footer, rnd).trim();
  if (footer && !body.includes(footer)) {
    body = settings?.footerPos === 'top' ? footer + '\n' + body : body + '\n\n' + footer;
  }
  const tags = String(settings?.hashtags ?? '').trim();
  if (tags && !body.includes(tags)) body = body + '\n' + tags;
  return body;
}

/**
 * A repeatable random source (a 31-bit linear congruential generator): the same seed gives the
 * same sequence, every value is in [0, 1). A seed of 0 is treated as 1.
 */
export function seededRandom(seed: number): Rnd {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
    return x / 0x80000000;
  };
}

/**
 * Up to `max` different results of spinning `text`, for the preview. Without spintax the text
 * itself is the only variant. Repeatable for the same arguments unless `rnd` is given.
 */
export function spinVariants(
  text: string | null | undefined,
  max: number,
  rnd: Rnd = seededRandom(1),
): string[] {
  const source = String(text ?? '');
  const limit = Math.max(0, Math.floor(max) || 0);
  if (limit === 0) return [];
  if (!hasSpin(source)) return [source];
  const found = new Set<string>();
  for (let attempt = 0; attempt < limit * 20 + 20 && found.size < limit; attempt++) {
    found.add(spin(source, rnd));
  }
  return [...found];
}

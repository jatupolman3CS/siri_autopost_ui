// Mirrors the server's `PostComposer` (backend spec §2): the group code replaces `{{code}}` or
// becomes the first line, spintax `{a|b|c}` is resolved innermost first (at most 50 rounds), then
// the collection's footer and hashtags are added unless the text already holds them. The text is
// never cut: a result that is too long is the caller's problem to report (the server refuses it).
// The second half of the file is for the post editor (insert at the caret, spintax checks and counts, the
// preview's highlighted segments); it reads the same rules and has no server counterpart.

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
/** A line that holds nothing but the tag. */
const CODE_TAG_LINE = /^[ \t]*\{\{\s*(?:code|รหัส)\s*\}\}[ \t]*(?:\r?\n|$)/gim;
/** An innermost spintax group: braces with a pipe and no braces inside. */
const SPIN_GROUP = /\{([^{}]*\|[^{}]*)\}/;
const SPIN_GROUP_ALL = /\{([^{}]*\|[^{}]*)\}/g;
/**
 * The server resolves in rounds: each round settles every innermost group at once, and it stops after this
 * many rounds. So groups side by side are never limited; only a nesting deeper than this stays as written.
 */
export const MAX_SPIN_ROUNDS = 50;
/** The longest a composed post may be: the server refuses a longer one (Post.MaxComposedLength). */
export const MAX_COMPOSED_LENGTH = 7000;

export function hasCodeTag(text: string | null | undefined): boolean {
  return CODE_TAG.test(String(text ?? ''));
}

export function hasSpin(text: string | null | undefined): boolean {
  return SPIN_GROUP.test(String(text ?? ''));
}

export function postFlags(text: string | null | undefined): PostFlags {
  return { hasCode: hasCodeTag(text), hasSpin: hasSpin(text) };
}

/** Picks one option of a group body (`a|b|c`) uniformly with `rnd`. */
function pick(body: string, rnd: Rnd): string {
  const options = body.split('|');
  const index = Math.floor(rnd() * options.length);
  return options[Math.min(options.length - 1, Math.max(0, index))];
}

/**
 * Resolves every `{a|b|c}` (nested ones from the inside out) choosing uniformly with `rnd`. Like the server,
 * each round settles all the groups that have no braces inside, left to right, one random value each.
 */
export function spin(text: string | null | undefined, rnd: Rnd = Math.random): string {
  let s = String(text ?? '');
  for (let round = 0; round < MAX_SPIN_ROUNDS && SPIN_GROUP.test(s); round++) {
    s = s.replace(SPIN_GROUP_ALL, (_match, body: string) => pick(body, rnd));
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
  // A tag alone on its line goes with the line when the group has no code (no blank first line).
  if (CODE_TAG.test(body))
    return (c ? body : body.replace(CODE_TAG_LINE, '')).replace(CODE_TAG_ALL, () => c);
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
  return composeWith(text, code, settings, rnd, spin, (s) => s);
}

/** The steps of `composeFull`, with the spinning and the "does the body already hold it" test as parameters. */
function composeWith(
  text: string | null | undefined,
  code: string | null | undefined,
  settings: ComposeSettings | null | undefined,
  rnd: Rnd,
  spinText: (text: string | null | undefined, rnd: Rnd) => string,
  plain: (s: string) => string,
): string {
  let body = compose(spinText(text, rnd), code);
  const footer = spin(settings?.footer, rnd).trim();
  if (footer && !plain(body).includes(footer)) {
    body = settings?.footerPos === 'top' ? footer + '\n' + body : body + '\n\n' + footer;
  }
  const tags = String(settings?.hashtags ?? '').trim();
  if (tags && !plain(body).includes(tags)) body = body + '\n' + tags;
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

/**
 * The composing settings a post is written with: its own hashtags, footer and footer position win, and a value
 * it leaves null follows its collection (`""` is an own value: no footer / no tags for this post). Mirrors the
 * server's `CollectionPostSettings.Apply`.
 */
export function postComposeSettings(
  collection: ComposeSettings | null | undefined,
  post: ComposeSettings | null | undefined,
): ComposeSettings {
  return {
    hashtags: post?.hashtags ?? collection?.hashtags,
    footer: post?.footer ?? collection?.footer,
    footerPos: post?.footerPos ?? collection?.footerPos,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Helpers of the post editor
// ---------------------------------------------------------------------------------------------------------

/** A text after an edit, and where the caret goes. */
export interface TextEdit {
  text: string;
  caret: number;
}

const clampIndex = (n: number, length: number): number =>
  Math.min(length, Math.max(0, Math.floor(n) || 0));

/**
 * Puts `insert` into `text` at the caret (`start`), or in place of the selection (`start`..`end`), and says
 * where the caret goes: right after what was put in. Answers null (nothing changes) when the result would be
 * longer than `max`, so a tool never silently cuts the end of a post.
 */
export function insertAt(
  text: string,
  insert: string,
  start: number,
  end: number = start,
  max: number = Number.POSITIVE_INFINITY,
): TextEdit | null {
  const a = clampIndex(Math.min(start, end), text.length);
  const b = clampIndex(Math.max(start, end), text.length);
  const out = text.slice(0, a) + insert + text.slice(b);
  return out.length > max ? null : { text: out, caret: a + insert.length };
}

/**
 * Turns the selection into a spintax group, `{selection|}`, with the caret after the pipe, ready to type the
 * other words. Without a selection it puts an empty group `{|}` in with the caret inside, before the pipe.
 */
export function wrapSpin(
  text: string,
  start: number,
  end: number = start,
  max: number = Number.POSITIVE_INFINITY,
): TextEdit | null {
  const a = clampIndex(Math.min(start, end), text.length);
  const b = clampIndex(Math.max(start, end), text.length);
  const selected = text.slice(a, b);
  const edit = insertAt(text, `{${selected}|}`, a, b, max);
  return edit && { ...edit, caret: a + 1 + selected.length + (selected ? 1 : 0) };
}

/** The group code tag the editor's button writes. */
export const CODE_TAG_TEXT = '{{code}}';

/**
 * Writes `{{code}}` at the caret. When it starts a line that has more text after it (or the post is still empty)
 * it gets a line of its own, because the group code reads best on line 1; in the middle of a sentence it stays
 * inline.
 */
export function insertCodeTag(
  text: string,
  start: number,
  end: number = start,
  max: number = Number.POSITIVE_INFINITY,
): TextEdit | null {
  const a = clampIndex(Math.min(start, end), text.length);
  const b = clampIndex(Math.max(start, end), text.length);
  const atLineStart = a === 0 || text[a - 1] === '\n';
  const rest = text.slice(b);
  const ownLine = atLineStart && (text.trim() === '' || (rest !== '' && !rest.startsWith('\n')));
  return insertAt(text, ownLine ? CODE_TAG_TEXT + '\n' : CODE_TAG_TEXT, a, b, max);
}

/**
 * Builds a spintax group from the options typed in a form: braces and pipes inside an option are dropped (they
 * would break the group), each option is trimmed, blanks are left out. Needs two options left; else null.
 */
export function buildSpin(options: readonly string[]): string | null {
  const kept = options.map((o) => o.replace(/[{}|]/g, '').trim()).filter(Boolean);
  return kept.length >= 2 ? `{${kept.join('|')}}` : null;
}

export type SpinIssueKind = 'unclosed' | 'unopened' | 'noPipe' | 'emptyOption' | 'codeInGroup';

/** A likely mistake in the braces of a post: what kind, where (the index of the brace) and the text around it. */
export interface SpinIssue {
  kind: SpinIssueKind;
  at: number;
  text: string;
}

const CODE_TAG_STICKY = /\{\{\s*(?:code|รหัส)\s*\}\}/iy;
const SNIPPET_LENGTH = 24;

/**
 * Looks for braces the server will not read the way the writer meant: a `{` never closed or a `}` never opened,
 * a `{group}` with no pipe (it stays as written), an empty option (`{a||b}`: one pick writes nothing) and a
 * `{{code}}` inside a group (the server resolves only groups with no braces inside, so that group is never
 * spun). `{{code}}` outside a group is fine. Answers the issues in the order of their position.
 */
export function lintSpin(text: string | null | undefined): SpinIssue[] {
  const s = String(text ?? '');
  const issues: SpinIssue[] = [];
  const near = (at: number) => s.slice(at, at + SNIPPET_LENGTH).replace(/\s+/g, ' ');
  const stack: { at: number; cuts: number[]; code: boolean }[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') {
      CODE_TAG_STICKY.lastIndex = i;
      const tag = CODE_TAG_STICKY.exec(s);
      if (tag) {
        for (const g of stack) g.code = true;
        i += tag[0].length - 1;
      } else stack.push({ at: i, cuts: [], code: false });
    } else if (c === '|') {
      stack.at(-1)?.cuts.push(i);
    } else if (c === '}') {
      const g = stack.pop();
      if (!g) {
        issues.push({
          kind: 'unopened',
          at: i,
          text: s.slice(Math.max(0, i - SNIPPET_LENGTH), i + 1).replace(/\s+/g, ' '),
        });
      } else if (!g.cuts.length) {
        issues.push({ kind: 'noPipe', at: g.at, text: near(g.at) });
      } else if (g.code) {
        issues.push({ kind: 'codeInGroup', at: g.at, text: near(g.at) });
      } else {
        const edges = [g.at, ...g.cuts, i];
        if (edges.some((edge, k) => k > 0 && edge - edges[k - 1] === 1))
          issues.push({ kind: 'emptyOption', at: g.at, text: near(g.at) });
      }
    }
  }
  for (const g of stack) issues.push({ kind: 'unclosed', at: g.at, text: near(g.at) });
  return issues.sort((x, y) => x.at - y.at);
}

/** How much spintax a post has: the groups the server resolves and how many different texts they can make. */
export interface SpinCount {
  groups: number;
  /** The product of the options of the groups (nested groups add up inside their parent); capped, see MAX_VARIANTS. */
  variants: number;
}

/** `spinCount` stops counting here (the number is only shown as "about"). */
export const MAX_VARIANTS = 1_000_000_000;

const PRIVATE_USE = /[-]/g;
const WEIGHT = /(\d+)/g;

/**
 * Counts the groups and the possible texts of spintax the way the server resolves it (innermost groups first,
 * at most `MAX_SPIN_ROUNDS` rounds). Two picks that write the same words are counted twice, so it is "about".
 */
export function spinCount(text: string | null | undefined): SpinCount {
  let s = String(text ?? '').replace(PRIVATE_USE, '');
  const weights: number[] = [];
  const weight = (part: string): number => {
    let w = 1;
    for (const m of part.matchAll(WEIGHT)) w = Math.min(MAX_VARIANTS, w * weights[Number(m[1])]);
    return w;
  };
  let groups = 0;
  for (let round = 0; round < MAX_SPIN_ROUNDS && SPIN_GROUP.test(s); round++) {
    s = s.replace(SPIN_GROUP_ALL, (_match, body: string) => {
      groups++;
      const total = body.split('|').reduce((sum, option) => sum + weight(option), 0);
      weights.push(Math.min(MAX_VARIANTS, total));
      return `${weights.length - 1}`;
    });
  }
  return { groups, variants: groups ? weight(s) : 1 };
}

/** A stretch of a composed post, and whether spintax picked it (the preview marks those). */
export interface ComposedSegment {
  text: string;
  spun: boolean;
}

const SPUN_OPEN = '';
const SPUN_CLOSE = '';

/**
 * `composeFull` for the preview: the same text, cut into segments so the words that spintax picked can be
 * highlighted. Nothing but the marking differs: the segments joined are exactly what `composeFull` writes with
 * the same `rnd`.
 */
export function composeSegments(
  text: string | null | undefined,
  code: string | null | undefined,
  settings: ComposeSettings | null | undefined,
  rnd: Rnd = Math.random,
): ComposedSegment[] {
  const mark = (t: string | null | undefined, r: Rnd): string => {
    let s = String(t ?? '').replace(PRIVATE_USE, '');
    for (let round = 0; round < MAX_SPIN_ROUNDS && SPIN_GROUP.test(s); round++) {
      s = s.replace(SPIN_GROUP_ALL, (_m, body: string) => SPUN_OPEN + pick(body, r) + SPUN_CLOSE);
    }
    return s;
  };
  const unmark = (s: string) => s.replaceAll(SPUN_OPEN, '').replaceAll(SPUN_CLOSE, '');
  const marked = composeWith(text, code, settings, rnd, mark, unmark);
  const segments: ComposedSegment[] = [];
  let depth = 0;
  let current = '';
  const flush = () => {
    if (!current) return;
    const spun = depth > 0;
    const last = segments.at(-1);
    if (last && last.spun === spun) last.text += current;
    else segments.push({ text: current, spun });
    current = '';
  };
  for (const ch of marked) {
    if (ch === SPUN_OPEN || ch === SPUN_CLOSE) {
      flush();
      depth += ch === SPUN_OPEN ? 1 : -1;
    } else current += ch;
  }
  flush();
  return segments;
}

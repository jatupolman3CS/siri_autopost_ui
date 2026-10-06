import {
  MAX_COMPOSED_LENGTH,
  MAX_SPIN_ROUNDS,
  MAX_VARIANTS,
  buildSpin,
  compose,
  composeFull,
  composeSegments,
  hasCodeTag,
  hasSpin,
  insertAt,
  insertCodeTag,
  lintSpin,
  postComposeSettings,
  postFlags,
  seededRandom,
  spin,
  spinCount,
  spinVariants,
  wrapSpin,
} from './compose';

/** A random source that returns the given values in turn (then the last one forever). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const first = () => 0;
const last = () => 0.999999;

describe('hasCodeTag', () => {
  it.each([
    '{{code}}',
    '{{ code }}',
    '{{CODE}}',
    '{{Code}}',
    '{{   code   }}',
    '{{รหัส}}',
    '{{ รหัส }}',
    'ซื้อเลย {{ รหัส }} วันนี้',
    '{{\tcode\n}}',
    'a {{code}} b {{code}}',
  ])('finds the tag in %j', (text) => {
    expect(hasCodeTag(text)).toBe(true);
  });

  it.each([
    '',
    'code',
    '{code}',
    '{{codes}}',
    '{{ co de }}',
    '{{code}',
    '{code}}',
    '{{ รหัสลับ }}',
    '{{}}',
  ])('does not find a tag in %j', (text) => {
    expect(hasCodeTag(text)).toBe(false);
  });

  it('is false for null and undefined', () => {
    expect(hasCodeTag(null)).toBe(false);
    expect(hasCodeTag(undefined)).toBe(false);
  });
});

describe('hasSpin / postFlags', () => {
  it('detects a group with a pipe', () => {
    expect(hasSpin('{a|b}')).toBe(true);
    expect(hasSpin('x {สวัสดี|หวัดดี} y')).toBe(true);
    expect(hasSpin('{a|{b|c}}')).toBe(true);
    expect(hasSpin('{|}')).toBe(true);
  });

  it('ignores braces without a pipe and a pipe outside braces', () => {
    expect(hasSpin('{a}')).toBe(false);
    expect(hasSpin('a|b')).toBe(false);
    expect(hasSpin('{{code}}')).toBe(false);
    expect(hasSpin('')).toBe(false);
    expect(hasSpin(null)).toBe(false);
  });

  it('reports both flags', () => {
    expect(postFlags('{a|b} {{code}}')).toEqual({ hasCode: true, hasSpin: true });
    expect(postFlags('{a|b}')).toEqual({ hasCode: false, hasSpin: true });
    expect(postFlags('{{ รหัส }}')).toEqual({ hasCode: true, hasSpin: false });
    expect(postFlags('plain')).toEqual({ hasCode: false, hasSpin: false });
    expect(postFlags(undefined)).toEqual({ hasCode: false, hasSpin: false });
  });
});

describe('spin', () => {
  it('leaves text without spintax as it is', () => {
    expect(spin('hello {{code}} {x}', first)).toBe('hello {{code}} {x}');
    expect(spin('', first)).toBe('');
    expect(spin(null, first)).toBe('');
    expect(spin(undefined, first)).toBe('');
  });

  it('picks uniformly: the random value chooses the option', () => {
    expect(spin('{a|b|c}', first)).toBe('a');
    expect(spin('{a|b|c}', () => 0.4)).toBe('b');
    expect(spin('{a|b|c}', last)).toBe('c');
    expect(spin('{a|b}', () => 0.5)).toBe('b');
  });

  it('never goes out of range, even for an out-of-range random value', () => {
    expect(spin('{a|b}', () => 1)).toBe('b');
    expect(spin('{a|b}', () => -0.5)).toBe('a');
  });

  it('resolves groups from left to right, one random value each', () => {
    expect(spin('{a|b} {c|d} {e|f}', sequence(0, 0.99, 0))).toBe('a d e');
  });

  it('resolves nested groups from the inside out', () => {
    // the first random value picks inside {b|c}, the second picks in what is left: {a|<inner>}
    expect(spin('{a|{b|c}}', sequence(0, 0))).toBe('a');
    expect(spin('{a|{b|c}}', sequence(0, 0.99))).toBe('b');
    expect(spin('{a|{b|c}}', sequence(0.99, 0.99))).toBe('c');
    expect(spin('{x|{y|{z|w}}}', sequence(0.99, 0, 0.99))).toBe('y');
    expect(spin('{{a|b}|c}', sequence(0, 0.99))).toBe('c');
    expect(spin('{{a|b}|c}', sequence(0.99, 0.99))).toBe('c');
    expect(spin('{{a|b}|c}', sequence(0.99, 0))).toBe('b');
  });

  it('keeps an inner group that was picked and resolves what it left behind', () => {
    // inner {c|d} -> d, then {a|b|d} -> d
    expect(spin('{a|b|{c|d}}', sequence(0.99, 0.99))).toBe('d');
  });

  it('allows empty options', () => {
    expect(spin('x{|!}y', first)).toBe('xy');
    expect(spin('x{|!}y', last)).toBe('x!y');
    expect(spin('{|}', first)).toBe('');
  });

  it('works on Thai text and emoji', () => {
    expect(spin('{สวัสดีค่ะ|หวัดดีค่ะ} 👋 {ของดี|ของใหม่}', sequence(0.99, 0))).toBe(
      'หวัดดีค่ะ 👋 ของดี',
    );
  });

  it('keeps a group with a single option and no pipe', () => {
    expect(spin('{only}', first)).toBe('{only}');
  });

  it('leaves the code tag alone', () => {
    expect(spin('{a|b} {{code}} {{ รหัส }}', first)).toBe('a {{code}} {{ รหัส }}');
  });

  it('resolves any number of groups side by side: each round settles all the innermost ones', () => {
    const groups = MAX_SPIN_ROUNDS * 4;
    expect(spin('{a|b}'.repeat(groups), first)).toBe('a'.repeat(groups));
    expect(spin('{a|b}'.repeat(groups), last)).toBe('b'.repeat(groups));
  });

  it('stops after the maximum number of rounds: only a nesting that deep stays as written', () => {
    const depth = MAX_SPIN_ROUNDS + 3;
    // {a|{a|{a|...{a|z}}}} : each round settles the innermost group, so `depth` rounds are needed.
    const nested = '{a|'.repeat(depth) + 'z' + '}'.repeat(depth);
    expect(spin(nested, last)).toBe('{a|'.repeat(3) + 'z' + '}'.repeat(3));
    expect(spin('{a|'.repeat(MAX_SPIN_ROUNDS) + 'z' + '}'.repeat(MAX_SPIN_ROUNDS), last)).toBe('z');
  });

  it('uses Math.random when no source is given', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      expect(spin('{a|b}')).toBe('b');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('compose', () => {
  it('replaces every code tag with the trimmed code', () => {
    expect(compose('รหัส {{code}} และ {{ รหัส }} ครับ', '  AB12  ')).toBe(
      'รหัส AB12 และ AB12 ครับ',
    );
    expect(compose('{{CODE}}', 'x')).toBe('x');
  });

  it('puts the code on the first line when the text has no tag', () => {
    expect(compose('ขายของ', 'AB12')).toBe('AB12\nขายของ');
    expect(compose('line1\nline2', 'AB12')).toBe('AB12\nline1\nline2');
  });

  it('writes just the code for an empty text', () => {
    expect(compose('', 'AB12')).toBe('AB12');
    expect(compose(null, 'AB12')).toBe('AB12');
  });

  it('leaves the text when there is no code', () => {
    expect(compose('ขายของ', '')).toBe('ขายของ');
    expect(compose('ขายของ', '   ')).toBe('ขายของ');
    expect(compose('ขายของ', null)).toBe('ขายของ');
    expect(compose('ขายของ', undefined)).toBe('ขายของ');
    expect(compose('', '')).toBe('');
  });

  it('removes the tag when the code is empty', () => {
    expect(compose('a {{code}} b', '')).toBe('a  b');
    expect(compose('{{code}}', null)).toBe('');
  });

  it('drops a line that holds only the tag when the group has no code', () => {
    expect(compose('{{code}}\nโปรวันนี้', '')).toBe('โปรวันนี้');
    expect(compose('  {{ รหัส }}  \r\nโปรวันนี้', null)).toBe('โปรวันนี้');
    expect(compose('{{code}}\nโปรวันนี้', ' #K1 ')).toBe('#K1\nโปรวันนี้');
  });

  it('does not add the code again when the tag is used', () => {
    expect(compose('x {{code}}', 'C')).toBe('x C');
  });

  it('writes a code with dollar signs literally', () => {
    expect(compose('a {{code}} b', '$&-$1-$$')).toBe('a $&-$1-$$ b');
  });

  it('can be called twice in a row (no regex state leaks)', () => {
    expect(compose('{{code}}', 'a')).toBe('a');
    expect(compose('{{code}}', 'a')).toBe('a');
    expect(hasCodeTag('{{code}}')).toBe(true);
    expect(hasCodeTag('{{code}}')).toBe(true);
  });
});

describe('composeFull', () => {
  const base = { hashtags: '', footer: '', footerPos: 'end' as const };

  it('is the composed text when the collection adds nothing', () => {
    expect(composeFull('ขายของ', 'C1', base, first)).toBe('C1\nขายของ');
    expect(composeFull('ขายของ', '', base, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', null, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', undefined, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', {}, first)).toBe('ขายของ');
  });

  it('adds the footer after the text, separated by a blank line', () => {
    expect(composeFull('ขาย', '', { ...base, footer: 'ทักแชทได้เลย' }, first)).toBe(
      'ขาย\n\nทักแชทได้เลย',
    );
  });

  it('adds the footer before the text when it is on top', () => {
    expect(composeFull('ขาย', '', { ...base, footer: 'F', footerPos: 'top' }, first)).toBe(
      'F\nขาย',
    );
  });

  it('treats the group code as part of the text, so a top footer goes above it', () => {
    expect(composeFull('ขาย', 'C1', { ...base, footer: 'F', footerPos: 'top' }, first)).toBe(
      'F\nC1\nขาย',
    );
  });

  it('does not add a footer the text already contains', () => {
    expect(composeFull('ขาย\n\nทักแชท', '', { ...base, footer: 'ทักแชท' }, first)).toBe(
      'ขาย\n\nทักแชท',
    );
    expect(
      composeFull('ทักแชท ขาย', '', { ...base, footer: 'ทักแชท', footerPos: 'top' }, first),
    ).toBe('ทักแชท ขาย');
  });

  it('trims the footer before comparing and adding it', () => {
    expect(composeFull('ขาย', '', { ...base, footer: '  F \n' }, first)).toBe('ขาย\n\nF');
    expect(composeFull('ขาย F', '', { ...base, footer: '  F ' }, first)).toBe('ขาย F');
  });

  it('ignores a footer that is only spaces', () => {
    expect(composeFull('ขาย', '', { ...base, footer: '  \n ' }, first)).toBe('ขาย');
  });

  it('adds the hashtags on a new line after everything', () => {
    expect(composeFull('ขาย', '', { ...base, hashtags: '#ขาย #โปร' }, first)).toBe(
      'ขาย\n#ขาย #โปร',
    );
    expect(composeFull('ขาย', '', { ...base, footer: 'F', hashtags: '#a' }, first)).toBe(
      'ขาย\n\nF\n#a',
    );
    expect(
      composeFull('ขาย', '', { ...base, footer: 'F', footerPos: 'top', hashtags: '#a' }, first),
    ).toBe('F\nขาย\n#a');
  });

  it('does not add hashtags the text already contains', () => {
    expect(composeFull('ขาย #โปร #ขาย', '', { ...base, hashtags: '#โปร #ขาย' }, first)).toBe(
      'ขาย #โปร #ขาย',
    );
    expect(composeFull('x #a', '', { ...base, hashtags: ' #a ' }, first)).toBe('x #a');
  });

  it('ignores hashtags that are only spaces', () => {
    expect(composeFull('ขาย', '', { ...base, hashtags: '   ' }, first)).toBe('ขาย');
  });

  it('adds hashtags even when the footer was already in the text', () => {
    expect(composeFull('ขาย F', '', { ...base, footer: 'F', hashtags: '#a' }, first)).toBe(
      'ขาย F\n#a',
    );
  });

  it('resolves spintax in the text and in the footer, text first', () => {
    const settings = { ...base, footer: '{ทักแชท|โทรมา}' };
    expect(composeFull('{สวัสดี|หวัดดี}', '', settings, sequence(0.99, 0))).toBe(
      'หวัดดี\n\nทักแชท',
    );
    expect(composeFull('{สวัสดี|หวัดดี}', '', settings, sequence(0, 0.99))).toBe('สวัสดี\n\nโทรมา');
  });

  it('does not spin the group code or the hashtags', () => {
    expect(composeFull('x', '{a|b}', { ...base, hashtags: '{c|d}' }, first)).toBe(
      '{a|b}\nx\n{c|d}',
    );
  });

  it('does not resolve a group that contains a code tag (the server cannot either)', () => {
    expect(composeFull('{ซื้อ {{code}}|สั่ง {{code}}}', 'AB', base, last)).toBe(
      '{ซื้อ AB|สั่ง AB}',
    );
  });

  it('never cuts a long text', () => {
    const long = 'ก'.repeat(6000);
    const out = composeFull(long, 'C', { ...base, footer: 'F', hashtags: '#a' }, first);
    expect(out).toBe('C\n' + long + '\n\nF\n#a');
    expect(out.length).toBeGreaterThan(6000);
  });

  it('works with the full collection settings object', () => {
    const settings = {
      hashtags: '#h',
      pageTags: 'ignored',
      footer: 'F',
      footerPos: 'top' as const,
      shuffle: true,
      watermark: false,
      watermarkPos: 'br' as const,
      requireApproval: false,
    };
    expect(composeFull('t', '', settings, first)).toBe('F\nt\n#h');
  });

  it('treats an unknown footer position as the end', () => {
    expect(composeFull('t', '', { footer: 'F', footerPos: null }, first)).toBe('t\n\nF');
  });
});

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(20261003);
    const b = seededRandom(20261003);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('gives other sequences for other seeds', () => {
    const a = Array.from({ length: 5 }, seededRandom(1));
    const b = Array.from({ length: 5 }, seededRandom(2));
    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const r = seededRandom(7);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('treats seed 0 like seed 1 and accepts negative and fractional seeds', () => {
    expect(Array.from({ length: 4 }, seededRandom(0))).toEqual(
      Array.from({ length: 4 }, seededRandom(1)),
    );
    expect(() => seededRandom(-5)()).not.toThrow();
    expect(() => seededRandom(1.5)()).not.toThrow();
    expect(seededRandom(Number.NaN)()).toBe(seededRandom(1)());
  });

  it('spreads values over the range', () => {
    const r = seededRandom(42);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(r() * 4)]++;
    for (const n of buckets) expect(n).toBeGreaterThan(800);
  });
});

describe('spinVariants', () => {
  it('returns the text itself when there is no spintax', () => {
    expect(spinVariants('plain {{code}}', 3)).toEqual(['plain {{code}}']);
    expect(spinVariants('', 3)).toEqual(['']);
  });

  it('returns nothing for a non-positive or invalid maximum', () => {
    expect(spinVariants('{a|b}', 0)).toEqual([]);
    expect(spinVariants('{a|b}', -2)).toEqual([]);
    expect(spinVariants('{a|b}', Number.NaN)).toEqual([]);
    expect(spinVariants('plain', 0)).toEqual([]);
  });

  it('returns distinct results, at most the maximum', () => {
    const v = spinVariants('{a|b|c|d} {x|y|z}', 4);
    expect(v).toHaveLength(4);
    expect(new Set(v).size).toBe(4);
    for (const s of v) expect(s).toMatch(/^[abcd] [xyz]$/);
  });

  it('returns fewer when the text has fewer variants', () => {
    expect(spinVariants('{a|b}', 5).sort()).toEqual(['a', 'b']);
    expect(spinVariants('{a|a}', 3)).toEqual(['a']);
  });

  it('finds every branch of a nested group', () => {
    expect(spinVariants('{a|{b|c}}', 10).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps Thai text and surrounding words', () => {
    const v = spinVariants('{สวัสดี|หวัดดี}ค่ะ', 5).sort();
    expect(v).toEqual(['สวัสดีค่ะ', 'หวัดดีค่ะ']);
  });

  it('is repeatable for the same input', () => {
    expect(spinVariants('{a|b|c} {d|e|f}', 3)).toEqual(spinVariants('{a|b|c} {d|e|f}', 3));
  });

  it('uses the random source it is given', () => {
    expect(spinVariants('{a|b}', 2, sequence(0, 0.99))).toEqual(['a', 'b']);
  });
});

describe('postComposeSettings', () => {
  const col = { hashtags: '#col', footer: 'Col footer', footerPos: 'end' as const };

  it('follows the collection for every value the post leaves null', () => {
    expect(postComposeSettings(col, { hashtags: null, footer: null, footerPos: null })).toEqual(
      col,
    );
    expect(postComposeSettings(col, null)).toEqual(col);
    expect(postComposeSettings(col, undefined)).toEqual(col);
  });

  it("lets the post's own values win, field by field", () => {
    expect(postComposeSettings(col, { hashtags: '#own', footer: null, footerPos: 'top' })).toEqual({
      hashtags: '#own',
      footer: 'Col footer',
      footerPos: 'top',
    });
  });

  it('treats an empty string as an own value: no footer or tags for this post', () => {
    const s = postComposeSettings(col, { hashtags: '', footer: '', footerPos: null });
    expect(s).toEqual({ hashtags: '', footer: '', footerPos: 'end' });
    expect(composeFull('Hello', '', s, first)).toBe('Hello');
  });

  it('feeds composeFull the same way the server writes the post', () => {
    const s = postComposeSettings(col, { hashtags: '#own', footer: null, footerPos: 'top' });
    expect(composeFull('Hello', '', s, first)).toBe('Col footer\nHello\n#own');
  });

  it('copes with no collection', () => {
    expect(postComposeSettings(null, { hashtags: '#own', footer: null, footerPos: null })).toEqual({
      hashtags: '#own',
      footer: undefined,
      footerPos: undefined,
    });
  });
});

describe('insertAt', () => {
  it('writes at the caret and puts the caret after what was written', () => {
    expect(insertAt('hello world', 'big ', 6)).toEqual({ text: 'hello big world', caret: 10 });
    expect(insertAt('', 'x', 0)).toEqual({ text: 'x', caret: 1 });
    expect(insertAt('abc', 'X', 3)).toEqual({ text: 'abcX', caret: 4 });
  });

  it('replaces the selection', () => {
    expect(insertAt('hello world', 'there', 6, 11)).toEqual({ text: 'hello there', caret: 11 });
  });

  it('accepts a selection made backwards and indexes out of range', () => {
    expect(insertAt('abcdef', 'X', 4, 2)).toEqual({ text: 'abXef', caret: 3 });
    expect(insertAt('abc', 'X', 99)).toEqual({ text: 'abcX', caret: 4 });
    expect(insertAt('abc', 'X', -5)).toEqual({ text: 'Xabc', caret: 1 });
    expect(insertAt('abc', 'X', Number.NaN)).toEqual({ text: 'Xabc', caret: 1 });
  });

  it('refuses (null) when the result would be longer than the most allowed, and never cuts', () => {
    expect(insertAt('abcde', 'XYZ', 2, 2, 7)).toBeNull();
    expect(insertAt('abcde', 'XY', 2, 2, 7)).toEqual({ text: 'abXYcde', caret: 4 });
    // A selection that is replaced makes room.
    expect(insertAt('abcde', 'XYZ', 0, 3, 5)).toEqual({ text: 'XYZde', caret: 3 });
  });

  it('counts Thai text by characters like the textarea does', () => {
    expect(insertAt('สวัสดี', ' ค่ะ', 6)).toEqual({ text: 'สวัสดี ค่ะ', caret: 10 });
  });
});

describe('wrapSpin', () => {
  it('turns the selection into {selection|} with the caret after the pipe', () => {
    const word = 'มีของใหม่';
    const edit = wrapSpin(word + ' วันนี้', 0, word.length)!;
    expect(edit.text).toBe('{' + word + '|} วันนี้');
    expect(edit.text[edit.caret - 1]).toBe('|');
    expect(edit.text[edit.caret]).toBe('}');
  });

  it('wraps in the middle of a text and accepts a backwards selection', () => {
    expect(wrapSpin('say hello now', 4, 9)).toEqual({ text: 'say {hello|} now', caret: 11 });
    expect(wrapSpin('say hello now', 9, 4)).toEqual({ text: 'say {hello|} now', caret: 11 });
  });

  it('puts an empty group with the caret inside when nothing is selected', () => {
    expect(wrapSpin('ab', 1)).toEqual({ text: 'a{|}b', caret: 2 });
    expect(wrapSpin('', 0)).toEqual({ text: '{|}', caret: 1 });
  });

  it('refuses when the group would not fit', () => {
    expect(wrapSpin('abc', 0, 3, 4)).toBeNull();
    expect(wrapSpin('abc', 0, 3, 6)).toEqual({ text: '{abc|}', caret: 5 });
  });
});

describe('insertCodeTag', () => {
  it('writes the tag on its own first line of an empty post', () => {
    expect(insertCodeTag('', 0)).toEqual({ text: '{{code}}\n', caret: 9 });
    expect(insertCodeTag('  \n', 0)).toEqual({ text: '{{code}}\n  \n', caret: 9 });
  });

  it('gives the tag a line of its own at the start of a line that has text', () => {
    expect(insertCodeTag('ขายคอนโด', 0)).toEqual({ text: '{{code}}\nขายคอนโด', caret: 9 });
    expect(insertCodeTag('a\nb', 2)).toEqual({ text: 'a\n{{code}}\nb', caret: 11 });
  });

  it('keeps the tag inline in the middle of a line, at the end, and before an empty line', () => {
    expect(insertCodeTag('ทัก รหัส นี้', 3)).toEqual({ text: 'ทัก{{code}} รหัส นี้', caret: 11 });
    expect(insertCodeTag('abc', 3)).toEqual({ text: 'abc{{code}}', caret: 11 });
    expect(insertCodeTag('\nabc', 0)).toEqual({ text: '{{code}}\nabc', caret: 8 });
  });

  it('replaces the selection and respects the limit', () => {
    expect(insertCodeTag('xx CODE yy', 3, 7)).toEqual({ text: 'xx {{code}} yy', caret: 11 });
    expect(insertCodeTag('abc', 1, 1, 5)).toBeNull();
  });

  it('is read as a code tag by the composer', () => {
    const edit = insertCodeTag('ขายของ', 0)!;
    expect(hasCodeTag(edit.text)).toBe(true);
    expect(compose(edit.text, 'AB1')).toBe('AB1\nขายของ');
  });
});

describe('buildSpin', () => {
  it('joins the options into a group', () => {
    expect(buildSpin(['สวัสดี', 'หวัดดี', 'ทักทาย'])).toBe('{สวัสดี|หวัดดี|ทักทาย}');
  });

  it('trims, drops blanks and removes braces and pipes that would break the group', () => {
    expect(buildSpin(['  a ', '', 'b|c', '{d}', '   '])).toBe('{a|bc|d}');
  });

  it('needs two options', () => {
    expect(buildSpin([])).toBeNull();
    expect(buildSpin(['only'])).toBeNull();
    expect(buildSpin(['a', ' ', '|'])).toBeNull();
  });

  it('writes a group the composer resolves', () => {
    expect(hasSpin(buildSpin(['a', 'b'])!)).toBe(true);
    expect(spin(buildSpin(['a', 'b'])!, last)).toBe('b');
  });
});

describe('lintSpin', () => {
  const kinds = (text: string) => lintSpin(text).map((i) => i.kind);

  it('has nothing to say about good text', () => {
    expect(lintSpin('')).toEqual([]);
    expect(lintSpin(null)).toEqual([]);
    expect(lintSpin('plain text')).toEqual([]);
    expect(lintSpin('{a|b} {c|d|e} {{code}}')).toEqual([]);
    expect(lintSpin('{a|{b|c}} ขาย {{ รหัส }}')).toEqual([]);
    expect(lintSpin('{{CODE}}\n{สวัสดี|หวัดดี}')).toEqual([]);
  });

  it('finds a { that is never closed, at the brace', () => {
    expect(lintSpin('ขาย {a|b')).toEqual([{ kind: 'unclosed', at: 4, text: '{a|b' }]);
    expect(kinds('{a|{b|c}')).toEqual(['unclosed']);
    expect(kinds('{{code}')).toEqual(['unclosed', 'noPipe']);
  });

  it('finds a } that was never opened', () => {
    expect(lintSpin('a|b}')).toEqual([{ kind: 'unopened', at: 3, text: 'a|b}' }]);
    expect(kinds('{a|b}}')).toEqual(['unopened']);
    expect(kinds('{code}}')).toEqual(['noPipe', 'unopened']);
  });

  it('finds a group with a single option (no pipe): the server leaves it as written', () => {
    expect(kinds('{only}')).toEqual(['noPipe']);
    expect(kinds('{a|b} {c}')).toEqual(['noPipe']);
    expect(kinds('{a {b|c}}')).toEqual(['noPipe']);
  });

  it('finds empty options, wherever they are', () => {
    expect(kinds('{a||b}')).toEqual(['emptyOption']);
    expect(kinds('{|a}')).toEqual(['emptyOption']);
    expect(kinds('{a|}')).toEqual(['emptyOption']);
    expect(kinds('{|}')).toEqual(['emptyOption']);
    expect(kinds('{a|b}{c| |d}')).toEqual([]);
  });

  it('finds a code tag inside a group, which the server never spins', () => {
    expect(kinds('{ซื้อ {{code}}|สั่ง {{code}}}')).toEqual(['codeInGroup']);
    expect(kinds('{x|{a|b} {{code}}}')).toEqual(['codeInGroup']);
    expect(spin('{ซื้อ {{code}}|สั่ง {{code}}}', last)).toBe('{ซื้อ {{code}}|สั่ง {{code}}}');
  });

  it('lists the issues in the order of the text', () => {
    expect(lintSpin('{a} x {b||c} y {d').map((i) => [i.kind, i.at])).toEqual([
      ['noPipe', 0],
      ['emptyOption', 6],
      ['unclosed', 15],
    ]);
  });

  it('does not run away on long text and handles a lone brace', () => {
    expect(kinds('{')).toEqual(['unclosed']);
    expect(kinds('}')).toEqual(['unopened']);
    expect(lintSpin('{a|b}'.repeat(2000))).toEqual([]);
  });
});

describe('spinCount', () => {
  it('is one text without spintax', () => {
    expect(spinCount('')).toEqual({ groups: 0, variants: 1 });
    expect(spinCount(null)).toEqual({ groups: 0, variants: 1 });
    expect(spinCount('plain {{code}} {x}')).toEqual({ groups: 0, variants: 1 });
  });

  it('counts the groups and multiplies the options of groups side by side', () => {
    expect(spinCount('{a|b|c}')).toEqual({ groups: 1, variants: 3 });
    expect(spinCount('{a|b|c} x {d|e}')).toEqual({ groups: 2, variants: 6 });
    expect(spinCount('{a|b} {c|d} {e|f} {g|h}')).toEqual({ groups: 4, variants: 16 });
  });

  it('adds up the options of a nested group inside its parent', () => {
    // {a|b|{c|d|e}} : a, b, c, d or e
    expect(spinCount('{a|b|{c|d|e}}')).toEqual({ groups: 2, variants: 5 });
    // {{a|b} x|{c|d|e} y}: 2 + 3
    expect(spinCount('{{a|b} x|{c|d|e} y}')).toEqual({ groups: 3, variants: 5 });
    // 2 * 3 inside one option, the other option has 1
    expect(spinCount('{{a|b} {c|d|e}|z}')).toEqual({ groups: 3, variants: 7 });
  });

  it('counts empty options as options', () => {
    expect(spinCount('x{|!}y')).toEqual({ groups: 1, variants: 2 });
  });

  it('does not count a group the server cannot resolve', () => {
    expect(spinCount('{only}')).toEqual({ groups: 0, variants: 1 });
    expect(spinCount('{ซื้อ {{code}}|สั่ง {{code}}}')).toEqual({ groups: 0, variants: 1 });
  });

  it('caps the number of variants', () => {
    const many = '{a|b|c|d|e|f|g|h|i|j}'.repeat(20);
    expect(spinCount(many)).toEqual({ groups: 20, variants: MAX_VARIANTS });
  });

  it('counts every group side by side, and stops at the nesting the server stops at', () => {
    expect(spinCount('{a|b}'.repeat(200)).groups).toBe(200);
    const depth = MAX_SPIN_ROUNDS + 5;
    expect(spinCount('{a|'.repeat(depth) + 'z' + '}'.repeat(depth)).groups).toBe(MAX_SPIN_ROUNDS);
  });

  it('agrees with the number of distinct texts for small cases', () => {
    const text = '{a|b|c} {x|y} {1|2|{3|4}}';
    const real = new Set<string>();
    for (let seed = 1; seed < 400; seed++) real.add(spin(text, seededRandom(seed)));
    expect(spinCount(text).variants).toBe(3 * 2 * (1 + 1 + 2));
    expect(real.size).toBeGreaterThan(10);
    expect(real.size).toBeLessThanOrEqual(spinCount(text).variants);
  });
});

describe('composeSegments', () => {
  const settings = { hashtags: '#tag', footer: 'F {x|y}', footerPos: 'end' as const };
  const joined = (s: { text: string }[]) => s.map((x) => x.text).join('');

  it('is the text of composeFull, cut where spintax picked words', () => {
    const text = 'ขาย {a|b|c} วันนี้ {d|e}';
    for (let seed = 1; seed <= 12; seed++) {
      const segments = composeSegments(text, 'AB', settings, seededRandom(seed));
      expect(joined(segments)).toBe(composeFull(text, 'AB', settings, seededRandom(seed)));
    }
  });

  it('marks only the picked words', () => {
    const segments = composeSegments('สวัสดี {a|b} ค่ะ', '', null, last);
    expect(segments).toEqual([
      { text: 'สวัสดี ', spun: false },
      { text: 'b', spun: true },
      { text: ' ค่ะ', spun: false },
    ]);
  });

  it('marks what a nested group picked, and merges neighbours', () => {
    const segments = composeSegments('{x|{y|z}}{p|q}', '', null, last);
    expect(segments).toEqual([{ text: 'zq', spun: true }]);
  });

  it('is one plain segment without spintax, and nothing for an empty text', () => {
    expect(composeSegments('plain', '', null, first)).toEqual([{ text: 'plain', spun: false }]);
    expect(composeSegments('plain', 'C', null, first)).toEqual([{ text: 'C\nplain', spun: false }]);
    expect(composeSegments('', '', null, first)).toEqual([]);
  });

  it('does not mark an empty pick', () => {
    expect(composeSegments('a{|!}b', '', null, first)).toEqual([{ text: 'ab', spun: false }]);
  });

  it('keeps the footer test the same as composeFull when a pick makes up the footer text', () => {
    const s = { footer: 'ทักแชท', footerPos: 'end' as const };
    const text = '{ทัก|ติดต่อ}แชท';
    for (const rnd of [first, last]) {
      expect(joined(composeSegments(text, '', s, rnd))).toBe(composeFull(text, '', s, rnd));
    }
    // "ทักแชท" is already in the picked text, so the footer is not added twice.
    expect(joined(composeSegments(text, '', s, first))).toBe('ทักแชท');
  });

  it('ignores private-use characters a person pasted in', () => {
    expect(joined(composeSegments('ab{c|d}', '', null, first))).toBe('abc');
  });
});

describe('MAX_COMPOSED_LENGTH', () => {
  it('is the 7,000 characters the server allows for a composed post', () => {
    expect(MAX_COMPOSED_LENGTH).toBe(7000);
  });
});
